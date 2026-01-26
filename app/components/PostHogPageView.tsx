"use client";

// PostHog pageview capture is now handled automatically via defaults: '2025-11-30'
// in instrumentation-client.ts. This component is kept for backward compatibility
// but no longer manually captures pageviews.

export default function PostHogPageView(): null {
    return null;
}
