import { ClerkProvider, useAuth } from "@clerk/chrome-extension";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useEffect, useRef } from "react";

import { CLERK_PUBLISHABLE_KEY, CONVEX_URL, SYNC_HOST } from "@/env";

const convexClient = new ConvexReactClient(CONVEX_URL);

/**
 * Syncs the Clerk "convex" JWT token to chrome.storage.session so that
 * the background service worker and content scripts can call the Convex
 * HTTP endpoints with authentication.  The token is refreshed every 50 s
 * (Clerk JWTs last 60 s).
 */
function AuthTokenSync() {
	const { getToken, isSignedIn } = useAuth();
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		const persist = async () => {
			try {
				const token = await getToken({ template: "convex" });
				if (token) {
					await chrome.storage.session.set({ "la-lista-clerk-token": token });
				}
			} catch {
				// Silently ignore – token may not be available yet
			}
		};

		if (isSignedIn) {
			// Store immediately, then refresh every 50 s
			persist();
			intervalRef.current = setInterval(persist, 50_000);
		} else {
			// Clear token on sign-out
			chrome.storage.session.remove("la-lista-clerk-token");
		}

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [isSignedIn, getToken]);

	return null;
}

function ConvexWithClerk({ children }: { children: ReactNode }) {
	return (
		<ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
			<AuthTokenSync />
			{children}
		</ConvexProviderWithClerk>
	);
}

export function Providers({ children }: { children: ReactNode }) {
	return (
		<ClerkProvider
			publishableKey={CLERK_PUBLISHABLE_KEY}
			afterSignOutUrl="/"
			syncHost={SYNC_HOST}
		>
			<ConvexWithClerk>{children}</ConvexWithClerk>
		</ClerkProvider>
	);
}
