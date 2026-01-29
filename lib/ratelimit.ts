import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Create a new Redis instance
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Authentication Limiter
 * Limits registration and login attempts to 5 per 10 minutes per IP.
 */
export const authLimiter = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    analytics: true,
    prefix: "@upstash/ratelimit/auth",
});

/**
 * General API Limiter
 * Higher limit for standard operations.
 */
export const generalLimiter = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    analytics: true,
    prefix: "@upstash/ratelimit/general",
});

/**
 * Email/Resend Limiter
 */
export const emailLimiter = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    analytics: true,
    prefix: "@upstash/ratelimit/email",
});

/**
 * AI Enrichment Limiter
 * Limits expensive AI calls to 10 per minute per user.
 */
export const enrichLimiter = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "@upstash/ratelimit/enrich",
});
