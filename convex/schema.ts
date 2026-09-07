import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	teams: defineTable({
		name: v.string(),
		slug: v.string(),
		createdAt: v.optional(v.number()),
		googleChatWebhookUrl: v.optional(v.string()),
		timezone: v.optional(v.string()),
	})
		.index("by_slug", ["slug"]) // enforce uniqueness at write-time
		.index("by_created_at", ["createdAt"]),
	userPreferences: defineTable({
		userTokenIdentifier: v.string(),
		email: v.optional(v.string()),
		showAssignments: v.boolean(),
		myAssignmentsOnly: v.optional(v.boolean()),
		showTags: v.boolean(),
		showEmails: v.boolean(),
		hideMultiAssignmentSection: v.boolean(),
		// Kept optional only while deployed rows are cleaned by the migration.
		alwaysSendGoogleChatMessage: v.optional(v.boolean()),
		enableAgentSetupExperiment: v.optional(v.boolean()),
		defaultAgentTeamSlug: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_token_identifier", ["userTokenIdentifier"])
		.index("by_email", ["email"]),
	agentTokens: defineTable({
		userTokenIdentifier: v.string(),
		email: v.optional(v.string()),
		label: v.string(),
		tokenHash: v.string(),
		tokenPrefix: v.string(),
		createdAt: v.number(),
		lastUsedAt: v.optional(v.number()),
		revokedAt: v.optional(v.number()),
	})
		.index("by_user_token_identifier", ["userTokenIdentifier"])
		.index("by_token_hash", ["tokenHash"]),
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
		/** Legacy name: when true, skipped by the general rotation. */
		excludedFromReviewPool: v.optional(v.boolean()),
		/** Defaults to !excludedFromReviewPool for rows created before this setting. */
		includedInTagRotations: v.optional(v.boolean()),
		partTimeSchedule: v.optional(
			v.object({
				workingDays: v.array(
					v.union(
						v.literal("monday"),
						v.literal("tuesday"),
						v.literal("wednesday"),
						v.literal("thursday"),
						v.literal("friday"),
						v.literal("saturday"),
						v.literal("sunday"),
					),
				),
			}),
		),
		/** 1–12, optional with birthdayDay */
		birthdayMonth: v.optional(v.number()),
		/** 1–31, optional with birthdayMonth */
		birthdayDay: v.optional(v.number()),
		/** YYYY-MM-DD in team local date when birthday notifications were last sent */
		lastBirthdayNotifiedLocalDateKey: v.optional(v.string()),
		createdAt: v.number(),
		tags: v.array(v.id("tags")),
		/**
		 * Optional because every deployed row predates roles. Always read it
		 * through resolveReviewerRole(), which treats `undefined` as "member";
		 * comparing `role === "owner"` directly would lock legacy teams out of
		 * the owner-gated mutations.
		 */
		role: v.optional(v.union(v.literal("owner"), v.literal("member"))),
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
		reviewerTeamId: v.optional(v.id("teams")),
		reviewerPoolTeamIds: v.optional(v.array(v.id("teams"))),
		reviewerName: v.optional(v.string()),
		timestamp: v.number(),
		batchId: v.optional(v.string()),
		forced: v.boolean(),
		skipped: v.boolean(),
		isAbsentSkip: v.boolean(),
		urgent: v.optional(v.boolean()),
		crossTeamReview: v.optional(v.boolean()),
		source: v.optional(v.union(v.literal("ui"), v.literal("agent"))),
		prUrl: v.optional(v.string()),
		contextUrl: v.optional(v.string()),
		googleChatThreadUrl: v.optional(v.string()),
		googleChatThreadUrls: v.optional(
			v.array(
				v.object({
					teamSlug: v.string(),
					teamName: v.string(),
					url: v.string(),
				}),
			),
		),
		tagId: v.optional(v.string()),
		actionByReviewerId: v.optional(v.id("reviewers")),
		actionByName: v.optional(v.string()),
	})
		.index("by_timestamp", ["timestamp"]) // legacy
		.index("by_team_timestamp", ["teamId", "timestamp"])
		.index("by_team_batch", ["teamId", "batchId"])
		.index("by_reviewer_team_timestamp", ["reviewerTeamId", "timestamp"]),

	assignmentFeed: defineTable({
		teamId: v.optional(v.id("teams")),
		lastAssigned: v.optional(v.string()), // Store just the reviewer ID
		items: v.array(
			v.object({
				reviewerId: v.string(),
				reviewerName: v.optional(v.string()),
				timestamp: v.number(),
				batchId: v.optional(v.string()),
				forced: v.boolean(),
				skipped: v.boolean(),
				isAbsentSkip: v.boolean(),
				urgent: v.optional(v.boolean()),
				crossTeamReview: v.optional(v.boolean()),
				source: v.optional(v.union(v.literal("ui"), v.literal("agent"))),
				prUrl: v.optional(v.string()),
				contextUrl: v.optional(v.string()),
				tagId: v.optional(v.string()),
				actionByReviewerId: v.optional(v.id("reviewers")),
				actionByName: v.optional(v.string()),
			}),
		),
	}).index("by_team", ["teamId"]),

	// Active PR assignments requiring mutual confirmation
	prAssignments: defineTable({
		teamId: v.optional(v.id("teams")),
		reviewerTeamId: v.optional(v.id("teams")),
		reviewerPoolTeamIds: v.optional(v.array(v.id("teams"))),
		prUrl: v.optional(v.string()),
		batchId: v.optional(v.string()),
		urgent: v.optional(v.boolean()),
		crossTeamReview: v.optional(v.boolean()),
		assigneeId: v.id("reviewers"), // reviewer who must review
		assignerId: v.id("reviewers"), // reviewer who requested review
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_assignee", ["assigneeId"])
		.index("by_assigner", ["assignerId"])
		.index("by_team", ["teamId"])
		.index("by_team_batch", ["teamId", "batchId"]),

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
				excludedFromReviewPool: v.optional(v.boolean()),
				includedInTagRotations: v.optional(v.boolean()),
				partTimeSchedule: v.optional(
					v.object({
						workingDays: v.array(
							v.union(
								v.literal("monday"),
								v.literal("tuesday"),
								v.literal("wednesday"),
								v.literal("thursday"),
								v.literal("friday"),
								v.literal("saturday"),
								v.literal("sunday"),
							),
						),
					}),
				),
				birthdayMonth: v.optional(v.number()),
				birthdayDay: v.optional(v.number()),
				lastBirthdayNotifiedLocalDateKey: v.optional(v.string()),
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
		.index("by_status_scheduled_at", ["status", "scheduledAt"])
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

	featureFlags: defineTable({
		teamId: v.id("teams"),
		key: v.string(),
		description: v.optional(v.string()),
		status: v.union(v.literal("active"), v.literal("removed")),
		createdAt: v.number(),
		removedAt: v.optional(v.number()),
		createdBy: v.object({
			authorTokenIdentifier: v.string(),
			authorName: v.string(),
			authorEmail: v.optional(v.string()),
		}),
		updatedAt: v.number(),
	})
		.index("by_team_status_created_at", ["teamId", "status", "createdAt"])
		.index("by_team_key", ["teamId", "key"]),

	suggestions: defineTable({
		title: v.string(),
		description: v.string(),
		status: v.union(
			v.literal("open"),
			v.literal("planned"),
			v.literal("completed"),
		),
		authorTokenIdentifier: v.string(),
		authorName: v.string(),
		authorEmail: v.optional(v.string()),
		upvoteCount: v.number(),
		commentCount: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_status_created_at", ["status", "createdAt"])
		.index("by_status_upvotes", ["status", "upvoteCount", "createdAt"])
		.index("by_created_at", ["createdAt"])
		.index("by_author", ["authorTokenIdentifier", "createdAt"]),

	suggestionVotes: defineTable({
		suggestionId: v.id("suggestions"),
		userTokenIdentifier: v.string(),
		createdAt: v.number(),
	})
		.index("by_suggestion", ["suggestionId"])
		.index("by_user", ["userTokenIdentifier"])
		.index("by_suggestion_user", ["suggestionId", "userTokenIdentifier"]),

	suggestionComments: defineTable({
		suggestionId: v.id("suggestions"),
		authorTokenIdentifier: v.string(),
		authorName: v.string(),
		authorEmail: v.optional(v.string()),
		body: v.string(),
		createdAt: v.number(),
	})
		.index("by_suggestion_created_at", ["suggestionId", "createdAt"])
		.index("by_author", ["authorTokenIdentifier", "createdAt"]),

	surveys: defineTable({
		title: v.string(),
		description: v.optional(v.string()),
		status: v.union(
			v.literal("draft"),
			v.literal("active"),
			v.literal("closed"),
		),
		deadlineAt: v.number(),
		createdByTokenIdentifier: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_status", ["status"])
		.index("by_status_deadline", ["status", "deadlineAt"]),

	surveyQuestions: defineTable({
		surveyId: v.id("surveys"),
		order: v.number(),
		type: v.union(
			v.literal("single_choice"),
			v.literal("likert"),
			v.literal("free_text"),
		),
		prompt: v.string(),
		options: v.array(
			v.object({
				value: v.string(),
				label: v.string(),
			}),
		),
		required: v.boolean(),
	}).index("by_survey_order", ["surveyId", "order"]),

	surveyResponses: defineTable({
		surveyId: v.id("surveys"),
		answers: v.array(
			v.object({
				questionId: v.id("surveyQuestions"),
				value: v.string(),
			}),
		),
		createdAt: v.number(),
	}).index("by_survey", ["surveyId"]),

	surveyCompletions: defineTable({
		surveyId: v.id("surveys"),
		userTokenIdentifier: v.string(),
		email: v.optional(v.string()),
		name: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index("by_survey_user", ["surveyId", "userTokenIdentifier"])
		.index("by_survey", ["surveyId"]),

	/**
	 * App-wide configuration. Exactly one row, addressed by the literal key
	 * "singleton" so the lookup is indexed rather than a table scan: this is
	 * read on nearly every mutation via the authorization helpers.
	 *
	 * Every field is optional; an instance with no row falls back to the
	 * defaults in lib/appSettings.ts, which reproduce the previous hardcoded
	 * behaviour.
	 */
	appSettings: defineTable({
		key: v.literal("singleton"),
		emailAccess: v.optional(
			v.object({
				mode: v.union(
					v.literal("open"),
					v.literal("domains"),
					v.literal("pattern"),
				),
				allowedDomains: v.optional(v.array(v.string())),
				allowedEmailPattern: v.optional(v.string()),
				allowClerkTestEmails: v.optional(v.boolean()),
			}),
		),
		/** Keys are validated against the registry in lib/appFeatures.ts on write. */
		featureToggles: v.optional(v.record(v.string(), v.boolean())),
		ops: v.optional(
			v.object({
				retentionDays: v.optional(v.number()),
				assignmentFeedLength: v.optional(v.number()),
				backupsPerTeam: v.optional(v.number()),
				debugMessageLimit: v.optional(v.number()),
				defaultEventDurationMinutes: v.optional(v.number()),
				birthdayNotifyLocalHour: v.optional(v.number()),
				defaultTeamTimezone: v.optional(v.string()),
			}),
		),
		updatedAt: v.number(),
		updatedByEmail: v.optional(v.string()),
	}).index("by_key", ["key"]),

	/**
	 * Admins granted from the console. ADMIN_ALLOWLIST_EMAILS stays as the
	 * bootstrap seed and permanent break-glass, and is checked before this
	 * table, so an empty or damaged roster can never lock an operator out.
	 */
	appAdmins: defineTable({
		/** Normalized lowercase; uniqueness enforced at write-time. */
		email: v.string(),
		note: v.optional(v.string()),
		source: v.union(v.literal("manual"), v.literal("bootstrap")),
		createdAt: v.number(),
		createdByEmail: v.optional(v.string()),
	}).index("by_email", ["email"]),

	/**
	 * Product announcements shown above the board.
	 *
	 * Replaces a hardcoded array that needed a deploy to change. Built-in
	 * banners keep pointing at messages/*.json through `translationKey`;
	 * console-authored ones carry their copy inline in both locales.
	 */
	announcements: defineTable({
		/** Stable slug. Doubles as the dismissal key, so renaming it un-dismisses. */
		key: v.string(),
		status: v.union(
			v.literal("draft"),
			v.literal("published"),
			v.literal("archived"),
		),
		variant: v.union(v.literal("default"), v.literal("destructive")),
		bodyEs: v.optional(v.string()),
		bodyEn: v.optional(v.string()),
		translationKey: v.optional(v.string()),
		linkUrl: v.optional(v.string()),
		linkLabelEs: v.optional(v.string()),
		linkLabelEn: v.optional(v.string()),
		audience: v.union(
			v.literal("everyone"),
			v.literal("admins"),
			v.literal("teams"),
		),
		teamIds: v.optional(v.array(v.id("teams"))),
		requiresTeamEvents: v.optional(v.boolean()),
		startsAt: v.optional(v.number()),
		endsAt: v.optional(v.number()),
		dismissible: v.boolean(),
		order: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
		createdByEmail: v.optional(v.string()),
	})
		.index("by_status_order", ["status", "order"])
		.index("by_key", ["key"]),

	/** Per-user dismissals. Previously localStorage, so they did not sync across devices. */
	announcementDismissals: defineTable({
		userTokenIdentifier: v.string(),
		announcementKey: v.string(),
		createdAt: v.number(),
	})
		.index("by_user_key", ["userTokenIdentifier", "announcementKey"])
		.index("by_user", ["userTokenIdentifier"]),

	/** Audit trail for maintenance tasks that used to need `npx convex run`. */
	maintenanceRuns: defineTable({
		task: v.string(),
		dryRun: v.boolean(),
		status: v.union(
			v.literal("running"),
			v.literal("succeeded"),
			v.literal("failed"),
		),
		startedAt: v.number(),
		finishedAt: v.optional(v.number()),
		triggeredByEmail: v.string(),
		/** Serialized so the row does not need a validator per task shape. */
		resultJson: v.optional(v.string()),
		error: v.optional(v.string()),
	}).index("by_started_at", ["startedAt"]),
});
