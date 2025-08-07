import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Google Chat integration action
export const sendGoogleChatMessage = action({
    args: {
        reviewerName: v.string(),
        reviewerEmail: v.string(),
        prUrl: v.string(),
        locale: v.optional(v.string()),
        assignerEmail: v.optional(v.string()),
        assignerName: v.optional(v.string()),
        sendOnlyNames: v.optional(v.boolean()),
    },
    handler: async (_ctx, {
        reviewerName,
        reviewerEmail,
        prUrl,
        locale = 'en',
        assignerEmail,
        assignerName,
        sendOnlyNames = true
    }) => {
        const GOOGLE_CHAT_WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK_URL;

        if (!GOOGLE_CHAT_WEBHOOK_URL) {
            return {
                success: false,
                error: "Google Chat webhook URL not configured"
            };
        }

        try {
            // Import translations dynamically based on locale
            const messages = await import(`../messages/${locale}.json`);
            const t = messages.default || messages;

            // Create mentions - use names if sendOnlyNames is true, otherwise use email format
            const reviewerMention = sendOnlyNames ? reviewerName : `<users/${reviewerEmail}>`;
            const assignerMention = (assignerEmail || assignerName) ?
                (sendOnlyNames ? (assignerName || 'Unknown') : `<users/${assignerEmail}>`) : null;

            // Build the message with proper mentions using i18n
            const greetingText = t.googleChat.greeting.replace('{reviewer}', reviewerMention);

            let messageText = greetingText;

            if (assignerMention) {
                const assignmentText = t.googleChat.assignmentMessage
                    .replace('{assigner}', assignerMention)
                    .replace('{prUrl}', prUrl);
                messageText += `\n${assignmentText}`;
            } else {
                // Fallback when no assigner is provided
                const assignmentText = t.googleChat.assignmentMessage
                    .replace('{assigner}', 'Someone')
                    .replace('{prUrl}', prUrl);
                messageText += `\n${assignmentText}`;
            }

            const message = {
                text: messageText,
                thread: { threadKey: "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD " }
            };

            const response = await fetch(GOOGLE_CHAT_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });

            if (!response.ok) {
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error sending Google Chat message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },
});

// Action to force assign a PR to a specific reviewer
export const forceAssignPR = action({
    args: {
        reviewerId: v.id("reviewers"),
        actionBy: v.optional(v.object({
            email: v.string(),
            firstName: v.optional(v.string()),
            lastName: v.optional(v.string()),
        })),
    },
    handler: async (ctx, { reviewerId, actionBy }): Promise<{ success: boolean; reviewerId?: string; error?: string }> => {
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
        tagId: v.id("tags"),
        actionBy: v.optional(v.object({
            email: v.string(),
            firstName: v.optional(v.string()),
            lastName: v.optional(v.string()),
        })),
    },
    handler: async (ctx, { tagId, actionBy }): Promise<{ success: boolean; reviewer?: Doc<"reviewers">; error?: string }> => {
        // Get next reviewer by tag
        const nextReviewer = await ctx.runQuery(api.queries.getNextReviewerByTag, { tagId });

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
        currentNextId: v.id("reviewers"),
    },
    handler: async (ctx, { currentNextId }): Promise<{ success: boolean; nextReviewer?: Doc<"reviewers"> }> => {
        // Get all reviewers
        const reviewers = await ctx.runQuery(api.queries.getReviewers, {});

        // Filter out absent reviewers and the current next reviewer
        const availableReviewers = reviewers.filter(
            (r) => !r.isAbsent && r._id !== currentNextId
        );

        if (availableReviewers.length === 0) {
            return { success: false };
        }

        // Find the minimum assignment count among available reviewers
        const minCount = Math.min(
            ...availableReviewers.map((r) => r.assignmentCount)
        );

        // Get all available reviewers with the minimum count
        const candidatesWithMinCount = availableReviewers.filter(
            (r) => r.assignmentCount === minCount
        );

        // Sort by creation time (older first)
        const sortedCandidates = [...candidatesWithMinCount].sort(
            (a, b) => a.createdAt - b.createdAt
        );

        // Select the first one
        const nextReviewer = sortedCandidates[0];

        if (!nextReviewer) {
            return { success: false };
        }

        return { success: true, nextReviewer };
    },
});
