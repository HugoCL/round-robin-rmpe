import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action } from "./_generated/server";

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
		sendOnlyNames: v.optional(v.boolean()),
		// If provided, this message text will be sent as-is (no template building)
		customMessage: v.optional(v.string()),
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
			sendOnlyNames = false,
			customMessage,
		},
	): Promise<{ success: boolean; error?: string }> => {
		// Normalize / sanitize potentially empty or whitespace chat IDs early to avoid rendering `<users/>`
		reviewerChatId = reviewerChatId?.trim() || undefined;
		assignerChatId = assignerChatId?.trim() || undefined;

		// Fetch team-specific webhook URL from database
		const team = (await ctx.runQuery(api.queries.getTeam, { teamSlug })) as {
			googleChatWebhookUrl?: string;
		} | null;
		const GOOGLE_CHAT_WEBHOOK_URL = team?.googleChatWebhookUrl?.trim();

		if (!GOOGLE_CHAT_WEBHOOK_URL) {
			return {
				success: false,
				error: "Google Chat webhook URL not configured for this team",
			};
		}

		try {
			// If no assignerChatId provided by client but we have email + teamSlug, attempt server-side lookup
			if (!assignerChatId && assignerEmail && teamSlug) {
				try {
					const reviewers = await ctx.runQuery(api.queries.getReviewers, {
						teamSlug,
					});
					const assigner = reviewers.find(
						(r) => r.email.toLowerCase() === assignerEmail.toLowerCase(),
					);
					assignerChatId = assigner?.googleChatUserId?.trim() || undefined;
				} catch (e) {
					console.warn("Failed to lookup assignerChatId server-side", e);
				}
			}
			let builtMessage = ""; // init to satisfy TS definite assignment

			// Build composite display: Name (@<users/ID>) so Google Chat shows both
			const buildComposite = (
				name: string | undefined,
				chatId: string | undefined,
				fallback: string,
			): { composite: string; rawMention: string | null } => {
				const resolvedName = name || fallback;
				if (sendOnlyNames || !chatId || !/\S/.test(chatId)) {
					return { composite: resolvedName, rawMention: null };
				}
				const raw = `<users/${chatId}>`;
				return { composite: `${resolvedName} (${raw})`, rawMention: raw };
			};

			// Note: Legacy variable `messageText` fully removed in favor of `builtMessage`.
			if (customMessage && customMessage.trim().length > 0) {
				// If a Chat ID exists but caller requested names only, override to allow tagging
				if (reviewerChatId && sendOnlyNames) {
					sendOnlyNames = false;
				}
				// Replace handlebars placeholders with actual values / formatted link
				let base = customMessage.trim();
				// Prefer explicit Chat user ID if provided
				// Build mentions: only use Chat user ID mention if present; otherwise plain name
				const reviewerComposite = buildComposite(
					reviewerName,
					reviewerChatId,
					reviewerName || "Reviewer",
				);
				const assignerComposite = buildComposite(
					assignerName?.trim() || assignerEmail?.trim(),
					assignerChatId,
					"Someone",
				);

				// Sanitization: remove any exclamation mark immediately after a user mention token
				// e.g. <users/12345>! -> <users/12345>
				base = base.replace(/(<users\/[^>]+>)!/g, "$1");

				// Google Chat link style: <url|PR>
				const prLinked = `<${prUrl}|PR>`;

				// If user forgot to include any reviewer placeholder and we have a chat id and tagging is enabled, inject mention once at start
				// No auto-injection now; rely on placeholders or user-provided formatting

				// Replace new link placeholder pattern before legacy ones
				const replaced = base
					.replace(/<URL_PLACEHOLDER\|PR>/g, `<${prUrl}|PR>`)
					.replace(/{{\s*reviewer_name\s*}}/gi, reviewerComposite.composite)
					.replace(/{{\s*requester_name\s*}}/gi, assignerComposite.composite)
					.replace(/{{\s*pr\s*}}/gi, prLinked)
					.replace(/{{\s*PR\s*}}/g, prLinked);
				// Remove redundant preceding 'PR' if user wrote 'PR: {{PR}}' or 'PR {{PR}}'
				builtMessage = replaced.replace(/\bPR:?\s*(<[^>]+\|PR>)/g, "$1");
			} else {
				// Import translations dynamically based on locale
				const messages = await import(`../messages/${locale}.json`);
				const t = messages.default || messages;

				// Create mentions - use names if sendOnlyNames is true, otherwise use email format
				const reviewerComposite = buildComposite(
					reviewerName,
					reviewerChatId,
					reviewerName || "Reviewer",
				);
				const assignerFallback =
					assignerName?.trim() || assignerEmail?.trim() || undefined;
				const assignerComposite = assignerFallback
					? buildComposite(assignerFallback, assignerChatId, assignerFallback)
					: null;

				// Build the message with proper mentions using i18n
				const greetingText = t.googleChat.greeting.replace(
					"{reviewer}",
					reviewerComposite.composite,
				);

				builtMessage = greetingText;

				if (assignerComposite) {
					const assignmentText = t.googleChat.assignmentMessage
						.replace("{assigner}", assignerComposite.composite)
						.replace("{prUrl}", prUrl);
					builtMessage += `\n${assignmentText}`;
				} else {
					// Fallback when no assigner is provided
					const assignmentText = t.googleChat.assignmentMessage
						.replace("{assigner}", "Someone")
						.replace("{prUrl}", prUrl);
					builtMessage += `\n${assignmentText}`;
				}
			}

			// builtMessage finalized

			// Build Google Chat card with buttons for PR and context
			const buttons = [
				{
					text: "Ver PR",
					onClick: {
						openLink: {
							url: prUrl,
						},
					},
				},
			];

			// Add context button if context URL is provided
			if (contextUrl?.trim()) {
				buttons.push({
					text: "Ver Contexto",
					onClick: {
						openLink: {
							url: contextUrl,
						},
					},
				});
			}

			const message = {
				text: builtMessage, // Show full message as text (with mentions working)
				cardsV2: [
					{
						cardId: "pr-assignment-card",
						card: {
							sections: [
								{
									widgets: [
										{
											buttonList: {
												buttons: buttons,
											},
										},
									],
								},
							],
						},
					},
				],
				thread: { threadKey: "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD " },
			};

			const response = await fetch(GOOGLE_CHAT_WEBHOOK_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(message),
			});

			if (!response.ok) {
				return {
					success: false,
					error: `HTTP ${response.status}: ${response.statusText}`,
				};
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

// Action to force assign a PR to a specific reviewer
export const forceAssignPR = action({
	args: {
		reviewerId: v.id("reviewers"),
		prUrl: v.optional(v.string()),
		actionBy: v.optional(
			v.object({
				email: v.string(),
				firstName: v.optional(v.string()),
				lastName: v.optional(v.string()),
			}),
		),
	},
	handler: async (
		ctx,
		{ reviewerId, prUrl, actionBy },
	): Promise<{ success: boolean; reviewerId?: string; error?: string }> => {
		// Use the mutation to assign the PR
		const result = await ctx.runMutation(api.mutations.assignPR, {
			reviewerId,
			forced: true,
			prUrl,
			actionBy,
		});

		return result;
	},
});

// Action to assign PR by tag
export const assignPRByTag = action({
	args: {
		teamSlug: v.string(),
		tagId: v.id("tags"),
		actionBy: v.optional(
			v.object({
				email: v.string(),
				firstName: v.optional(v.string()),
				lastName: v.optional(v.string()),
			}),
		),
	},
	handler: async (
		ctx,
		{ teamSlug, tagId, actionBy },
	): Promise<{
		success: boolean;
		reviewer?: Doc<"reviewers">;
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
			actionBy,
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
	): Promise<{ success: boolean; nextReviewer?: Doc<"reviewers"> }> => {
		// Get all reviewers
		const reviewers = await ctx.runQuery(api.queries.getReviewers, {
			teamSlug,
		});

		// Filter out absent reviewers and the current next reviewer
		const availableReviewers = reviewers.filter(
			(r) => !r.isAbsent && r._id !== currentNextId,
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

		if (!webhookUrl) {
			return {
				success: false,
				error: "Google Chat webhook URL not configured",
			};
		}

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
					.map((p) => {
						if (p.googleChatUserId?.trim()) {
							return `${p.name} (<users/${p.googleChatUserId}>)`;
						}
						return p.name;
					})
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
				return {
					success: false,
					error: `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			// Mark start notification as sent and update status
			await ctx.runMutation(api.mutations.markEventStartNotificationSent, {
				eventId,
			});
			await ctx.runMutation(api.mutations.startEvent, { eventId });

			return { success: true };
		} catch (error) {
			console.error("Error sending event start notification:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
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
