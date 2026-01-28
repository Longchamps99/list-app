"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { Menu } from "lucide-react";

interface HeaderProps {
    variant?: "dashboard" | "page";
    title?: string;
    showBack?: boolean;
    backHref?: string;
    onMenuClick?: () => void;
    children?: React.ReactNode;
}

export function Header({
    variant = "page",
    title,
    showBack = false,
    backHref = "/dashboard",
    onMenuClick,
    children
}: HeaderProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = async () => {
        await signOut({ redirect: true, callbackUrl: "/login" });
    };

    return (
        <header className="bg-slate-950/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-[100] w-full shadow-lg shadow-black/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {variant === "dashboard" && onMenuClick && (
                        <button
                            onClick={onMenuClick}
                            className="p-2 text-gray-400 hover:text-white transition-colors md:hidden"
                            aria-label="Toggle Menu"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                    )}
                    {showBack && (
                        <Link
                            href={backHref}
                            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 group"
                        >
                            <svg className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="hidden sm:inline">Back</span>
                        </Link>
                    )}

                    <Link href="/dashboard" className="flex items-center gap-2 group">
                        <img
                            src="https://lh3.googleusercontent.com/P68YSdtz6nrkq0jDrxhsyWrFc4awbJnZUArw4n8A0SjPrmk_1mL033AuAynVSIOVUtf_"
                            alt="Vaulted Logo"
                            className="h-8 w-8 object-contain rounded-md"
                        />
                        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent group-hover:from-indigo-300 group-hover:to-purple-300 transition-all">
                            Vaulted
                        </h1>
                    </Link>

                    {title && (
                        <>
                            <span className="text-gray-600 hidden sm:inline">/</span>
                            <h2 className="text-lg font-semibold text-gray-300 hidden sm:block">{title}</h2>
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
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-semibold text-sm shadow-lg shadow-indigo-500/30">
                                    {session.user.name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || "U"}
                                </div>
                                <svg
                                    className={`h-4 w-4 text-gray-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`}
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
                                    <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 py-2 z-20 shadow-black/50">
                                        <div className="px-4 py-3 border-b border-white/10">
                                            <p className="text-sm font-semibold text-white truncate">
                                                {session.user.name || "User"}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">
                                                {session.user.email}
                                            </p>
                                        </div>

                                        <Link
                                            href="/dashboard"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                            Dashboard
                                        </Link>

                                        <Link
                                            href="/settings"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Settings
                                        </Link>

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
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
