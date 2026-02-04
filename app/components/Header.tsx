"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Menu, Database, Clock } from "lucide-react";

interface HeaderProps {
    variant?: "dashboard" | "page";
    title?: string;
    showBack?: boolean;
    backHref?: string;
    onMenuClick?: () => void;
    children?: React.ReactNode;
    isEditable?: boolean;
    onTitleChange?: (value: string) => void;
}

export function Header({
    variant = "page",
    title,
    showBack = false,
    backHref = "/dashboard",
    onMenuClick,
    children,
    isEditable = false,
    onTitleChange
}: HeaderProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [stats, setStats] = useState<{ totalItems: number; lastUpdated: string | null } | null>(null);

    useEffect(() => {
        if (showUserMenu && session?.user) {
            fetch("/api/user/stats")
                .then(res => res.json())
                .then(data => setStats(data))
                .catch(err => console.error("Error fetching user stats:", err));
        }
    }, [showUserMenu, session?.user]);

    const formatTimestamp = (timestamp: string | null) => {
        if (!timestamp) return "Never";
        const date = new Date(timestamp);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yyyy = date.getFullYear();
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
    };

    const handleLogout = async () => {
        await signOut({ redirect: true, callbackUrl: "/login" });
    };

    return (
        <header className="bg-white border-b border-[var(--swiss-border)] sticky top-0 z-[100] w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {variant === "dashboard" && onMenuClick && (
                        <button
                            onClick={onMenuClick}
                            className="p-2 text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] transition-colors md:hidden"
                            aria-label="Toggle Menu"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    )}
                    {showBack && (
                        <Link
                            href={backHref}
                            className="text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] transition-colors flex items-center gap-1 group"
                        >
                            <svg className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="hidden sm:inline text-sm">Back</span>
                        </Link>
                    )}

                    <Link href="/dashboard" className="flex items-center gap-2 group">

                        <h1 className="text-lg font-semibold text-[var(--swiss-black)] group-hover:text-[var(--swiss-text-secondary)] transition-colors">
                            Vaulted
                        </h1>
                    </Link>

                    {title && (
                        <>
                            <span className="text-[var(--swiss-border)] hidden sm:inline">/</span>
                            {isEditable ? (
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => onTitleChange?.(e.target.value)}
                                    className="text-base font-medium text-[var(--swiss-text)] bg-transparent border-0 focus:ring-0 focus:outline-none p-0 w-full min-w-[200px] placeholder-[var(--swiss-text-muted)]"
                                    placeholder="List Name"
                                />
                            ) : (
                                <h2 className="text-base font-medium text-[var(--swiss-text)] hidden sm:block">{title}</h2>
                            )}
                        </>
                    )}
                </div>

                {/* Center Section - Page-specific content */}
                {children && (
                    <div className="flex-1 mx-4 flex items-center justify-center max-w-2xl">
                        {children}
                    </div>
                )}

                {/* Right Section - User Menu */}
                <div className="flex items-center gap-3">
                    {session?.user && (
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-[var(--swiss-off-white)] transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-[var(--swiss-black)] text-white flex items-center justify-center font-medium text-sm">
                                    {session.user.name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || "U"}
                                </div>
                                <svg
                                    className={`h-4 w-4 text-[var(--swiss-text-muted)] transition-transform ${showUserMenu ? "rotate-180" : ""}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {showUserMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowUserMenu(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-[var(--swiss-border)] py-1 z-20">
                                        <div className="px-4 py-3 border-b border-[var(--swiss-border)]">
                                            <p className="text-sm font-medium text-[var(--swiss-black)] truncate">
                                                {session.user.name || "User"}
                                            </p>
                                            <p className="text-xs text-[var(--swiss-text-muted)] truncate">
                                                {session.user.email}
                                            </p>
                                        </div>

                                        <Link
                                            href="/dashboard"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--swiss-text)] hover:bg-[var(--swiss-off-white)] transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                            Dashboard
                                        </Link>

                                        <Link
                                            href="/settings"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--swiss-text)] hover:bg-[var(--swiss-off-white)] transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Settings
                                        </Link>

                                        {stats && (
                                            <div className="px-4 py-3 border-t border-[var(--swiss-border)] bg-[var(--swiss-off-white)]/50">
                                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--swiss-text-muted)] font-bold mb-2">
                                                    Account Stats
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 text-xs text-[var(--swiss-text)]">
                                                            <Database className="h-3 w-3 text-[var(--swiss-text-muted)]" />
                                                            <span>Total Items</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-[var(--swiss-black)]">{stats.totalItems}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5 text-xs text-[var(--swiss-text)]">
                                                            <Clock className="h-3 w-3 text-[var(--swiss-text-muted)]" />
                                                            <span>Last Updated</span>
                                                        </div>
                                                        <div className="text-[10px] font-medium text-[var(--swiss-text-muted)] pl-4.5">
                                                            {formatTimestamp(stats.lastUpdated)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--swiss-red)] hover:bg-[var(--swiss-off-white)] transition-colors"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            Logout
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
