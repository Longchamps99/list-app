"use client";

import { SessionProvider } from "next-auth/react";
import { PHProvider } from "./components/PostHogProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <PHProvider>
            <SessionProvider>{children}</SessionProvider>
        </PHProvider>
    );
}
