import type { BrowserOptions } from "@sentry/nextjs";
import { redactEmails } from "@/lib/sentry/scrubEvent";

type Integration = Extract<
	NonNullable<BrowserOptions["integrations"]>,
	unknown[]
>[number];

const IDENTITY_KEYS = ["user_id", "user_segment"];

// The root span name is copied into the envelope's trace header and into the
// outgoing `baggage` header after beforeSendSpan has run, so it is scrubbed
// here, on the object both of them are built from.
export function scrubDsc(dsc: object): void {
	const context = dsc as Record<string, unknown>;
	try {
		if (typeof context.transaction === "string") {
			context.transaction = redactEmails(context.transaction);
		}
		for (const key of IDENTITY_KEYS) delete context[key];
	} catch {
		try {
			delete context.transaction;
		} catch {}
	}
}

export function scrubDscIntegration(): Integration {
	return {
		name: "ScrubDsc",
		setup(client) {
			client.on("createDsc", scrubDsc);
		},
	};
}
