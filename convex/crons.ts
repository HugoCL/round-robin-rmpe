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

export default crons;
