"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (result?.ok) {
            // Identify user in PostHog
            posthog.identify(email, {
                email: email,
            });

            // Capture login event
            posthog.capture('user_logged_in', {
                method: 'credentials',
            });

            router.push(callbackUrl);
        } else {
            // Capture failed login attempt
            posthog.capture('login_failed', {
                method: 'credentials',
                email: email,
                error: result?.error
            });

            if (result?.error === "unverified") {
                alert("Please verify your email address before logging in. Check your inbox for a verification link.");
            } else {
                alert("Login failed. Please check your credentials.");
            }
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        posthog.capture('login_started', {
            method: 'google',
        });
        signIn("google", { callbackUrl });
    };

    const registerLink = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-white mb-3">
                        Sign in to Vaulted
                    </h1>
                    <p className="text-sm text-gray-400">
                        Don't have an account?{" "}
                        <Link
                            href={registerLink}
                            className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            Sign up
                        </Link>
                    </p>
                </div>

                {/* Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailLogin} className="mb-6 space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="name@email.com"
                                className="block w-full rounded-lg bg-slate-800/50 border border-white/10 px-4 py-3 text-white placeholder-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all hover:bg-slate-800/80"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                placeholder="••••••••"
                                className="block w-full rounded-lg bg-slate-800/50 border border-white/10 px-4 py-3 text-white placeholder-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all hover:bg-slate-800/80"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:from-indigo-500 hover:to-purple-500 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isLoading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-transparent px-4 text-gray-500 font-medium">OR</span>
                        </div>
                    </div>

                    {/* Google Sign In */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 rounded-lg border border-white/10 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>
                </div>

                {/* Terms and Privacy */}
                <p className="mt-8 text-center text-xs text-gray-500">
                    By signing in, you agree to the{" "}
                    <Link href="/terms" className="font-medium text-gray-400 hover:text-white underline transition-colors">
                        Terms of Service
                    </Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="font-medium text-gray-400 hover:text-white underline transition-colors">
                        Privacy Policy
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
