"use client";

import { useEffect, useState } from "react";

export function OnboardingHandler({ userEmail }: { userEmail: string }) {
    const [status, setStatus] = useState<'info' | 'success'>('info');

    useEffect(() => {
        // Just show a message - the list will be created on first login
        const saved = localStorage.getItem("tempTop5");
        if (saved) {
            const items = JSON.parse(saved).filter((item: string) => item.trim() !== "");
            if (items.length > 0) {
                setStatus('success');
            }
        }
    }, [userEmail]);

    if (status === 'success') {
        return (
            <p className="text-sm text-indigo-300 mt-4 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                ✨ Your list will be ready when you log in!
            </p>
        );
    }

    return null;
}
