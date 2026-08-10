"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

function createConvexClient() {
	const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
	if (!url) {
		throw new Error(
			"Missing NEXT_PUBLIC_CONVEX_URL. Set it in Vercel project env vars (and .env.local for local builds).",
		);
	}
	return new ConvexReactClient(url);
}

const convex = createConvexClient();

export function ConvexClientProvider({ children }: { children: ReactNode }) {
	return (
		<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
