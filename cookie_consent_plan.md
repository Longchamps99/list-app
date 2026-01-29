# Implementation Plan: Cookie Consent & Analytics Opt-Out

## 1. Goal
Implement a user-friendly cookie banner for GDPR/CCPA compliance that allows users to accept or decline analytics tracking (PostHog).

## 2. Technical Strategy
- **Choice Persistence**: Store the user's consent choice in `localStorage`.
- **PostHog Integration**: 
    - Modify `instrumentation-client.ts` to respect consent.
    - Use `posthog.opt_in_capturing()` and `posthog.opt_out_capturing()`.
- **UI Component**: A fixed banner at the bottom of the screen using Tailwind and Framer Motion for smooth entry.

## 3. Implementation Steps

### Step 1: Update PostHog Initialization
Modify `instrumentation-client.ts` to check `localStorage` on init if possible, or just initialize normally and handle consent state in a component. 
Wait, `instrumentation-client.ts` runs very early.
Better: Initialize with `opt_out_capturing_by_default: true` if we want strict opt-in.

### Step 2: Create `CookieBanner` Component
- **File**: `app/components/CookieBanner.tsx`
- **Logic**:
    - Check for `cookie_consent` in `localStorage` on mount.
    - If no value, show the banner.
    - "Accept": Set `localStorage` to `'accepted'`, call `posthog.opt_in_capturing()`, hide banner.
    - "Decline": Set `localStorage` to `'declined'`, call `posthog.opt_out_capturing()`, hide banner.

### Step 3: Global Integration
Add the `CookieBanner` to the root `layout.tsx`.

### Step 4: Opt-Out Mechanism (Settings Page)
Update the Settings page to show the current consent status and allow users to change it.

## 4. Design Aesthetics
- **Position**: Bottom-center or bottom-right.
- **Style**: Dark glassmorphism (`bg-slate-900/80 backdrop-blur-md`).
- **Animations**: Slide up from the bottom.
- **Text**: Clear and concise about what is being tracked and why.
