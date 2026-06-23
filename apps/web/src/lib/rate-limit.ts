import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { webEnv } from "@cutia/env/web";

const redis = new Redis({
	url: webEnv.UPSTASH_REDIS_REST_URL,
	token: webEnv.UPSTASH_REDIS_REST_TOKEN,
});

export const baseRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
	analytics: true,
	prefix: "rate-limit",
});

export async function checkRateLimit({ request }: { request: Request }) {
	try {
		const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
		const { success } = await baseRateLimit.limit(ip);
		return { success, limited: !success };
	} catch {
		// Redis unavailable — allow request in dev
		return { success: true, limited: false };
	}
}
