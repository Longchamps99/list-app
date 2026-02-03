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
            posthog.identify(email, { email: email });
            posthog.capture('user_logged_in', { method: 'credentials' });
            router.push(callbackUrl);
        } else {
            posthog.capture('login_failed', { method: 'credentials', email: email, error: result?.error });

            if (result?.error === "unverified") {
                alert("Please verify your email address before logging in. Check your inbox for a verification link.");
            } else {
                alert("Login failed. Please check your credentials.");
            }
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        posthog.capture('login_started', { method: 'google' });
        signIn("google", { callbackUrl });
    };

    const registerLink = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--swiss-off-white)] px-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="mb-10 text-center">
                    <h1 className="text-2xl font-bold text-[var(--swiss-black)] mb-2">
                        Sign in to Vaulted
                    </h1>
                    <p className="text-sm text-[var(--swiss-text-secondary)]">
                        Don't have an account?{" "}
                        <Link
                            href={registerLink}
                            className="font-medium text-[var(--swiss-black)] hover:underline"
                        >
                            Sign up
                        </Link>
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-8">
                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailLogin} className="mb-6 space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-[var(--swiss-text)] mb-1.5">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="name@email.com"
                                className="block w-full rounded-md border border-[var(--swiss-border)] px-4 py-2.5 text-[var(--swiss-text)] placeholder-[var(--swiss-text-muted)] focus:border-[var(--swiss-black)] focus:outline-none transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-[var(--swiss-text)] mb-1.5">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                placeholder="••••••••"
                                className="block w-full rounded-md border border-[var(--swiss-border)] px-4 py-2.5 text-[var(--swiss-text)] placeholder-[var(--swiss-text-muted)] focus:border-[var(--swiss-black)] focus:outline-none transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <div className="flex justify-end mt-1.5">
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-full px-4 py-2.5 text-sm font-medium focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: '#000000', color: '#ffffff' }}
                        >
                            {isLoading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[var(--swiss-border)]" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-white px-3 text-[var(--swiss-text-muted)]">or</span>
                        </div>
                    </div>

                    {/* Google Sign In */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 rounded-full border border-[var(--swiss-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--swiss-text)] hover:bg-[var(--swiss-off-white)] transition-all"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>
                </div>

                {/* Terms and Privacy */}
                <p className="mt-8 text-center text-xs text-[var(--swiss-text-muted)]">
                    By signing in, you agree to the{" "}
                    <Link href="/terms" className="text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] underline">
                        Terms of Service
                    </Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] underline">
                        Privacy Policy
                    </Link>.
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[var(--swiss-off-white)]">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
