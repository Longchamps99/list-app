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

    useEffect(() => {
        const saved = localStorage.getItem("tempTop5");
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
        posthog.capture('signup_started', { method: 'google', has_saved_list: savedMovies.length > 0 });
        signIn("google", { callbackUrl });
    };

    const loginLink = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

    if (isRegistered) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--swiss-off-white)] px-4">
                <div className="w-full max-w-md text-center">
                    <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-8">
                        <div className="mb-6 flex justify-center">
                            <div className="w-14 h-14 bg-[var(--swiss-green-light)] rounded-full flex items-center justify-center">
                                <Star className="h-7 w-7 text-[var(--swiss-green)]" />
                            </div>
                        </div>
                        <h1 className="text-xl font-bold text-[var(--swiss-black)] mb-3">
                            {message?.text.includes("Auto-verified") ? "Registration Complete!" : "Check your email"}
                        </h1>
                        <p className="text-[var(--swiss-text-secondary)] text-sm mb-6">
                            {message?.text.includes("Auto-verified")
                                ? "Your account has been automatically verified. You can now log in."
                                : <>We've sent a verification link to <span className="font-medium text-[var(--swiss-black)]">{email}</span>.</>}
                        </p>
                        <Link
                            href="/login"
                            className="bg-[var(--swiss-black)] px-6 py-2.5 rounded-full text-sm font-medium text-white inline-block w-full hover:bg-[var(--swiss-accent-hover)] transition-all"
                        >
                            Return to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--swiss-off-white)] px-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="mb-10 text-center">
                    <h1 className="text-2xl font-bold text-[var(--swiss-black)] mb-2">
                        Get Started with Vaulted
                    </h1>
                    <p className="text-sm text-[var(--swiss-text-secondary)]">
                        Already have an account?{" "}
                        <Link href={loginLink} className="font-medium text-[var(--swiss-black)] hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-8">
                    {/* Show Saved Top 10 List */}
                    {savedMovies.length > 0 && (
                        <div className="mb-6 p-4 bg-[var(--swiss-green-light)] border border-[var(--swiss-green)]/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Star className="h-4 w-4 text-[var(--swiss-green)]" />
                                <h3 className="font-medium text-[var(--swiss-black)] text-sm">Your Top {savedMovies.length} List</h3>
                            </div>
                            <div className="space-y-1 mb-3">
                                {savedMovies.slice(0, 5).map((movie, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-[var(--swiss-text)]">
                                        <span className="font-medium text-[var(--swiss-green)]">{idx + 1}.</span>
                                        <span className="truncate">{movie}</span>
                                    </div>
                                ))}
                                {savedMovies.length > 5 && (
                                    <p className="text-xs text-[var(--swiss-text-muted)] mt-2">+ {savedMovies.length - 5} more items</p>
                                )}
                            </div>
                            <p className="text-xs text-[var(--swiss-text-secondary)] border-t border-[var(--swiss-green)]/20 pt-2 mt-2">
                                ✨ We'll save this list to your account!
                            </p>
                        </div>
                    )}

                    {/* Registration Form */}
                    <form onSubmit={handleRegister} className="mb-6 space-y-5">
                        {message && (
                            <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-[var(--swiss-green-light)] text-[var(--swiss-green)]' : 'bg-red-50 text-[var(--swiss-red)]'}`}>
                                {message.text}
                            </div>
                        )}
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
                                Create Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                placeholder="••••••••"
                                className="block w-full rounded-md border border-[var(--swiss-border)] px-4 py-2.5 text-[var(--swiss-text)] placeholder-[var(--swiss-text-muted)] focus:border-[var(--swiss-black)] focus:outline-none transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-full px-4 py-2.5 text-sm font-medium focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: '#000000', color: '#ffffff' }}
                        >
                            {isLoading ? "Creating Account..." : "Create Account"}
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
                    By signing up, you agree to the{" "}
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

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[var(--swiss-off-white)]">Loading...</div>}>
            <RegisterForm />
        </Suspense>
    );
}
