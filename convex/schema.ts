import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	teams: defineTable({
		name: v.string(),
		slug: v.string(),
		createdAt: v.optional(v.number()),
		googleChatWebhookUrl: v.optional(v.string()),
	})
		.index("by_slug", ["slug"]) // enforce uniqueness at write-time
		.index("by_created_at", ["createdAt"]),
	appMetrics: defineTable({
		key: v.string(),
		value: v.number(),
		updatedAt: v.number(),
	}).index("by_key", ["key"]),
	reviewers: defineTable({
		teamId: v.optional(v.id("teams")),
		name: v.string(),
		email: v.string(),
		googleChatUserId: v.optional(v.string()),
		assignmentCount: v.number(),
		isAbsent: v.boolean(),
		absentUntil: v.optional(v.number()), // Timestamp when the reviewer is expected to return
		createdAt: v.number(),
		tags: v.array(v.id("tags")),
	})
		.index("by_email", ["email"]) // legacy/simple lookups
		.index("by_team", ["teamId"]) // team-scoped listing
		.index("by_team_email", ["teamId", "email"])
		.index("by_absent_until", ["isAbsent", "absentUntil"]), // Optimization: filter absent reviewers efficiently

	tags: defineTable({
		teamId: v.optional(v.id("teams")),
		name: v.string(),
		color: v.string(),
		description: v.optional(v.string()),
		createdAt: v.number(),
	}).index("by_team", ["teamId"]),

	assignmentHistory: defineTable({
		teamId: v.optional(v.id("teams")),
		reviewerId: v.id("reviewers"),
		timestamp: v.number(),
		forced: v.boolean(),
		skipped: v.boolean(),
		isAbsentSkip: v.boolean(),
		prUrl: v.optional(v.string()),
		contextUrl: v.optional(v.string()),
		tagId: v.optional(v.string()),
		actionByReviewerId: v.optional(v.id("reviewers")),
	})
		.index("by_timestamp", ["timestamp"]) // legacy
		.index("by_team_timestamp", ["teamId", "timestamp"]),

	assignmentFeed: defineTable({
		teamId: v.optional(v.id("teams")),
		lastAssigned: v.optional(v.string()), // Store just the reviewer ID
		items: v.array(
			v.object({
				reviewerId: v.string(),
				timestamp: v.number(),
				forced: v.boolean(),
				skipped: v.boolean(),
				isAbsentSkip: v.boolean(),
				prUrl: v.optional(v.string()),
				contextUrl: v.optional(v.string()),
				tagId: v.optional(v.string()),
				actionByReviewerId: v.optional(v.id("reviewers")),
			}),
		),
	}).index("by_team", ["teamId"]),

	// Active PR assignments requiring mutual confirmation
	prAssignments: defineTable({
		teamId: v.optional(v.id("teams")),
		prUrl: v.optional(v.string()),
		assigneeId: v.id("reviewers"), // reviewer who must review
		assignerId: v.id("reviewers"), // reviewer who requested review
		status: v.string(), // pending | reviewed | approved (will be deleted after approved)
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_assignee", ["assigneeId"])
		.index("by_assigner", ["assignerId"])
		.index("by_team", ["teamId"]),

	// Store last few sent Google Chat messages for debugging (keep trimmed via mutation)
	debugMessages: defineTable({
		text: v.string(),
		reviewerName: v.optional(v.string()),
		reviewerEmail: v.optional(v.string()),
		assignerName: v.optional(v.string()),
		assignerEmail: v.optional(v.string()),
		prUrl: v.optional(v.string()),
		teamSlug: v.optional(v.string()),
		locale: v.optional(v.string()),
		isCustom: v.optional(v.boolean()),
		createdAt: v.number(),
	}).index("by_created_at", ["createdAt"]),

	backups: defineTable({
		teamId: v.optional(v.id("teams")),
		reviewers: v.array(
			v.object({
				id: v.string(),
				name: v.string(),
				email: v.string(),
				googleChatUserId: v.optional(v.string()),
				assignmentCount: v.number(),
				isAbsent: v.boolean(),
				createdAt: v.number(),
				tags: v.array(v.id("tags")),
			}),
		),
		reason: v.string(),
		createdAt: v.number(),
	})
		.index("by_created_at", ["createdAt"])
		.index("by_team", ["teamId"]),

	// Team events (estimations, meetings, plannings, etc.)
	events: defineTable({
		teamId: v.id("teams"),
		title: v.string(),
		description: v.optional(v.string()),
		scheduledAt: v.number(), // Unix timestamp when the event starts
		durationMinutes: v.optional(v.number()), // Duration in minutes (default: 20)
		expectedEndTime: v.optional(v.number()), // Precalculated end time for optimization
		createdAt: v.number(),
		createdBy: v.object({
			reviewerId: v.id("reviewers"),
		}),
		// Participants who confirmed attendance
		participants: v.array(
			v.object({
				reviewerId: v.id("reviewers"),
				joinedAt: v.number(),
			}),
		),
		status: v.string(), // "scheduled" | "started" | "completed" | "cancelled"
		// Track if notifications have been sent
		inviteSentAt: v.optional(v.number()),
		startNotificationSentAt: v.optional(v.number()),
	})
		.index("by_team", ["teamId"])
		.index("by_team_status", ["teamId", "status"])
		.index("by_scheduled_at", ["scheduledAt"])
		.index("by_status_notification_scheduled", [
			"status",
			"startNotificationSentAt",
			"scheduledAt",
		]) // Optimization: efficiently find events needing start notification
		.index("by_status_end_time", ["status", "expectedEndTime"]), // Optimization: efficiently find expired events

	// Push notification subscriptions for PWA
	pushSubscriptions: defineTable({
		email: v.string(), // User's email to link to reviewers/participants
		endpoint: v.string(), // Push subscription endpoint
		keys: v.object({
			p256dh: v.string(),
			auth: v.string(),
		}),
		createdAt: v.number(),
	})
		.index("by_email", ["email"])
		.index("by_endpoint", ["endpoint"]),
});
