import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Check for events that need start notifications every minute
crons.interval(
	"process-event-start-notifications",
	{ minutes: 1 },
	api.actions.processEventStartNotifications,
);

// Auto-complete events that have exceeded their duration
crons.interval(
	"auto-complete-events",
	{ minutes: 1 },
	api.mutations.autoCompleteExpiredEvents,
);

// Auto-mark reviewers as available when their absentUntil time has passed
crons.interval(
	"process-absent-returns",
	{ minutes: 5 },
	api.mutations.processAbsentReturns,
);

// Clean up old prAssignments and assignmentHistory records daily at midnight UTC
crons.daily(
	"cleanup-old-records",
	{ hourUTC: 0, minuteUTC: 0 },
	api.mutations.cleanupOldRecords,
);

export default crons;
