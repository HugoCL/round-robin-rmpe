// @ts-nocheck
// DEPRECATED: This file is part of the old Redis implementation
// TypeScript checking is disabled for this file since it's no longer used

import { Redis } from "@upstash/redis";

// Create a Redis client using environment variables provided by Vercel
export const redis = new Redis({
	url: process.env.UPSTASH_REDIS_REST_URL || "",
	token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});
