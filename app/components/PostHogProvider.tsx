"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

// PostHog is initialized in instrumentation-client.ts for Next.js 15.3+
// This provider is only needed to access PostHog via usePostHog hook

export function PHProvider({ children }: { children: React.ReactNode }) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
