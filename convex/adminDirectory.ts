import { resolveReviewerRole } from "../lib/teamRoles";
import { query } from "./_generated/server";
import { assertAppAdmin, isEnvAdminEmail } from "./authz";

/**
 * Cross-team views for the admin console.
 *
 * There is no users table: a person exists as `reviewers` rows (one per team)
 * plus an optional `userPreferences` row. The directory below reconstructs a
 * person by normalized email, which is what every authorization check already
 * keys on.
 */

export const listTeamsWithRoster = query({
	args: {},
	handler: async (ctx) => {
		await assertAppAdmin(ctx);

		const teams = await ctx.db.query("teams").order("desc").collect();
		const rosters = await Promise.all(
			teams.map(async (team) => {
				const reviewers = await ctx.db
					.query("reviewers")
					.withIndex("by_team", (q) => q.eq("teamId", team._id))
					.collect();
				const owners = reviewers.filter(
					(reviewer) => resolveReviewerRole(reviewer) === "owner",
				);
				return {
					_id: team._id,
					name: team.name,
					slug: team.slug,
					timezone: team.timezone ?? null,
					// Presence only. The URL itself is a credential.
					hasGoogleChatWebhook:
						typeof team.googleChatWebhookUrl === "string" &&
						team.googleChatWebhookUrl.trim().length > 0,
					memberCount: reviewers.length,
					owners: owners.map((owner) => ({
						_id: owner._id,
						name: owner.name,
						email: owner.email,
					})),
					members: reviewers
						.map((reviewer) => ({
							_id: reviewer._id,
							name: reviewer.name,
							email: reviewer.email,
							role: resolveReviewerRole(reviewer),
						}))
						.sort((a, b) => a.name.localeCompare(b.name)),
				};
			}),
		);

		return rosters;
	},
});

export const listUsers = query({
	args: {},
	handler: async (ctx) => {
		await assertAppAdmin(ctx);

		const [reviewers, teams, preferences, admins, tokens] = await Promise.all([
			ctx.db.query("reviewers").collect(),
			ctx.db.query("teams").collect(),
			ctx.db.query("userPreferences").collect(),
			ctx.db.query("appAdmins").collect(),
			ctx.db.query("agentTokens").collect(),
		]);

		const teamsById = new Map(teams.map((team) => [team._id, team]));
		const adminEmails = new Set(admins.map((admin) => admin.email));

		type Entry = {
			email: string;
			name: string | null;
			isAdmin: boolean;
			adminSource: "env" | "table" | null;
			memberships: Array<{ teamSlug: string; role: "owner" | "member" }>;
			activeAgentTokens: number;
			hasPreferences: boolean;
		};
		const byEmail = new Map<string, Entry>();

		function entryFor(email: string): Entry {
			const existing = byEmail.get(email);
			if (existing) return existing;
			const fromEnv = isEnvAdminEmail(email);
			const created: Entry = {
				email,
				name: null,
				// Env admins are listed first everywhere: they are the break-glass
				// and cannot be revoked from the console.
				isAdmin: fromEnv || adminEmails.has(email),
				adminSource: fromEnv ? "env" : adminEmails.has(email) ? "table" : null,
				memberships: [],
				activeAgentTokens: 0,
				hasPreferences: false,
			};
			byEmail.set(email, created);
			return created;
		}

		for (const reviewer of reviewers) {
			const entry = entryFor(reviewer.email);
			entry.name ??= reviewer.name;
			const team = reviewer.teamId ? teamsById.get(reviewer.teamId) : undefined;
			if (team) {
				entry.memberships.push({
					teamSlug: team.slug,
					role: resolveReviewerRole(reviewer),
				});
			}
		}

		// People who signed in but never joined a team still exist as users.
		for (const preference of preferences) {
			if (!preference.email) continue;
			entryFor(preference.email).hasPreferences = true;
		}

		for (const token of tokens) {
			if (!token.email || token.revokedAt) continue;
			entryFor(token.email).activeAgentTokens += 1;
		}

		for (const email of adminEmails) entryFor(email);

		return [...byEmail.values()].sort((a, b) => {
			if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
			return a.email.localeCompare(b.email);
		});
	},
});
