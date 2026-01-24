"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

// Helper to configure webpush with VAPID keys
function configureWebPush() {
	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	const email = process.env.VAPID_EMAIL || "mailto:admin@example.com";

	if (!publicKey || !privateKey) {
		return false;
	}

	webpush.setVapidDetails(email, publicKey, privateKey);
	return true;
}

// Send push notification to a specific user by email
export const sendPushNotification = action({
	args: {
		email: v.string(),
		title: v.string(),
		body: v.string(),
		url: v.optional(v.string()),
		icon: v.optional(v.string()),
		tag: v.optional(v.string()),
	},
	handler: async (
		ctx,
		{ email, title, body, url, icon, tag },
	): Promise<{ success: boolean; sent: number; errors: string[] }> => {
		if (!configureWebPush()) {
			return {
				success: false,
				sent: 0,
				errors: ["VAPID keys not configured"],
			};
		}

		// Get all subscriptions for this email
		const subscriptions = await ctx.runMutation(
			api.mutations.getPushSubscriptionsByEmail,
			{ email },
		);

		if (subscriptions.length === 0) {
			return { success: true, sent: 0, errors: [] };
		}

		const errors: string[] = [];
		let sent = 0;

		const payload = JSON.stringify({
			title,
			body,
			icon: icon || "/icon-192x192.png",
			url: url || "/",
			tag: tag || "default",
		});

		for (const sub of subscriptions) {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: sub.keys,
					},
					payload,
				);
				sent++;
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : "Unknown error";
				errors.push(`Subscription ${sub._id}: ${errorMsg}`);

				// If subscription is expired/invalid, remove it
				if (
					errorMsg.includes("expired") ||
					errorMsg.includes("unsubscribed") ||
					errorMsg.includes("410")
				) {
					try {
						await ctx.runMutation(api.mutations.removePushSubscription, {
							endpoint: sub.endpoint,
						});
					} catch {
						// Ignore deletion errors
					}
				}
			}
		}

		return { success: sent > 0 || errors.length === 0, sent, errors };
	},
});

// Send push notification to multiple users by their emails
export const sendPushToParticipants = action({
	args: {
		emails: v.array(v.string()),
		title: v.string(),
		body: v.string(),
		url: v.optional(v.string()),
		icon: v.optional(v.string()),
		tag: v.optional(v.string()),
	},
	handler: async (
		ctx,
		{ emails, title, body, url, icon, tag },
	): Promise<{ success: boolean; totalSent: number; errors: string[] }> => {
		const allErrors: string[] = [];
		let totalSent = 0;

		for (const email of emails) {
			const result = await ctx.runAction(api.pushActions.sendPushNotification, {
				email,
				title,
				body,
				url,
				icon,
				tag,
			});

			totalSent += result.sent;
			allErrors.push(...result.errors);
		}

		return { success: true, totalSent, errors: allErrors };
	},
});
