import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { APP_FEATURES } from "@/lib/appFeatures";

/**
 * Reports which web-side environment variables are set.
 *
 * Convex cannot see these: GOOGLE_GENERATIVE_AI_API_KEY and UNSPLASH_ACCESS_KEY
 * are read by Next server code and are deliberately never pushed to the Convex
 * deployment. Copying them there just so one query could see them would put
 * secrets in a second store for no benefit.
 *
 * Only booleans cross the wire. Values never do.
 *
 * proxy.ts protects this route (it is absent from PUBLIC_ROUTE_PATTERNS), and
 * the admin check below is the authorization on top of that authentication.
 */
export async function GET() {
	const { getToken } = await auth();
	const token = await getToken({ template: "convex" });
	if (!token) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const config = await fetchQuery(
		api.appConfig.getRuntimeConfig,
		{},
		{ token },
	);
	if (!config.isAdmin) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
	}

	const webRequirements = new Set(
		APP_FEATURES.flatMap((feature) =>
			feature.requirements
				.filter((requirement) => requirement.scope === "web")
				.map((requirement) => requirement.envVar),
		),
	);

	const missing: string[] = [];
	for (const envVar of webRequirements) {
		if (!process.env[envVar]?.trim()) missing.push(envVar);
	}

	return NextResponse.json({ missing });
}
