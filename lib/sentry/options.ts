import { scrubDscIntegration } from "@/lib/sentry/scrubDsc";
import { scrubEvent, scrubSpan } from "@/lib/sentry/scrubEvent";

const IDENTIFYING_HEADER_TERMS = [
	"forwarded",
	"-ip",
	"remote-",
	"via",
	"-user",
];

// Sentry v11 replaced `sendDefaultPii` with `dataCollection` and defaults to
// collecting everything, so the restrictive baseline has to be explicit.
export const sentryOptions = {
	tracesSampleRate: 0.1,
	dataCollection: {
		userInfo: false,
		cookies: false,
		httpHeaders: {
			request: { deny: IDENTIFYING_HEADER_TERMS },
			response: { deny: IDENTIFYING_HEADER_TERMS },
		},
		httpBodies: [],
		urlQueryParams: { deny: IDENTIFYING_HEADER_TERMS },
		genAI: { inputs: false, outputs: false },
		databaseQueryData: false,
		queues: false,
		graphQL: { document: false, variables: false },
	},
	beforeSend: scrubEvent,
	beforeSendSpan: scrubSpan,
	integrations: [scrubDscIntegration()],
};
