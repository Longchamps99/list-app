"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
            } else {
                setMessage({ type: 'error', text: data.message || "An error occurred." });
            }
        } catch (error) {
            setMessage({ type: 'error', text: "Internal server error" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--swiss-off-white)] px-4 text-[var(--swiss-black)]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Header */}
                <div className="mb-8 text-center">
                    <Link href="/login" className="inline-flex items-center gap-2 text-sm text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] transition-colors mb-6">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Login
                    </Link>
                    <h1 className="text-3xl font-bold text-[var(--swiss-black)] mb-3">
                        Reset Password
                    </h1>
                    <p className="text-sm text-[var(--swiss-text-muted)]">
                        Enter your email and we'll send you a link to reset your password.
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white border border-[var(--swiss-border)] rounded-lg shadow-sm p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {message && (
                            <div className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${message.type === 'success'
                                ? 'bg-[var(--swiss-green-light)] border-[var(--swiss-green)]/30 text-[var(--swiss-green)]'
                                : 'bg-[var(--swiss-red-light)] border-[var(--swiss-red)]/30 text-[var(--swiss-red)]'
                                }`}>
                                <div className="mt-0.5">
                                    {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full bg-[var(--swiss-red)]" />}
                                </div>
                                {message.text}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-[var(--swiss-text-secondary)] mb-1.5">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-[var(--swiss-text-muted)]" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    className="block w-full rounded-lg bg-white border border-[var(--swiss-border)] pl-10 pr-4 py-3 text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)] focus:border-[var(--swiss-black)] focus:outline-none focus:ring-1 focus:ring-[var(--swiss-black)] transition-all"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || (message?.type === 'success')}
                            className="w-full rounded-lg bg-[var(--swiss-black)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--swiss-accent-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? "Sending..." : "Send Reset Link"}
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
