import posthog from "posthog-js"

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  // Include the defaults option as required by PostHog
  defaults: '2025-11-30',
  // Enables capturing unhandled exceptions via Error Tracking
  capture_exceptions: true,
  // Strict Privacy: Opt-out by default until user gives consent via CookieBanner
  opt_out_capturing_by_default: true,
  // Turn on debug in development mode
  debug: process.env.NODE_ENV === "development",
});

// IMPORTANT: Never combine this approach with other client-side PostHog initialization approaches,
// especially components like a PostHogProvider. instrumentation-client.ts is the correct solution
// for initializing client-side PostHog in Next.js 15.3+ apps.
