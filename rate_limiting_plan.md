# Implementation Plan: Rate Limiting

## 1. Goal
Protect critical API endpoints (Authentication, Enrichment, Sharing) from brute-force attacks, spam, and excessive costs by implementing a distributed rate limiting solution using Upstash Redis.

## 2. Infrastructure
- **Provider**: [Upstash Redis](https://upstash.com/) (Serverless Redis, perfect for Next.js/Cloud Run).
- **Library**: `@upstash/ratelimit` (Uses the Token Bucket / Sliding Window algorithm).

## 3. Rate Limit Policy

| Endpoint | Limit | Window | Purpose |
| :--- | :--- | :--- | :--- |
| **Auth (Register/Login)** | 5 attempts | 10 minutes | Prevent brute-force & account creation spam. |
| **Verification Resend** | 3 attempts | 1 hour | Prevent email spam & Resend cost spikes. |
| **AI Enrichment** | 10 requests | 1 minute | Manage Gemini API costs & prevent abuse. |
| **List Sharing** | 20 requests | 1 hour | Prevent social spamming. |

## 4. Technical Implementation

### Step 1: Dependencies
Install `@upstash/ratelimit` and `@upstash/redis`.

### Step 2: Configuration
Create `lib/ratelimit.ts` to initialize the Redis client and multiple rate limiters (e.g., `authLimiter`, `generalLimiter`).

### Step 3: Middleware or Route-Level Integration
- Integrate the limiter directly into the relevant API routes.
- Return a `429 Too Many Requests` status code when limits are exceeded.
- Include headers like `X-RateLimit-Limit` and `X-RateLimit-Remaining`.

### Step 4: Environment Variables
Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env`.

---

## 5. User Experience (Graceful Recovery)
- **Toast/Alert**: Show a clear message: "Too many attempts. Please try again in 10 minutes."
- **Reset Timer**: Inform the user exactly when they can try again if possible.
- **Fail-Safe**: If Redis is down, the system should allow the request (fail-open) to avoid breaking the core app for users.

## 6. Success Metrics (PostHog)
- Capture `rate_limit_exceeded` events to identify if limits are too strict or if we are under attack.
