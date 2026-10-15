"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexHttpClient } from "convex/browser";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import {
	collectUnverifiedSessionReport,
	consumeRetryCount,
} from "@/lib/sessionUnverifiedReport";

const REPORT_GAP_MS = 1000;

// Strict Mode remounts the effect in development. This survives that remount
// so the same display is reported once.
let lastReportAt = 0;

export function SessionUnverifiedDiagnostic({
	userEmail,
}: {
	userEmail?: string;
}) {
	const { getToken, userId } = useAuth();
	const sent = useRef(false);

	useEffect(() => {
		if (sent.current) return;
		const now = Date.now();
		if (now - lastReportAt < REPORT_GAP_MS) {
			sent.current = true;
			return;
		}
		sent.current = true;
		lastReportAt = now;

		void sendUnverifiedSessionReport({
			getToken: () => getToken({ template: "convex" }),
			clerkUserId: userId ?? undefined,
			clerkEmail: userEmail,
			clientTimestamp: now,
			route: window.location.pathname,
			userAgent: window.navigator.userAgent,
			retryCount: consumeRetryCount(window.sessionStorage),
		});
	}, [getToken, userEmail, userId]);

	return null;
}

async function sendUnverifiedSessionReport(
	input: Parameters<typeof collectUnverifiedSessionReport>[0],
): Promise<void> {
	try {
		const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
		if (!url) return;
		const report = await collectUnverifiedSessionReport(input);
		// HTTP, with logging off. The websocket client prints the server's
		// console.warn back into the browser console; this screen must not.
		const client = new ConvexHttpClient(url, { logger: false });
		await client.mutation(
			api.sessionDiagnostics.reportUnverifiedSession,
			report,
		);
	} catch {
		// A failed report leaves the screen as it is.
	}
}
