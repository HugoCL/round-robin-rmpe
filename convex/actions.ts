import { v } from "convex/values";
import {
	type ChatDelivery,
	type ChatWebhookTarget,
	deliverChatMessageToTargets,
	describeChatDeliveryProblems,
	describePartialChatDelivery,
	prependUrgentNotice,
} from "../lib/chatBroadcast";
import {
	formatGoogleChatPerson,
	stripPrLinkPlaceholders,
} from "../lib/googleChatMessageTemplate";
import type { Reviewer } from "../lib/types";
import { api, internal } from "./_generated/api";
import { type ActionCtx, action, internalAction } from "./_generated/server";

async function resolveWebhookTargets(
	ctx: ActionCtx,
	teamSlug: string,
	broadcastTeamSlugs: string[] | undefined,
) {
	const requestedSlugs = [
		teamSlug,
		...((broadcastTeamSlugs || []).map((slug) => slug.trim()) || []),
	].filter(
		(slug, index, self) => slug.length > 0 && self.indexOf(slug) === index,
	);

	const teams = await Promise.all(
		requestedSlugs.map((slug) =>
			ctx.runQuery(api.queries.getTeam, { teamSlug: slug }),
		),
	);

	const targetByWebhook = new Map<string, ChatWebhookTarget>();
	const missingWebhookSlugs: string[] = [];
	for (const [index, team] of teams.entries()) {
		const requestedSlug = requestedSlugs[index];
		const webhookUrl = team?.googleChatWebhookUrl?.trim();
		if (!webhookUrl) {
			missingWebhookSlugs.push(requestedSlug);
			continue;
		}
		if (targetByWebhook.has(webhookUrl)) {
			continue;
		}
		targetByWebhook.set(webhookUrl, {
			slug: requestedSlug,
			name: team?.name?.trim() || requestedSlug,
			webhookUrl,
			isExternalTarget: requestedSlug !== teamSlug,
		});
	}

	return {
		targets: Array.from(targetByWebhook.values()),
		missingWebhookSlugs,
	};
}

async function resolveAssignerDisplayNameForChat(
	ctx: ActionCtx,
	options: {
		assignerName?: string;
		assignerEmail?: string;
		teamSlug: string;
	},
): Promise<{ name?: string; chatId?: string }> {
	const { assignerName, assignerEmail, teamSlug } = options;

	if (assignerEmail?.trim()) {
		try {
			const assigner = await ctx.runQuery(
				internal.queries.getReviewerByEmailAnyTeam,
				{
					email: assignerEmail,
					preferredTeamSlug: teamSlug,
				},
			);
			if (assigner) {
				return {
					name: assigner.name.trim() || assignerName?.trim() || undefined,
					chatId: assigner.googleChatUserId?.trim() || undefined,
				};
			}
		} catch (error) {
			console.warn(
				"Failed to resolve assigner name from team reviewers",
				error,
			);
		}
	}

	const trimmedName = assignerName?.trim();
	if (trimmedName && !trimmedName.includes("@") && trimmedName !== "Unknown") {
		return { name: trimmedName };
	}

	return {};
}

async function persistAssignmentChatThreadLinks(
	ctx: ActionCtx,
	args: {
		teamSlug: string;
		prUrl: string;
		reviewerEmails: string[];
		delivery: ChatDelivery;
	},
) {
	if (
		args.reviewerEmails.length === 0 ||
		(args.delivery.googleChatThreadUrls.length === 0 &&
			!args.delivery.googleChatThreadUrl)
	) {
		return;
	}

	try {
		await ctx.runMutation(
			api.mutations.attachGoogleChatThreadUrlToAssignmentHistory,
			{
				teamSlug: args.teamSlug,
				prUrl: args.prUrl,
				reviewerEmails: args.reviewerEmails,
				...(args.delivery.googleChatThreadUrl
					? { googleChatThreadUrl: args.delivery.googleChatThreadUrl }
					: {}),
				...(args.delivery.googleChatThreadUrls.length > 0
					? { googleChatThreadUrls: args.delivery.googleChatThreadUrls }
					: {}),
			},
		);
	} catch (error) {
		console.warn("Failed to persist Google Chat thread URL", error);
	}
}

// Google Chat integration action
export const sendGoogleChatMessage = action({
	args: {
		reviewerName: v.string(),
		reviewerEmail: v.string(),
		reviewerChatId: v.optional(v.string()),
		prUrl: v.string(),
		contextUrl: v.optional(v.string()),
		locale: v.optional(v.string()),
		assignerEmail: v.optional(v.string()),
		assignerName: v.optional(v.string()),
		assignerChatId: v.optional(v.string()),
		teamSlug: v.string(), // Now required to fetch team-specific webhook
		broadcastTeamSlugs: v.optional(v.array(v.string())),
		sendOnlyNames: v.optional(v.boolean()),
		// If provided, this message text will be sent as-is (no template building)
		customMessage: v.optional(v.string()),
		urgent: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		{
			reviewerName,
			reviewerEmail,
			reviewerChatId,
			prUrl,
			contextUrl,
			locale = "en",
			assignerEmail,
			assignerName,
			assignerChatId,
			teamSlug,
			broadcastTeamSlugs,
			sendOnlyNames = false,
			customMessage,
			urgent = false,
		},
	): Promise<{ success: boolean; error?: string }> => {
		// Normalize / sanitize potentially empty or whitespace chat IDs early to avoid rendering `<users/>`
		reviewerChatId = reviewerChatId?.trim() || undefined;
		assignerChatId = assignerChatId?.trim() || undefined;

		const { targets: webhookTargets, missingWebhookSlugs } =
			await resolveWebhookTargets(ctx, teamSlug, broadcastTeamSlugs);
		const sourceTeamName =
			webhookTargets.find((target) => target.slug === teamSlug)?.name ||
			teamSlug;

		if (webhookTargets.length === 0) {
			return {
				success: false,
				error:
					describeChatDeliveryProblems([], missingWebhookSlugs) ||
					"Google Chat webhook URL not configured for this team",
			};
		}

		try {
			const normalizedPrUrl = prUrl.trim();
			const resolvedAssigner = await resolveAssignerDisplayNameForChat(ctx, {
				assignerName,
				assignerEmail,
				teamSlug,
			});
			const resolvedAssignerName = resolvedAssigner.name;
			assignerChatId = assignerChatId || resolvedAssigner.chatId;
			let builtMessage = ""; // init to satisfy TS definite assignment

			const formatPerson = (
				name: string | undefined,
				chatId: string | undefined,
				fallback: string,
			) =>
				formatGoogleChatPerson(
					name || fallback,
					sendOnlyNames ? undefined : chatId,
				);

			// Note: Legacy variable `messageText` fully removed in favor of `builtMessage`.
			if (customMessage && customMessage.trim().length > 0) {
				// If a Chat ID exists but caller requested names only, override to allow tagging
				if (reviewerChatId && sendOnlyNames) {
					sendOnlyNames = false;
				}
				// Replace handlebars placeholders with actual values
				let base = customMessage.trim();
				const reviewerMention = formatPerson(
					reviewerName,
					reviewerChatId,
					reviewerName || "Reviewer",
				);
				const assignerMention = formatPerson(
					resolvedAssignerName,
					assignerChatId,
					"Someone",
				);

				// Sanitization: remove any exclamation mark immediately after a user mention token
				// e.g. <users/12345>! -> <users/12345>
				base = base.replace(/(<users\/[^>]+>)!/g, "$1");

				builtMessage = base
					.replace(/{{\s*reviewer_name\s*}}/gi, reviewerMention)
					.replace(/{{\s*requester_name\s*}}/gi, assignerMention);
			} else {
				// Import translations dynamically based on locale
				const messages = await import(`../messages/${locale}.json`);
				const t = messages.default || messages;

				const reviewerMention = formatPerson(
					reviewerName,
					reviewerChatId,
					reviewerName || "Reviewer",
				);
				const assignerMention = resolvedAssignerName
					? formatPerson(
							resolvedAssignerName,
							assignerChatId,
							resolvedAssignerName,
						)
					: null;

				const greetingText = t.googleChat.greeting.replace(
					"{reviewer}",
					reviewerMention,
				);

				builtMessage = greetingText;

				if (assignerMention) {
					const assignmentText = t.googleChat.assignmentMessage.replace(
						"{assigner}",
						assignerMention,
					);
					builtMessage += `\n${assignmentText}`;
				} else {
					const assignmentText = t.googleChat.assignmentMessage.replace(
						"{assigner}",
						"Someone",
					);
					builtMessage += `\n${assignmentText}`;
				}
			}

			builtMessage = prependUrgentNotice(
				stripPrLinkPlaceholders(builtMessage),
				locale,
				urgent,
			);

			const delivery = await deliverChatMessageToTargets({
				targets: webhookTargets,
				baseMessage: builtMessage,
				sourceTeamName,
				locale,
				prUrl,
				contextUrl,
				urgent,
				cardId: "pr-assignment-card",
			});

			const deliveryProblems = describeChatDeliveryProblems(
				delivery.failures,
				missingWebhookSlugs,
			);

			if (delivery.deliveredSlugs.length === 0) {
				return {
					success: false,
					error:
						deliveryProblems || "Google Chat message could not be delivered",
				};
			}

			if (reviewerEmail.trim()) {
				await persistAssignmentChatThreadLinks(ctx, {
					teamSlug,
					prUrl: normalizedPrUrl,
					reviewerEmails: [reviewerEmail],
					delivery,
				});
			}

			// Fire and forget logging of the message (keep last 3)
			try {
				await ctx.runMutation(api.mutations.logSentMessage, {
					text: builtMessage,
					reviewerName,
					reviewerEmail,
					assignerName,
					assignerEmail,
					prUrl,
					teamSlug,
					locale,
					isCustom: Boolean(customMessage && customMessage.trim().length > 0),
				});
			} catch (e) {
				console.warn("Failed to log debug message", e);
			}

			// Also send PWA push notification to the assignee (fire and forget)
			try {
				await ctx.runAction(api.pushActions.sendPushNotification, {
					email: reviewerEmail,
					title: "📋 Nueva asignación de PR",
					body: assignerName
						? `${assignerName} te ha asignado un PR para revisar`
						: "Te han asignado un PR para revisar",
					url: prUrl,
					tag: "pr-assignment",
				});
			} catch (e) {
				console.warn("Failed to send PWA push notification", e);
			}

			if (deliveryProblems) {
				return {
					success: false,
					error: describePartialChatDelivery(
						delivery.deliveredSlugs,
						deliveryProblems,
					),
				};
			}

			return { success: true };
		} catch (error) {
			console.error("Error sending Google Chat message:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// Google Chat integration for group assignments
export const sendGoogleChatGroupMessage = action({
	args: {
		reviewers: v.array(
			v.object({
				name: v.string(),
				email: v.string(),
				reviewerChatId: v.optional(v.string()),
			}),
		),
		prUrl: v.string(),
		contextUrl: v.optional(v.string()),
		locale: v.optional(v.string()),
		assignerEmail: v.optional(v.string()),
		assignerName: v.optional(v.string()),
		assignerChatId: v.optional(v.string()),
		teamSlug: v.string(),
		broadcastTeamSlugs: v.optional(v.array(v.string())),
		customMessage: v.optional(v.string()),
		urgent: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		{
			reviewers,
			prUrl,
			contextUrl,
			locale = "es",
			assignerEmail,
			assignerName,
			assignerChatId,
			teamSlug,
			broadcastTeamSlugs,
			customMessage,
			urgent = false,
		},
	): Promise<{ success: boolean; error?: string }> => {
		if (reviewers.length === 0) {
			return { success: false, error: "No reviewers provided" };
		}

		assignerChatId = assignerChatId?.trim() || undefined;
		const normalizedReviewers = reviewers.map((reviewer) => ({
			...reviewer,
			reviewerChatId: reviewer.reviewerChatId?.trim() || undefined,
		}));

		const { targets: webhookTargets, missingWebhookSlugs } =
			await resolveWebhookTargets(ctx, teamSlug, broadcastTeamSlugs);
		const sourceTeamName =
			webhookTargets.find((target) => target.slug === teamSlug)?.name ||
			teamSlug;

		if (webhookTargets.length === 0) {
			return {
				success: false,
				error:
					describeChatDeliveryProblems([], missingWebhookSlugs) ||
					"Google Chat webhook URL not configured for this team",
			};
		}

		try {
			const normalizedPrUrl = prUrl.trim();
			const resolvedAssigner = await resolveAssignerDisplayNameForChat(ctx, {
				assignerName,
				assignerEmail,
				teamSlug,
			});
			const resolvedAssignerName = resolvedAssigner.name;
			assignerChatId = assignerChatId || resolvedAssigner.chatId;

			const reviewerList = normalizedReviewers
				.map((reviewer) =>
					formatGoogleChatPerson(
						reviewer.name || reviewer.email,
						reviewer.reviewerChatId,
					),
				)
				.join(", ");
			const assignerComposite = resolvedAssignerName
				? formatGoogleChatPerson(resolvedAssignerName, assignerChatId)
				: "Someone";

			const isSpanish = locale.startsWith("es");
			let builtMessage = "";
			if (customMessage && customMessage.trim().length > 0) {
				const base = customMessage.trim().replace(/(<users\/[^>]+>)!/g, "$1");
				builtMessage = base
					.replace(/{{\s*reviewer_name\s*}}/gi, reviewerList)
					.replace(/{{\s*requester_name\s*}}/gi, assignerComposite);
			} else {
				builtMessage = isSpanish
					? `Hola ${reviewerList} 👋\n${assignerComposite} les ha asignado esta revisión`
					: `Hello ${reviewerList} 👋\n${assignerComposite} has assigned all of you this review`;
			}
			builtMessage = prependUrgentNotice(
				stripPrLinkPlaceholders(builtMessage),
				locale,
				urgent,
			);

			const delivery = await deliverChatMessageToTargets({
				targets: webhookTargets,
				baseMessage: builtMessage,
				sourceTeamName,
				locale,
				prUrl,
				contextUrl,
				urgent,
				cardId: "pr-assignment-batch-card",
			});
			const deliveryProblems = describeChatDeliveryProblems(
				delivery.failures,
				missingWebhookSlugs,
			);

			if (delivery.deliveredSlugs.length === 0) {
				return {
					success: false,
					error:
						deliveryProblems || "Google Chat message could not be delivered",
				};
			}

			await persistAssignmentChatThreadLinks(ctx, {
				teamSlug,
				prUrl: normalizedPrUrl,
				reviewerEmails: normalizedReviewers.map((reviewer) => reviewer.email),
				delivery,
			});

			try {
				await ctx.runMutation(api.mutations.logSentMessage, {
					text: builtMessage,
					reviewerName: normalizedReviewers.map((r) => r.name).join(", "),
					reviewerEmail: normalizedReviewers.map((r) => r.email).join(", "),
					assignerName,
					assignerEmail,
					prUrl,
					teamSlug,
					locale,
					isCustom: Boolean(customMessage && customMessage.trim().length > 0),
				});
			} catch (e) {
				console.warn("Failed to log debug message", e);
			}

			try {
				const uniqueEmails = [
					...new Set(normalizedReviewers.map((r) => r.email)),
				];
				await ctx.runAction(api.pushActions.sendPushToParticipants, {
					emails: uniqueEmails,
					title: isSpanish
						? "📋 Nuevas asignaciones de PR"
						: "📋 New PR assignments",
					body: assignerName
						? isSpanish
							? `${assignerName} les asignó PRs para revisar`
							: `${assignerName} assigned PRs for review`
						: isSpanish
							? "Tienen PRs asignados para revisar"
							: "You have PRs assigned for review",
					url: prUrl,
					tag: "pr-assignment-batch",
				});
			} catch (e) {
				console.warn("Failed to send PWA batch push notification", e);
			}

			if (deliveryProblems) {
				return {
					success: false,
					error: describePartialChatDelivery(
						delivery.deliveredSlugs,
						deliveryProblems,
					),
				};
			}

			return { success: true };
		} catch (error) {
			console.error("Error sending Google Chat group message:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

const agentAssignmentChatReviewerValidator = v.object({
	name: v.string(),
	email: v.string(),
	reviewerChatId: v.optional(v.string()),
});

const agentAssignmentChatResultValidator = v.object({
	success: v.boolean(),
	error: v.optional(v.string()),
});

export const sendAgentAssignmentGoogleChat = internalAction({
	args: {
		reviewers: v.array(agentAssignmentChatReviewerValidator),
		prUrl: v.string(),
		contextUrl: v.optional(v.string()),
		locale: v.optional(v.string()),
		assignerEmail: v.optional(v.string()),
		assignerName: v.optional(v.string()),
		assignerChatId: v.optional(v.string()),
		teamSlug: v.string(),
		broadcastTeamSlugs: v.optional(v.array(v.string())),
		urgent: v.optional(v.boolean()),
	},
	returns: agentAssignmentChatResultValidator,
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		try {
			if (args.reviewers.length === 0) {
				return { success: false, error: "No reviewers provided" };
			}

			if (args.reviewers.length === 1) {
				const reviewer = args.reviewers[0];
				if (!reviewer) {
					return { success: false, error: "No reviewers provided" };
				}
				return await ctx.runAction(api.actions.sendGoogleChatMessage, {
					reviewerName: reviewer.name,
					reviewerEmail: reviewer.email,
					prUrl: args.prUrl,
					teamSlug: args.teamSlug,
					...(reviewer.reviewerChatId
						? { reviewerChatId: reviewer.reviewerChatId }
						: {}),
					...(args.contextUrl ? { contextUrl: args.contextUrl } : {}),
					...(args.locale ? { locale: args.locale } : {}),
					...(args.assignerEmail ? { assignerEmail: args.assignerEmail } : {}),
					...(args.assignerName ? { assignerName: args.assignerName } : {}),
					...(args.assignerChatId
						? { assignerChatId: args.assignerChatId }
						: {}),
					...(args.broadcastTeamSlugs?.length
						? { broadcastTeamSlugs: args.broadcastTeamSlugs }
						: {}),
					...(args.urgent ? { urgent: args.urgent } : {}),
				});
			}

			return await ctx.runAction(api.actions.sendGoogleChatGroupMessage, {
				reviewers: args.reviewers,
				prUrl: args.prUrl,
				teamSlug: args.teamSlug,
				...(args.contextUrl ? { contextUrl: args.contextUrl } : {}),
				...(args.locale ? { locale: args.locale } : {}),
				...(args.assignerEmail ? { assignerEmail: args.assignerEmail } : {}),
				...(args.assignerName ? { assignerName: args.assignerName } : {}),
				...(args.assignerChatId ? { assignerChatId: args.assignerChatId } : {}),
				...(args.broadcastTeamSlugs?.length
					? { broadcastTeamSlugs: args.broadcastTeamSlugs }
					: {}),
				...(args.urgent ? { urgent: args.urgent } : {}),
			});
		} catch (error) {
			console.error("Agent assignment Google Chat failed:", error);
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Google Chat notification failed",
			};
		}
	},
});

// Action to force assign a PR to a specific reviewer
export const forceAssignPR = action({
	args: {
		reviewerId: v.id("reviewers"),
		prUrl: v.optional(v.string()),
		actionByReviewerId: v.optional(v.id("reviewers")),
	},
	handler: async (
		ctx,
		{ reviewerId, prUrl, actionByReviewerId },
	): Promise<{ success: boolean; reviewerId?: string; error?: string }> => {
		// Use the mutation to assign the PR
		const result = await ctx.runMutation(api.mutations.assignPR, {
			reviewerId,
			forced: true,
			prUrl,
			actionByReviewerId,
		});

		return result;
	},
});

// Action to assign PR by tag
export const assignPRByTag = action({
	args: {
		teamSlug: v.string(),
		tagId: v.id("tags"),
		actionByReviewerId: v.optional(v.id("reviewers")),
	},
	handler: async (
		ctx,
		{ teamSlug, tagId, actionByReviewerId },
	): Promise<{
		success: boolean;
		reviewer?: Reviewer;
		error?: string;
	}> => {
		// Get next reviewer by tag
		const nextReviewer = await ctx.runQuery(api.queries.getNextReviewerByTag, {
			teamSlug,
			tagId,
		});

		if (!nextReviewer) {
			return { success: false };
		}

		// Assign the PR to that reviewer
		const result = await ctx.runMutation(api.mutations.assignPR, {
			reviewerId: nextReviewer._id,
			tagId,
			actionByReviewerId,
		});

		return {
			success: result.success,
			reviewer: nextReviewer,
		};
	},
});

// Action to skip to next reviewer
export const skipToNextReviewer = action({
	args: {
		teamSlug: v.string(),
		currentNextId: v.id("reviewers"),
	},
	handler: async (
		ctx,
		{ teamSlug, currentNextId },
	): Promise<{ success: boolean; nextReviewer?: Reviewer }> => {
		// Get all reviewers
		const reviewers = await ctx.runQuery(api.queries.getReviewers, {
			teamSlug,
		});

		// Filter out absent / out-of-pool reviewers and the current next reviewer
		const availableReviewers = reviewers.filter(
			(reviewer) =>
				reviewer.excludedFromReviewPool !== true &&
				!reviewer.effectiveIsAbsent &&
				reviewer._id !== currentNextId,
		);

		if (availableReviewers.length === 0) {
			return { success: false };
		}

		// Find the minimum assignment count among available reviewers
		const minCount = Math.min(
			...availableReviewers.map((r) => r.assignmentCount),
		);

		// Get all available reviewers with the minimum count
		const candidatesWithMinCount = availableReviewers.filter(
			(r) => r.assignmentCount === minCount,
		);

		// Sort by creation time (older first)
		const sortedCandidates = [...candidatesWithMinCount].sort(
			(a, b) => a.createdAt - b.createdAt,
		);

		// Select the first one
		const nextReviewer = sortedCandidates[0];

		if (!nextReviewer) {
			return { success: false };
		}

		return { success: true, nextReviewer };
	},
});

// ============================================
// EVENT ACTIONS
// ============================================

// Send event invite to Google Chat with join link
export const sendEventInvite = action({
	args: {
		eventId: v.id("events"),
		teamSlug: v.string(),
		appBaseUrl: v.string(), // e.g., "https://app.example.com"
		locale: v.optional(v.string()),
		formattedDate: v.string(), // Pre-formatted date from client (respects user's timezone)
		formattedTime: v.string(), // Pre-formatted time from client (respects user's timezone)
	},
	handler: async (
		ctx,
		{
			eventId,
			teamSlug,
			appBaseUrl,
			locale = "es",
			formattedDate,
			formattedTime,
		},
	): Promise<{ success: boolean; error?: string }> => {
		// Get event details
		const event = await ctx.runQuery(api.queries.getEventById, { eventId });
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		// Get team for webhook URL
		const team = await ctx.runQuery(api.queries.getTeam, { teamSlug });
		const webhookUrl = team?.googleChatWebhookUrl?.trim();

		if (!webhookUrl) {
			return {
				success: false,
				error: "Google Chat webhook URL not configured",
			};
		}

		try {
			// Use the pre-formatted date and time from client
			const dateStr = formattedDate;
			const timeStr = formattedTime;

			// Build join URL
			const joinUrl = `${appBaseUrl}/${locale}/${teamSlug}/events/${eventId}/join`;

			// Build the message - always in Spanish
			const messages = {
				title: "📅 Nuevo Evento",
				createdBy: "Creado por",
				scheduledFor: "Programado para",
				at: "a las",
				joinPrompt: "¿Vas a participar? Haz clic aquí para confirmar:",
				joinButton: "Voy a participar",
			};

			const messageText = `*${messages.title}: ${event.title}*\n\n${
				event.description ? `${event.description}\n\n` : ""
			}${messages.createdBy}: ${event.createdBy.name}\n${messages.scheduledFor}: ${dateStr} ${messages.at} ${timeStr}\n\n${messages.joinPrompt}`;

			const message = {
				text: messageText,
				cardsV2: [
					{
						cardId: "event-invite-card",
						card: {
							sections: [
								{
									widgets: [
										{
											buttonList: {
												buttons: [
													{
														text: messages.joinButton,
														onClick: {
															openLink: {
																url: joinUrl,
															},
														},
													},
												],
											},
										},
									],
								},
							],
						},
					},
				],
			};

			const response = await fetch(webhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(message),
			});

			if (!response.ok) {
				return {
					success: false,
					error: `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			// Mark invite as sent
			await ctx.runMutation(api.mutations.markEventInviteSent, { eventId });

			return { success: true };
		} catch (error) {
			console.error("Error sending event invite:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// Send event start notification tagging all participants
export const sendEventStartNotification = action({
	args: {
		eventId: v.id("events"),
		teamSlug: v.string(),
		locale: v.optional(v.string()), // kept for backwards compatibility but not used
	},
	handler: async (
		ctx,
		{ eventId, teamSlug },
	): Promise<{ success: boolean; error?: string }> => {
		// Get event details
		const event = await ctx.runQuery(api.queries.getEventById, { eventId });
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		// Get team for webhook URL
		const team = await ctx.runQuery(api.queries.getTeam, { teamSlug });
		const webhookUrl = team?.googleChatWebhookUrl?.trim();

		let notificationError: string | undefined;

		if (webhookUrl) {
			try {
				// Messages always in Spanish
				const messages = {
					started: "🚀 ¡El evento ha comenzado!",
					participants: "Participantes",
					noParticipants: "No hay participantes confirmados",
				};

				// Build participant mentions
				let participantMentions = "";
				if (event.participants.length > 0) {
					participantMentions = event.participants
						.map((p) => formatGoogleChatPerson(p.name, p.googleChatUserId))
						.join(", ");
				} else {
					participantMentions = messages.noParticipants;
				}

				const messageText = `*${messages.started}*\n\n*${event.title}*\n\n${messages.participants}: ${participantMentions}`;

				const message = {
					text: messageText,
				};

				const response = await fetch(webhookUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(message),
				});

				if (!response.ok) {
					notificationError = `HTTP ${response.status}: ${response.statusText}`;
				} else {
					await ctx.runMutation(api.mutations.markEventStartNotificationSent, {
						eventId,
					});
				}
			} catch (error) {
				notificationError =
					error instanceof Error ? error.message : "Unknown notification error";
			}
		} else {
			notificationError = "Google Chat webhook URL not configured";
		}

		const startResult = await ctx.runMutation(api.mutations.startEvent, {
			eventId,
		});
		if (!startResult.success) {
			return {
				success: false,
				error: startResult.error || notificationError,
			};
		}

		// Send PWA push notifications to all participants (fire and forget)
		if (event.participants.length > 0) {
			try {
				const participantEmails = event.participants.map((p) => p.email);
				await ctx.runAction(api.pushActions.sendPushToParticipants, {
					emails: participantEmails,
					title: `🚀 ${event.title}`,
					body: "¡El evento ha comenzado!",
					url: `/`, // Could be enhanced to link to event page
					tag: `event-${eventId}`,
				});
			} catch (e) {
				console.warn("Failed to send PWA push to participants", e);
			}
		}

		if (notificationError) {
			console.warn(
				`Event ${eventId} started without Google Chat notification: ${notificationError}`,
			);
		}

		return { success: true };
	},
});

// Process events that need start notifications (called by cron)
export const processEventStartNotifications = action({
	args: {},
	handler: async (ctx): Promise<{ processed: number; errors: string[] }> => {
		const events = await ctx.runQuery(
			api.queries.getEventsNeedingStartNotification,
			{},
		);

		const errors: string[] = [];
		let processed = 0;

		for (const event of events) {
			// Get team slug for this event
			const team = await ctx.runQuery(api.queries.getTeams, {});
			const eventTeam = team.find((t) => t._id === event.teamId);

			if (!eventTeam) {
				errors.push(`Team not found for event ${event._id}`);
				continue;
			}

			const result = await ctx.runAction(
				api.actions.sendEventStartNotification,
				{
					eventId: event._id,
					teamSlug: eventTeam.slug,
					locale: "es",
				},
			);

			if (result.success) {
				processed++;
			} else {
				errors.push(`Event ${event._id}: ${result.error}`);
			}
		}

		return { processed, errors };
	},
});

// Flash assign: one-click round-robin assignment + Google Chat notification.
// Used by the Chrome extension's content script button injected into GitHub PR pages.
export const flashAssign = action({
	args: {
		teamSlug: v.string(),
		prUrl: v.string(),
		force: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		{ teamSlug, prUrl, force = false },
	): Promise<{
		success: boolean;
		reviewerName?: string;
		alreadyAssigned?: boolean;
		existingReviewerName?: string;
		existingTimestamp?: number;
		error?: string;
	}> => {
		// 1. Authenticate the caller
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { success: false, error: "Not authenticated" };
		}
		const assignerEmail = identity.email;
		if (!assignerEmail) {
			return { success: false, error: "No email found in auth identity" };
		}

		// 2. Check if the PR is already assigned (unless force=true)
		if (!force) {
			const existing = await ctx.runQuery(api.queries.checkPRAlreadyAssigned, {
				teamSlug,
				prUrl,
			});
			if (existing) {
				return {
					success: false,
					alreadyAssigned: true,
					existingReviewerName: existing.reviewerName,
					existingTimestamp: existing.timestamp,
				};
			}
		}

		// 3. Get the next reviewer via round-robin
		const nextReviewer = (await ctx.runQuery(api.queries.getNextReviewer, {
			teamSlug,
		})) as Reviewer | null;
		if (!nextReviewer) {
			return { success: false, error: "No hay revisores disponibles" };
		}

		// 4. Find the assigner's reviewer record across teams
		const assigner = await ctx.runQuery(
			internal.queries.getReviewerByEmailAnyTeam,
			{
				email: assignerEmail,
				preferredTeamSlug: teamSlug,
			},
		);

		// 5. Assign the PR
		await ctx.runMutation(api.mutations.assignPR, {
			reviewerId: nextReviewer._id,
			prUrl,
			forced: false,
			actionByReviewerId: assigner?._id,
		});

		// 6. Create active PR assignment if assigner is identified
		if (assigner) {
			try {
				await ctx.runMutation(api.mutations.createActivePRAssignment, {
					teamSlug,
					assigneeId: nextReviewer._id,
					assignerId: assigner._id,
					prUrl,
				});
			} catch (e) {
				console.warn("Failed to create active PR assignment", e);
			}
		}

		// 7. Send Google Chat notification
		const team = await ctx.runQuery(api.queries.getTeam, { teamSlug });
		const webhookUrl = team?.googleChatWebhookUrl?.trim();

		if (webhookUrl) {
			try {
				const reviewerChatId =
					nextReviewer.googleChatUserId?.trim() || undefined;
				const assignerChatId = assigner?.googleChatUserId?.trim() || undefined;

				const reviewerComposite = formatGoogleChatPerson(
					nextReviewer.name,
					reviewerChatId,
				);
				const assignerComposite = assigner
					? formatGoogleChatPerson(assigner.name, assignerChatId)
					: assignerEmail;

				// Use Spanish default template (extension UI is in Spanish)
				const messages = await import("../messages/es.json");
				const t = messages.default || messages;

				const greetingText = t.googleChat.greeting.replace(
					"{reviewer}",
					reviewerComposite,
				);
				const assignmentText = t.googleChat.assignmentMessage.replace(
					"{assigner}",
					assignerComposite,
				);

				const builtMessage = stripPrLinkPlaceholders(
					`${greetingText}\n${assignmentText}`,
				);

				const delivery = await deliverChatMessageToTargets({
					targets: [
						{
							slug: teamSlug,
							name: team?.name?.trim() || teamSlug,
							webhookUrl,
							isExternalTarget: false,
						},
					],
					baseMessage: builtMessage,
					sourceTeamName: team?.name?.trim() || teamSlug,
					locale: "es",
					prUrl,
					urgent: false,
					cardId: "pr-assignment-card",
				});

				if (delivery.failures.length > 0) {
					console.warn(
						`Google Chat webhook failed: ${delivery.failures.join("; ")}`,
					);
				}

				if (prUrl.trim() && nextReviewer.email.trim()) {
					await persistAssignmentChatThreadLinks(ctx, {
						teamSlug,
						prUrl: prUrl.trim(),
						reviewerEmails: [nextReviewer.email],
						delivery,
					});
				}

				// Log the sent message (fire and forget)
				try {
					await ctx.runMutation(api.mutations.logSentMessage, {
						text: builtMessage,
						reviewerName: nextReviewer.name,
						reviewerEmail: nextReviewer.email,
						assignerName: assigner?.name,
						assignerEmail,
						prUrl,
						teamSlug,
						locale: "es",
						isCustom: false,
					});
				} catch (e) {
					console.warn("Failed to log debug message", e);
				}

				// Send PWA push notification (fire and forget)
				try {
					await ctx.runAction(api.pushActions.sendPushNotification, {
						email: nextReviewer.email,
						title: "📋 Nueva asignación de PR",
						body: assigner
							? `${assigner.name} te ha asignado un PR para revisar`
							: "Te han asignado un PR para revisar",
						url: prUrl,
						tag: "pr-assignment",
					});
				} catch (e) {
					console.warn("Failed to send PWA push notification", e);
				}
			} catch (e) {
				console.warn("Failed to send Google Chat notification", e);
			}
		}

		return { success: true, reviewerName: nextReviewer.name };
	},
});

// Check if a PR has been previously assigned
export const checkPRAlreadyAssigned = action({
	args: { teamSlug: v.string(), prUrl: v.string() },
	handler: async (
		ctx,
		{ teamSlug, prUrl },
	): Promise<{
		reviewerName: string;
		reviewerNames?: string[];
		timestamp: number;
	} | null> => {
		const result = await ctx.runQuery(api.queries.checkPRAlreadyAssigned, {
			teamSlug,
			prUrl,
		});
		return result;
	},
});
