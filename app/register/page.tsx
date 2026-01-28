"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import posthog from "posthog-js";

function RegisterForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [savedMovies, setSavedMovies] = useState<string[]>([]);
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    // Load saved Top 10 list from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("tempTop10");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const filtered = parsed.filter(m => m.trim() !== "");
                    setSavedMovies(filtered);
                }
            } catch (e) {
                console.error("Failed to parse saved list", e);
            }
        }
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.ok) {
                setIsRegistered(true);
                setMessage({ type: 'success', text: data.message });
                posthog.capture('user_registered', { method: 'credentials' });
            } else {
                setMessage({ type: 'error', text: data.message || "Registration failed" });
            }
        } catch (error) {
            setMessage({ type: 'error', text: "Internal server error" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        posthog.capture('signup_started', {
            method: 'google',
            has_saved_list: savedMovies.length > 0,
        });
        signIn("google", { callbackUrl });
    };

    const loginLink = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

    if (isRegistered) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 relative overflow-hidden">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                </div>

                <div className="w-full max-w-md relative z-10 text-center">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
                        <div className="mb-6 flex justify-center">
                            <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center">
                                <Star className="h-8 w-8 text-indigo-400" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-4">Check your email</h1>
                        <p className="text-gray-400 mb-8">
                            We've sent a verification link to <span className="text-white font-semibold">{email}</span>.
                            Please click the link to verify your account.
                        </p>
                        <Link
                            href="/login"
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 rounded-lg text-sm font-bold text-white shadow-lg inline-block w-full hover:from-indigo-50 hover:to-purple-500 transition-all"
                        >
                            Return to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

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
                        Get Started with Vaulted
                    </h1>
                    <p className="text-sm text-gray-400">
                        Already have an account?{" "}
                        <Link
                            href={loginLink}
                            className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>

                {/* Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
                    {/* Show Saved Top 10 List */}
                    {savedMovies.length > 0 && (
                        <div className="mb-6 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="flex items-center gap-2 mb-3 relative z-10">
                                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                                <h3 className="font-semibold text-white">Your Top {savedMovies.length} List</h3>
                            </div>
                            <div className="space-y-1 mb-3 relative z-10">
                                {savedMovies.slice(0, 5).map((movie, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                                        <span className="font-bold text-indigo-400">#{idx + 1}</span>
                                        <span className="truncate">{movie}</span>
                                    </div>
                                ))}
                                {savedMovies.length > 5 && (
                                    <p className="text-xs text-indigo-300/80 mt-2 font-medium">+ {savedMovies.length - 5} more items</p>
                                )}
                            </div>
                            <p className="text-xs text-indigo-200/60 relative z-10 border-t border-indigo-500/20 pt-2 mt-2">
                                ✨ We'll save this list to your account!
                            </p>
                        </div>
                    )}

                    {/* Registration Form */}
                    <form onSubmit={handleRegister} className="mb-6 space-y-4">
                        {message && (
                            <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
                                {message.text}
                            </div>
                        )}
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
                                Create Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                placeholder="••••••••"
                                className="block w-full rounded-lg bg-slate-800/50 border border-white/10 px-4 py-3 text-white placeholder-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all hover:bg-slate-800/80"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:from-indigo-50 hover:to-purple-500 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isLoading ? "Creating Account..." : "Create Account"}
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
                    By signing up, you agree to the{" "}
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

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <RegisterForm />
        </Suspense>
    );
}
