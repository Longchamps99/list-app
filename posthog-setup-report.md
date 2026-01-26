# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into your Next.js App Router project. The integration includes:

- **Client-side initialization** via `instrumentation-client.ts` (recommended for Next.js 15.3+)
- **Server-side tracking** via `posthog-node` for API routes
- **Reverse proxy configuration** in `next.config.ts` for improved tracking reliability
- **User identification** on login and signup for cross-session tracking
- **Automatic pageview capture** using PostHog defaults
- **Exception capture** enabled for error tracking

## Events Implemented

| Event Name | Description | File Path |
|------------|-------------|-----------|
| `user_signed_up` | User successfully completed registration via the API | `app/api/register/route.ts` |
| `user_logged_in` | User successfully logged in via credentials | `app/login/page.tsx` |
| `login_failed` | User attempted to log in but failed | `app/login/page.tsx` |
| `login_started` | User started Google OAuth login | `app/login/page.tsx` |
| `signup_started` | User started Google OAuth signup | `app/register/page.tsx` |
| `list_created` | User created a new list | `app/api/lists/route.ts` |
| `item_created` | User created a new item | `app/api/items/route.ts` |
| `item_deleted` | User deleted an item | `app/api/items/[itemId]/route.ts` |
| `item_reordered` | User reordered items via drag and drop | `app/dashboard/page.tsx` |
| `share_link_generated` | User generated a share link for an item or list | `app/api/share/generate/route.ts` |
| `share_link_redeemed` | User redeemed a share link and received content | `app/share/[token]/page.tsx` |
| `item_search_performed` | User searched for items in the dashboard | `app/dashboard/page.tsx` |
| `new_item_auto_enriched` | User used auto-enrich feature when creating an item | `app/items/new/page.tsx` |
| `tag_clicked` | User clicked on a tag to open smart list | `app/dashboard/page.tsx` |
| `view_mode_changed` | User switched between grid and list view | `app/dashboard/page.tsx` |
| `landing_page_conversion_clicked` | User clicked CTA on landing page (pre-existing) | `app/landing/page.tsx` |

## Files Created/Modified

### New Files
- `instrumentation-client.ts` - Client-side PostHog initialization
- `lib/posthog-server.ts` - Server-side PostHog client helper
- `.env` - Added PostHog environment variables

### Modified Files
- `next.config.ts` - Added reverse proxy rewrites for PostHog
- `app/components/PostHogProvider.tsx` - Simplified to work with instrumentation-client.ts
- `app/components/PostHogPageView.tsx` - Simplified (pageviews now automatic)
- `app/login/page.tsx` - Added login events and user identification
- `app/register/page.tsx` - Added signup started event
- `app/api/register/route.ts` - Added server-side signup event and identification
- `app/api/lists/route.ts` - Added list creation event
- `app/api/items/route.ts` - Added item creation event
- `app/api/items/[itemId]/route.ts` - Added item deletion event
- `app/api/share/generate/route.ts` - Added share link generation event
- `app/share/[token]/page.tsx` - Added share link redemption event
- `app/dashboard/page.tsx` - Added engagement events (search, reorder, tags, view mode)
- `app/items/new/page.tsx` - Added auto-enrich event

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/298726/dashboard/1130818) - Core analytics dashboard for tracking user behavior, conversions, and key events

### Insights
- [User Signups & Logins](https://us.posthog.com/project/298726/insights/OvkkkT6I) - Daily count of user signups and logins over time
- [Content Creation Activity](https://us.posthog.com/project/298726/insights/TClDUJIQ) - Track item and list creation activity
- [Sharing & Collaboration](https://us.posthog.com/project/298726/insights/hz0ZmbT3) - Track share link generation and redemption
- [Landing to Signup Funnel](https://us.posthog.com/project/298726/insights/pUIE5BLB) - Conversion funnel from landing page to signup
- [User Engagement Actions](https://us.posthog.com/project/298726/insights/2rBLefsQ) - Track user engagement with search, reorder, and view changes

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
