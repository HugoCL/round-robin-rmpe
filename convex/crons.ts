import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Check for events that need start notifications every minute
crons.interval(
	"process-event-start-notifications",
	{ minutes: 1 },
	api.actions.processEventStartNotifications,
);

export default crons;
