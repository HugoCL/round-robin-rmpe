import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// CORS preflight handler for the flash-assign endpoint
http.route({
	path: "/flash-assign",
	method: "OPTIONS",
	handler: httpAction(async () => {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400",
			},
		});
	}),
});

// Flash assign endpoint — called by the Chrome extension content script.
// Authenticates via Clerk JWT in the Authorization header, then delegates
// to the flashAssign action which handles round-robin + Google Chat.
http.route({
	path: "/flash-assign",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};

		try {
			// Parse request body
			const body = await request.json();
			const { teamSlug, prUrl, force } = body as {
				teamSlug?: string;
				prUrl?: string;
				force?: boolean;
			};

			if (!teamSlug || !prUrl) {
				return new Response(
					JSON.stringify({
						success: false,
						error: "Missing required fields: teamSlug, prUrl",
					}),
					{
						status: 400,
						headers: { "Content-Type": "application/json", ...corsHeaders },
					},
				);
			}

			// Delegate to the flashAssign action (auth is validated inside via ctx.auth)
			const result = await ctx.runAction(api.actions.flashAssign, {
				teamSlug,
				prUrl,
				force: force ?? false,
			});

			const status = result.success ? 200 : result.alreadyAssigned ? 409 : 400;

			return new Response(JSON.stringify(result), {
				status,
				headers: { "Content-Type": "application/json", ...corsHeaders },
			});
		} catch (error) {
			console.error("Flash assign HTTP error:", error);
			return new Response(
				JSON.stringify({
					success: false,
					error:
						error instanceof Error ? error.message : "Internal server error",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json", ...corsHeaders },
				},
			);
		}
	}),
});

export default http;
