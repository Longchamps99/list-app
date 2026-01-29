import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!posthogClient) {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    // If no API key is configured, return a dummy client that does nothing
    if (!apiKey) {
      console.warn('[PostHog] No API key configured, analytics will be disabled');
      return {
        capture: () => { },
        shutdown: async () => { },
      } as any;
    }

    posthogClient = new PostHog(
      apiKey,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0
      }
    );
  }
  return posthogClient;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
