"use server";

import { redis } from "@/lib/redis";
import { createSnapshot } from "./backup-actions";

export interface Tag {
	id: string;
	name: string;
	color: string;
	description?: string;
	createdAt: number;
}

export interface Reviewer {
	id: string;
	name: string;
	assignmentCount: number;
	isAbsent: boolean;
	createdAt: number; // Adding timestamp for ordering
	tags: string[]; // Array of tag IDs
}

export interface AssignmentHistory {
	reviewerId: string;
	reviewerName: string; // Adding name for display purposes
	timestamp: number;
	forced: boolean; // Track if this was a forced assignment
	skipped: boolean; // Track if this was a skip operation
	isAbsentSkip: boolean; // Track if this was an auto-skip of an absent reviewer
	tag?: string; // Track which tag was used for assignment
	actionBy?: {
		email: string;
		firstName?: string;
		lastName?: string;
	}; // Track who performed the action
}

export interface AssignmentFeed {
	items: AssignmentHistory[];
	lastAssigned: AssignmentHistory | null;
}

const REDIS_KEY = process.env.REDIS_KEY_REVIEWERS || "pr-reviewers";
const HISTORY_KEY = process.env.REDIS_KEY_ASSIGNMENT_HISTORY || "pr-assignment-history";
const FEED_KEY = process.env.REDIS_KEY_ASSIGNMENT_FEED || "pr-assignment-feed";
const TAGS_KEY = process.env.REDIS_KEY_TAGS || "pr-tags";

// Default tags - empty by default
const defaultTags: Tag[] = [];

// Bootstrapping reviewers
const defaultReviewers: Reviewer[] = [
	{
		id: "1",
		name: "Juan",
		assignmentCount: 0,
		isAbsent: false,
		createdAt: 1614556800000,
		tags: [],
	},
	{
		id: "2",
		name: "Pedro",
		assignmentCount: 0,
		isAbsent: false,
		createdAt: 1614556800001,
		tags: [],
	},
];

export async function getReviewers(): Promise<Reviewer[]> {
	try {
		// Try to get reviewers from Redis
		const reviewers = await redis.get<Reviewer[]>(REDIS_KEY);

		// If no reviewers found, initialize with default data
		if (!reviewers) {
			await redis.set(REDIS_KEY, defaultReviewers);

			// Create initial snapshot
			await createSnapshot(defaultReviewers, "Initial setup");

			return defaultReviewers;
		}

		// Ensure all reviewers have a createdAt timestamp and tags array
		const updatedReviewers = reviewers.map((reviewer) => {
			const updated = { ...reviewer };
			if (!updated.createdAt) {
				updated.createdAt = Date.now();
			}
			if (!updated.tags) {
				updated.tags = [];
			}
			return updated;
		});

		// If we had to add createdAt or tags to any reviewers, update Redis
		const needsUpdate = updatedReviewers.some((_, i) => !reviewers[i]?.createdAt || !reviewers[i]?.tags);
		if (needsUpdate) {
			await redis.set(REDIS_KEY, updatedReviewers);
			return updatedReviewers;
		}

		return reviewers;
	} catch (error) {
		console.error("Error fetching reviewers from Redis:", error);
		return defaultReviewers;
	}
}

export async function saveReviewers(reviewers: Reviewer[]): Promise<boolean> {
	try {
		await redis.set(REDIS_KEY, reviewers);
		return true;
	} catch (error) {
		console.error("Error saving reviewers to Redis:", error);
		return false;
	}
}

export async function updateReviewer(reviewer: Reviewer): Promise<boolean> {
	try {
		const reviewers = await getReviewers();
		const updatedReviewers = reviewers.map((r) =>
			r.id === reviewer.id ? reviewer : r,
		);

		const success = await saveReviewers(updatedReviewers);

		if (success) {
			// Create snapshot
			await createSnapshot(
				updatedReviewers,
				`Updated reviewer: ${reviewer.name}`,
			);
		}

		return success;
	} catch (error) {
		console.error("Error updating reviewer in Redis:", error);
		return false;
	}
}

export async function addReviewer(name: string): Promise<boolean> {
	try {
		const reviewers = await getReviewers();

		// Find the minimum assignment count to start the new reviewer at
		const minCount = Math.min(...reviewers.map((r) => r.assignmentCount));

		const newReviewer: Reviewer = {
			id: Date.now().toString(),
			name: name.trim(),
			assignmentCount: minCount,
			isAbsent: false,
			createdAt: Date.now(),
			tags: [],
		};

		reviewers.push(newReviewer);

		const success = await saveReviewers(reviewers);

		if (success) {
			// Create snapshot
			await createSnapshot(reviewers, `Added reviewer: ${name}`);
		}

		return success;
	} catch (error) {
		console.error("Error adding reviewer to Redis:", error);
		return false;
	}
}

export async function removeReviewer(id: string): Promise<boolean> {
	try {
		const reviewers = await getReviewers();
		const reviewerToRemove = reviewers.find((r) => r.id === id);
		const filteredReviewers = reviewers.filter((r) => r.id !== id);

		const success = await saveReviewers(filteredReviewers);

		if (success && reviewerToRemove) {
			// Create snapshot
			await createSnapshot(
				filteredReviewers,
				`Removed reviewer: ${reviewerToRemove.name}`,
			);
		}

		return success;
	} catch (error) {
		console.error("Error removing reviewer from Redis:", error);
		return false;
	}
}

export async function incrementReviewerCount(
	id: string,
	skipped = false,
	isAbsentSkip = false,
	actionBy?: { email: string; name?: string },
): Promise<boolean> {
	try {
		const reviewers = await getReviewers();
		const reviewer = reviewers.find((r) => r.id === id);

		if (!reviewer) {
			return false;
		}

		const updatedReviewers = reviewers.map((r) =>
			r.id === id ? { ...r, assignmentCount: r.assignmentCount + 1 } : r,
		);

		// Add to assignment history, but only update the feed if it's not an absent reviewer being skipped
		await addToAssignmentHistory(
			id,
			reviewer.name,
			false,
			skipped,
			isAbsentSkip,
			actionBy,
			undefined, // Regular assignment, no specific tag
		);

		const success = await saveReviewers(updatedReviewers);

		if (success) {
			// Create snapshot
			let action = "Assigned PR to";
			if (skipped) {
				action = "Skipped";
			}
			if (isAbsentSkip) {
				action = "Auto-skipped absent reviewer";
			}
			await createSnapshot(updatedReviewers, `${action}: ${reviewer.name}`);
		}

		return success;
	} catch (error) {
		console.error("Error incrementing reviewer count in Redis:", error);
		return false;
	}
}

export async function skipToNextReviewer(
	currentNextId: string,
): Promise<{ success: boolean; nextReviewer?: Reviewer }> {
	try {
		const reviewers = await getReviewers();

		// Filter out absent reviewers and the current next reviewer
		const availableReviewers = reviewers.filter(
			(r) => !r.isAbsent && r.id !== currentNextId,
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
	} catch (error) {
		console.error("Error finding next reviewer in Redis:", error);
		return { success: false };
	}
}

export async function forceAssignReviewer(
	id: string,
	actionBy?: { email: string; name?: string },
): Promise<{ success: boolean; reviewer?: Reviewer }> {
	try {
		const reviewers = await getReviewers();
		const reviewer = reviewers.find((r) => r.id === id);

		if (!reviewer) {
			return { success: false };
		}

		const updatedReviewers = reviewers.map((r) =>
			r.id === id ? { ...r, assignmentCount: r.assignmentCount + 1 } : r,
		);

		// Add to assignment history with forced flag
		await addToAssignmentHistory(id, reviewer.name, true, false, false, actionBy, undefined);

		// Save updated reviewers
		const success = await saveReviewers(updatedReviewers);

		if (success) {
			// Create snapshot
			await createSnapshot(
				updatedReviewers,
				`Force assigned PR to: ${reviewer.name}`,
			);
		}

		return { success, reviewer };
	} catch (error) {
		console.error("Error force assigning reviewer in Redis:", error);
		return { success: false };
	}
}

export async function updateAssignmentCount(
	id: string,
	count: number,
): Promise<boolean> {
	try {
		const reviewers = await getReviewers();
		const reviewer = reviewers.find((r) => r.id === id);
		const updatedReviewers = reviewers.map((r) =>
			r.id === id ? { ...r, assignmentCount: count } : r,
		);

		const success = await saveReviewers(updatedReviewers);

		if (success && reviewer) {
			// Create snapshot
			await createSnapshot(
				updatedReviewers,
				`Updated count for ${reviewer.name} to ${count}`,
			);
		}

		return success;
	} catch (error) {
		console.error("Error updating assignment count in Redis:", error);
		return false;
	}
}

export async function resetAllCounts(): Promise<boolean> {
	try {
		const reviewers = await getReviewers();
		const updatedReviewers = reviewers.map((r) => ({
			...r,
			assignmentCount: 0,
		}));

		// Clear assignment history
		await redis.set(HISTORY_KEY, []);
		await redis.set(FEED_KEY, { items: [], lastAssigned: null });

		const success = await saveReviewers(updatedReviewers);

		if (success) {
			// Create snapshot
			await createSnapshot(updatedReviewers, "Reset all assignment counts");
		}

		return success;
	} catch (error) {
		console.error("Error resetting counts in Redis:", error);
		return false;
	}
}

// Helper function to find the most common assignment count
function getMostCommonAssignmentCount(reviewers: Reviewer[]): number {
	if (reviewers.length === 0) return 0;

	// Count frequency of each assignment count
	const countFrequency = new Map<number, number>();

	for (const reviewer of reviewers) {
		const count = reviewer.assignmentCount;
		countFrequency.set(count, (countFrequency.get(count) || 0) + 1);
	}

	// Find the highest count with the most frequency
	let mostCommonCount = 0;
	let maxFrequency = 0;

	for (const [count, frequency] of countFrequency.entries()) {
		if (frequency > maxFrequency || (frequency === maxFrequency && count > mostCommonCount)) {
			mostCommonCount = count;
			maxFrequency = frequency;
		}
	}

	return mostCommonCount;
}

export async function toggleAbsence(id: string): Promise<boolean> {
	try {
		const reviewers = await getReviewers();
		const reviewer = reviewers.find((r) => r.id === id);
		const isCurrentlyAbsent = reviewer?.isAbsent || false;

		// If unmarking as absent (making available), update assignment count to most common value
		let updatedReviewers: Reviewer[];
		if (isCurrentlyAbsent) {
			// Find the most common assignment count among available reviewers
			const availableReviewers = reviewers.filter((r) => !r.isAbsent || r.id === id);
			const mostCommonCount = getMostCommonAssignmentCount(availableReviewers);

			updatedReviewers = reviewers.map((r) =>
				r.id === id
					? { ...r, isAbsent: false, assignmentCount: mostCommonCount }
					: r,
			);
		} else {
			// Just mark as absent without changing assignment count
			updatedReviewers = reviewers.map((r) =>
				r.id === id ? { ...r, isAbsent: true } : r,
			);
		}

		const success = await saveReviewers(updatedReviewers);

		if (success && reviewer) {
			// Create snapshot
			const status = isCurrentlyAbsent ? "available" : "absent";
			const countMessage = isCurrentlyAbsent
				? ` and updated assignment count to ${updatedReviewers.find(r => r.id === id)?.assignmentCount}`
				: "";
			await createSnapshot(
				updatedReviewers,
				`Marked ${reviewer.name} as ${status}${countMessage}`,
			);
		}

		return success;
	} catch (error) {
		console.error("Error toggling absence in Redis:", error);
		return false;
	}
}

// Assignment history functions for undo feature
async function addToAssignmentHistory(
	reviewerId: string,
	reviewerName: string,
	forced: boolean,
	skipped: boolean,
	isAbsentSkip: boolean,
	actionBy?: { email: string; name?: string },
	tagId?: string,
): Promise<boolean> {
	try {
		const history = await getAssignmentHistory();

		const newAssignment: AssignmentHistory = {
			reviewerId,
			reviewerName,
			timestamp: Date.now(),
			forced,
			skipped,
			isAbsentSkip,
			actionBy,
			tag: tagId,
		};

		const updatedHistory = [newAssignment, ...history].slice(0, 50); // Keep only the last 50 assignments

		await redis.set(HISTORY_KEY, updatedHistory);

		// Only update the feed if it's not an absent reviewer being auto-skipped
		if (!isAbsentSkip) {
			await updateAssignmentFeed(newAssignment);
		}

		return true;
	} catch (error) {
		console.error("Error adding to assignment history:", error);
		return false;
	}
}

async function getAssignmentHistory(): Promise<AssignmentHistory[]> {
	try {
		const history = await redis.get<AssignmentHistory[]>(HISTORY_KEY);
		return history || [];
	} catch (error) {
		console.error("Error getting assignment history:", error);
		return [];
	}
}

// New function to update the assignment feed
async function updateAssignmentFeed(
	newAssignment: AssignmentHistory,
): Promise<boolean> {
	try {
		const feed = await getAssignmentFeed();

		// Update the feed with the new assignment
		const updatedFeed: AssignmentFeed = {
			items: [newAssignment, ...feed.items].slice(0, 5), // Keep only the last 5 assignments
			lastAssigned: newAssignment,
		};

		await redis.set(FEED_KEY, updatedFeed);
		return true;
	} catch (error) {
		console.error("Error updating assignment feed:", error);
		return false;
	}
}

// New function to get the assignment feed
export async function getAssignmentFeed(): Promise<AssignmentFeed> {
	try {
		const feed = await redis.get<AssignmentFeed>(FEED_KEY);
		return feed || { items: [], lastAssigned: null };
	} catch (error) {
		console.error("Error getting assignment feed:", error);
		return { items: [], lastAssigned: null };
	}
}

export async function undoLastAssignment(): Promise<{
	success: boolean;
	reviewerId?: string;
}> {
	try {
		const history = await getAssignmentHistory();

		if (history.length === 0) {
			return { success: false };
		}

		const lastAssignment = history[0];
		const reviewers = await getReviewers();

		const reviewer = reviewers.find((r) => r.id === lastAssignment.reviewerId);

		if (!reviewer) {
			return { success: false };
		}

		// Decrement the count
		const updatedReviewers = reviewers.map((r) =>
			r.id === lastAssignment.reviewerId
				? { ...r, assignmentCount: Math.max(0, r.assignmentCount - 1) }
				: r,
		);

		// Remove from history
		const updatedHistory = history.slice(1);
		await redis.set(HISTORY_KEY, updatedHistory);

		// Update the feed
		const feed = await getAssignmentFeed();
		const updatedFeed: AssignmentFeed = {
			items: feed.items.filter(
				(item) => item.timestamp !== lastAssignment.timestamp,
			),
			lastAssigned: feed.items.length > 1 ? feed.items[1] : null,
		};
		await redis.set(FEED_KEY, updatedFeed);

		// Save updated reviewers
		const success = await saveReviewers(updatedReviewers);

		if (success) {
			// Create snapshot
			await createSnapshot(
				updatedReviewers,
				`Undid assignment for: ${reviewer.name}`,
			);
		}

		return { success: true, reviewerId: lastAssignment.reviewerId };
	} catch (error) {
		console.error("Error undoing last assignment:", error);
		return { success: false };
	}
}

// Tag management functions
export async function getTags(): Promise<Tag[]> {
	try {
		const tags = await redis.get<Tag[]>(TAGS_KEY);

		if (!tags) {
			await redis.set(TAGS_KEY, defaultTags);
			return defaultTags;
		}

		return tags;
	} catch (error) {
		console.error("Error fetching tags from Redis:", error);
		return defaultTags;
	}
}

export async function saveTags(tags: Tag[]): Promise<boolean> {
	try {
		await redis.set(TAGS_KEY, tags);
		return true;
	} catch (error) {
		console.error("Error saving tags to Redis:", error);
		return false;
	}
}

export async function addTag(name: string, color: string, description?: string): Promise<boolean> {
	try {
		const tags = await getTags();

		const newTag: Tag = {
			id: Date.now().toString(),
			name: name.trim(),
			color,
			description: description?.trim(),
			createdAt: Date.now(),
		};

		tags.push(newTag);
		return await saveTags(tags);
	} catch (error) {
		console.error("Error adding tag:", error);
		return false;
	}
}

export async function updateTag(tag: Tag): Promise<boolean> {
	try {
		const tags = await getTags();
		const updatedTags = tags.map((t) => (t.id === tag.id ? tag : t));
		return await saveTags(updatedTags);
	} catch (error) {
		console.error("Error updating tag:", error);
		return false;
	}
}

export async function removeTag(id: string): Promise<boolean> {
	try {
		const [tags, reviewers] = await Promise.all([getTags(), getReviewers()]);

		// Remove tag from all reviewers
		const updatedReviewers = reviewers.map((r) => ({
			...r,
			tags: r.tags.filter((tagId) => tagId !== id),
		}));

		// Remove tag from tags list
		const updatedTags = tags.filter((t) => t.id !== id);

		// Save both updates
		await Promise.all([
			saveTags(updatedTags),
			saveReviewers(updatedReviewers),
		]);

		return true;
	} catch (error) {
		console.error("Error removing tag:", error);
		return false;
	}
}

export async function assignTagToReviewer(reviewerId: string, tagId: string): Promise<boolean> {
	try {
		const reviewers = await getReviewers();
		const updatedReviewers = reviewers.map((r) => {
			if (r.id === reviewerId) {
				const tags = r.tags || [];
				if (!tags.includes(tagId)) {
					return { ...r, tags: [...tags, tagId] };
				}
			}
			return r;
		});

		return await saveReviewers(updatedReviewers);
	} catch (error) {
		console.error("Error assigning tag to reviewer:", error);
		return false;
	}
}

export async function removeTagFromReviewer(reviewerId: string, tagId: string): Promise<boolean> {
	try {
		const reviewers = await getReviewers();
		const updatedReviewers = reviewers.map((r) => {
			if (r.id === reviewerId) {
				return { ...r, tags: (r.tags || []).filter((t) => t !== tagId) };
			}
			return r;
		});

		return await saveReviewers(updatedReviewers);
	} catch (error) {
		console.error("Error removing tag from reviewer:", error);
		return false;
	}
}

// Track-based assignment functions
export async function findNextReviewerByTag(tagId: string): Promise<{ success: boolean; nextReviewer?: Reviewer }> {
	try {
		const reviewers = await getReviewers();

		// Filter reviewers by tag and availability
		const availableReviewers = reviewers.filter(
			(r) => !r.isAbsent && r.tags && r.tags.includes(tagId)
		);

		if (availableReviewers.length === 0) {
			return { success: false };
		}

		// Find the minimum assignment count among available reviewers
		const minCount = Math.min(...availableReviewers.map((r) => r.assignmentCount));

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

		return { success: true, nextReviewer };
	} catch (error) {
		console.error("Error finding next reviewer by tag:", error);
		return { success: false };
	}
}

export async function assignPRByTag(
	tagId: string,
	actionBy?: { email: string; name?: string }
): Promise<{ success: boolean; reviewer?: Reviewer }> {
	try {
		const result = await findNextReviewerByTag(tagId);

		if (!result.success || !result.nextReviewer) {
			return { success: false };
		}

		const reviewer = result.nextReviewer;
		const reviewers = await getReviewers();

		// Update assignment count
		const updatedReviewers = reviewers.map((r) =>
			r.id === reviewer.id ? { ...r, assignmentCount: r.assignmentCount + 1 } : r
		);

		// Add to assignment history with tag info
		await addToAssignmentHistory(
			reviewer.id,
			reviewer.name,
			false,
			false,
			false,
			actionBy,
			tagId
		);

		// Save updated reviewers
		const success = await saveReviewers(updatedReviewers);

		if (success) {
			// Get tag name for snapshot
			const tags = await getTags();
			const tag = tags.find((t) => t.id === tagId);
			const tagName = tag ? tag.name : "Unknown Tag";

			// Create snapshot
			await createSnapshot(
				updatedReviewers,
				`Assigned PR to ${reviewer.name} (${tagName} track)`
			);
		}

		return { success, reviewer };
	} catch (error) {
		console.error("Error assigning PR by tag:", error);
		return { success: false };
	}
}
