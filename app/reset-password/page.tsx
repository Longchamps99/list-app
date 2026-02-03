"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: "Passwords do not match." });
            return;
        }

        if (password.length < 6) {
            setMessage({ type: 'error', text: "Password must be at least 6 characters." });
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: "Success! Your password has been changed." });
                setTimeout(() => router.push("/login"), 3000);
            } else {
                setMessage({ type: 'error', text: data.message || "Failed to reset password." });
            }
        } catch (error) {
            setMessage({ type: 'error', text: "Internal server error" });
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center">
                <AlertCircle className="h-12 w-12 text-[var(--swiss-red)] mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2 text-[var(--swiss-black)]">Invalid Request</h2>
                <p className="text-[var(--swiss-text-muted)] mb-6">No reset token found. Please request a new link.</p>
                <Link href="/forgot-password" title="Forgot Password" className="text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] transition-colors">
                    Go to Forgot Password
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md">
            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-[var(--swiss-black)] mb-3">
                    Set New Password
                </h1>
                <p className="text-sm text-[var(--swiss-text-muted)]">
                    Choose a strong password for your Vaulted account.
                </p>
            </div>

            {/* Card */}
            <div className="bg-white border border-[var(--swiss-border)] rounded-lg shadow-sm p-8">
                {message?.type === 'success' ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-4"
                    >
                        <CheckCircle2 className="h-16 w-16 text-[var(--swiss-green)] mx-auto mb-4" />
                        <h2 className="text-[var(--swiss-black)] text-xl font-bold mb-2">Success!</h2>
                        <p className="text-[var(--swiss-text-muted)] mb-6">{message.text}</p>
                        <p className="text-xs text-[var(--swiss-text-muted)]">Redirecting to login...</p>
                    </motion.div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {message && (
                            <div className="p-4 rounded-lg border border-[var(--swiss-red)]/30 bg-[var(--swiss-red-light)] text-[var(--swiss-red)] text-sm flex items-start gap-3">
                                <AlertCircle className="h-4 w-4 mt-0.5" />
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--swiss-text-secondary)] mb-1.5">New Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-[var(--swiss-text-muted)]" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="block w-full rounded-lg bg-white border border-[var(--swiss-border)] pl-10 pr-10 py-3 text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)] focus:border-[var(--swiss-black)] focus:outline-none transition-all"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5 text-[var(--swiss-text-muted)]" /> : <Eye className="h-5 w-5 text-[var(--swiss-text-muted)]" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--swiss-text-secondary)] mb-1.5">Confirm Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-[var(--swiss-text-muted)]" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="block w-full rounded-lg bg-white border border-[var(--swiss-border)] pl-10 pr-4 py-3 text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)] focus:border-[var(--swiss-black)] focus:outline-none transition-all"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-lg bg-[var(--swiss-black)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--swiss-accent-hover)] transition-all disabled:opacity-50"
                        >
                            {isLoading ? "Updating..." : "Reset Password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--swiss-off-white)] px-4">
            <Suspense fallback={<div className="text-[var(--swiss-text-muted)]">Loading...</div>}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    );
}
