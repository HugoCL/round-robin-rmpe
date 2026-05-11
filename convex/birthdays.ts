import { v } from "convex/values";
import {
	getLocalDateKeyYYYYMMDD,
	getLocalHourInTimeZone,
	getMonthDayInTimeZone,
	resolveTeamTimezone,
} from "../lib/reviewerAvailability";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
} from "./_generated/server";

/** Local hour (0–23) when birthday notifications are sent for a team. */
export const BIRTHDAY_NOTIFY_LOCAL_HOUR = 9;

type DueBirthdayRow = {
	reviewerId: Id<"reviewers">;
	reviewerEmail: string;
	reviewerName: string;
	googleChatUserId?: string;
	teamSlug: string;
	googleChatWebhookUrl?: string;
	localDateKey: string;
	teammateEmails: string[];
};

export const scanDueBirthdays = internalQuery({
	args: {},
	handler: async (ctx): Promise<DueBirthdayRow[]> => {
		const teams = await ctx.db.query("teams").collect();
		const now = Date.now();
		const out: DueBirthdayRow[] = [];

		for (const team of teams) {
			const timeZone = resolveTeamTimezone(team.timezone);
			const localHour = getLocalHourInTimeZone(now, timeZone);
			if (localHour < BIRTHDAY_NOTIFY_LOCAL_HOUR) continue;

			const { month: lm, day: ld } = getMonthDayInTimeZone(now, timeZone);
			const localDateKey = getLocalDateKeyYYYYMMDD(now, timeZone);

			const reviewers = await ctx.db
				.query("reviewers")
				.withIndex("by_team", (q) => q.eq("teamId", team._id))
				.collect();

			for (const r of reviewers) {
				if (r.birthdayMonth === undefined || r.birthdayDay === undefined) {
					continue;
				}
				if (r.lastBirthdayNotifiedLocalDateKey === localDateKey) continue;
				if (r.birthdayMonth !== lm || r.birthdayDay !== ld) continue;

				const teammateEmails = reviewers
					.filter((x) => x.email.toLowerCase() !== r.email.toLowerCase())
					.map((x) => x.email);

				out.push({
					reviewerId: r._id,
					reviewerEmail: r.email,
					reviewerName: r.name,
					googleChatUserId: r.googleChatUserId?.trim() || undefined,
					teamSlug: team.slug,
					googleChatWebhookUrl: team.googleChatWebhookUrl?.trim() || undefined,
					localDateKey,
					teammateEmails,
				});
			}
		}

		return out;
	},
});

export const markBirthdayNotified = internalMutation({
	args: {
		reviewerId: v.id("reviewers"),
		localDateKey: v.string(),
	},
	handler: async (ctx, { reviewerId, localDateKey }) => {
		await ctx.db.patch(reviewerId, {
			lastBirthdayNotifiedLocalDateKey: localDateKey,
		});
	},
});

function buildGoogleChatBirthdayText(
	name: string,
	googleChatUserId?: string,
): string {
	const tail =
		"Que la pases genial — el equipo te manda un abrazo y buena onda (también en los PRs).";
	if (googleChatUserId) {
		return `🎂 ¡Hoy cumple años ${name} (<users/${googleChatUserId}>)! ${tail}`;
	}
	return `🎂 ¡Hoy cumple años ${name}! ${tail}`;
}

export const processBirthdayNotifications = internalAction({
	args: {},
	handler: async (ctx): Promise<{ processed: number }> => {
		const due = await ctx.runQuery(internal.birthdays.scanDueBirthdays, {});
		let processed = 0;

		for (const item of due) {
			const chatText = buildGoogleChatBirthdayText(
				item.reviewerName,
				item.googleChatUserId,
			);

			if (item.googleChatWebhookUrl) {
				try {
					const res = await fetch(item.googleChatWebhookUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ text: chatText }),
					});
					if (!res.ok) {
						console.warn(
							`Birthday Google Chat failed for ${item.teamSlug}: ${res.status}`,
						);
					}
				} catch (e) {
					console.warn("Birthday Google Chat error", e);
				}
			}

			try {
				await ctx.runAction(api.pushActions.sendPushNotification, {
					email: item.reviewerEmail,
					title: "🎂 ¡Hoy es tu día!",
					body: `Que la pases genial, ${item.reviewerName}. El equipo está pensando en ti — entra a la app un momento a celebrar con nosotros.`,
					tag: `birthday-self-${item.localDateKey}-${item.reviewerId}`,
				});
			} catch (e) {
				console.warn("Birthday push (self) failed", e);
			}

			if (item.teammateEmails.length > 0) {
				try {
					await ctx.runAction(api.pushActions.sendPushToParticipants, {
						emails: item.teammateEmails,
						title: "🎂 ¡Hay cumple en el equipo!",
						body: `Hoy es un gran día para ${item.reviewerName}. Mándenle un mensaje lindo; seguro le encanta.`,
						tag: `birthday-team-${item.localDateKey}-${item.reviewerId}`,
					});
				} catch (e) {
					console.warn("Birthday push (team) failed", e);
				}
			}

			try {
				await ctx.runMutation(internal.birthdays.markBirthdayNotified, {
					reviewerId: item.reviewerId,
					localDateKey: item.localDateKey,
				});
			} catch (e) {
				console.warn("markBirthdayNotified failed", e);
			}

			processed++;
		}

		return { processed };
	},
});
