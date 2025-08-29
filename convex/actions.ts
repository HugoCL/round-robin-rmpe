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
		locale: v.optional(v.string()),
		assignerEmail: v.optional(v.string()),
		assignerName: v.optional(v.string()),
		assignerChatId: v.optional(v.string()),
		teamSlug: v.optional(v.string()),
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
			locale = "en",
			assignerEmail,
			assignerName,
			assignerChatId,
			teamSlug,
			sendOnlyNames = false,
			customMessage,
		},
	) => {
		const GOOGLE_CHAT_WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK_URL;

		if (!GOOGLE_CHAT_WEBHOOK_URL) {
			return {
				success: false,
				error: "Google Chat webhook URL not configured",
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
					assignerChatId = assigner?.googleChatUserId || undefined;
				} catch (e) {
					console.warn("Failed to lookup assignerChatId server-side", e);
				}
			}
			let messageText: string;

			if (customMessage && customMessage.trim().length > 0) {
				// If a Chat ID exists but caller requested names only, override to allow tagging
				if (reviewerChatId && sendOnlyNames) {
					sendOnlyNames = false;
				}
				// Replace handlebars placeholders with actual values / formatted link
				let base = customMessage.trim();
				// Prefer explicit Chat user ID if provided
				// Build mentions: only use Chat user ID mention if present; otherwise plain name
				const reviewerMention =
					reviewerChatId && !sendOnlyNames
						? `<users/${reviewerChatId}>`
						: reviewerName;

				const assignerMention =
					assignerChatId && !sendOnlyNames
						? `<users/${assignerChatId}>`
						: assignerName?.trim()
							? assignerName
							: assignerEmail?.trim()
								? assignerEmail
								: "Someone";

				// Google Chat link style: <url|PR>
				const prLinked = `<${prUrl}|PR>`;

				// If user forgot to include any reviewer placeholder and we have a chat id and tagging is enabled, inject mention once at start
				if (
					reviewerChatId &&
					!sendOnlyNames &&
					!/\{\{\s*reviewer_name\s*\}\}/i.test(base) &&
					!base.includes(reviewerMention) &&
					!/<users\//.test(base)
				) {
					base = `${reviewerMention} ${base}`;
				}

				// Replace new link placeholder pattern before legacy ones
				const replaced = base
					.replace(/<URL_PLACEHOLDER\|PR>/g, `<${prUrl}|PR>`)
					.replace(/{{\s*reviewer_name\s*}}/gi, reviewerMention)
					.replace(/{{\s*requester_name\s*}}/gi, assignerMention)
					.replace(/{{\s*pr\s*}}/gi, prLinked)
					.replace(/{{\s*PR\s*}}/g, prLinked);
				// Remove redundant preceding 'PR' if user wrote 'PR: {{PR}}' or 'PR {{PR}}'
				messageText = replaced.replace(/\bPR:?\s*(<[^>]+\|PR>)/g, "$1");
			} else {
				// Import translations dynamically based on locale
				const messages = await import(`../messages/${locale}.json`);
				const t = messages.default || messages;

				// Create mentions - use names if sendOnlyNames is true, otherwise use email format
				const reviewerMention =
					reviewerChatId && !sendOnlyNames
						? `<users/${reviewerChatId}>`
						: reviewerName;
				const assignerMention =
					assignerChatId && !sendOnlyNames
						? `<users/${assignerChatId}>`
						: assignerName?.trim()
							? assignerName
							: assignerEmail?.trim()
								? assignerEmail
								: null;

				// Build the message with proper mentions using i18n
				const greetingText = t.googleChat.greeting.replace(
					"{reviewer}",
					reviewerMention,
				);

				messageText = greetingText;

				if (assignerMention) {
					const assignmentText = t.googleChat.assignmentMessage
						.replace("{assigner}", assignerMention)
						.replace("{prUrl}", prUrl);
					messageText += `\n${assignmentText}`;
				} else {
					// Fallback when no assigner is provided
					const assignmentText = t.googleChat.assignmentMessage
						.replace("{assigner}", "Someone")
						.replace("{prUrl}", prUrl);
					messageText += `\n${assignmentText}`;
				}
			}

			const message = {
				text: messageText,
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
		{ reviewerId, actionBy },
	): Promise<{ success: boolean; reviewerId?: string; error?: string }> => {
		// Use the mutation to assign the PR
		const result = await ctx.runMutation(api.mutations.assignPR, {
			reviewerId,
			forced: true,
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
