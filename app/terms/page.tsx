"use client";

import Link from "next/link";
import { Header } from "../components/Header";
import { Gavel, AlertTriangle, ShieldCheck, Scale, XCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white text-[var(--swiss-black)] flex flex-col">
            <Header variant="page" title="Terms of Service" showBack={true} backHref="/" />

            <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-[var(--swiss-black)]">
                            Terms of Service
                        </h1>
                        <p className="text-[var(--swiss-text-muted)] mb-12 text-lg">
                            Last updated: January 26, 2026. By using Vaulted, you agree to the following terms. Please read them carefully.
                        </p>

                        <div className="space-y-12">
                            {/* Key Section: Use at Own Risk */}
                            <section className="bg-[var(--swiss-red-light)] border border-[var(--swiss-red)]/30 rounded-lg p-6 sm:p-8">
                                <div className="flex items-center gap-4 mb-4">
                                    <AlertTriangle className="h-8 w-8 text-[var(--swiss-red)]" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-red)]">Use at Your Own Risk</h2>
                                </div>
                                <p className="text-[var(--swiss-text)] text-lg leading-relaxed font-medium">
                                    Vaulted is provided "as-is" and "as-available." We make no warranties, expressed or implied, regarding the reliability or availability of the service. You use the application at your own discretion and risk.
                                </p>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <Gavel className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">Acceptance of Terms</h2>
                                </div>
                                <p className="text-[var(--swiss-text-secondary)] leading-relaxed">
                                    By accessing or using Vaulted, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our services.
                                </p>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <XCircle className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">Limitation of Liability</h2>
                                </div>
                                <p className="text-[var(--swiss-text-secondary)] leading-relaxed">
                                    In no event shall Vaulted, its creators, or its affiliates be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Vaulted, even if we have been notified orally or in writing of the possibility of such damage.
                                </p>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <ShieldCheck className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">User Conduct</h2>
                                </div>
                                <p className="text-[var(--swiss-text-secondary)] leading-relaxed">
                                    You are responsible for the content you post and your interactions with other users. You agree not to use Vaulted for any unlawful purpose or to post content that is harmful, offensive, or violates the rights of others.
                                </p>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <Scale className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">Modifications to Service</h2>
                                </div>
                                <p className="text-[var(--swiss-text-secondary)] leading-relaxed">
                                    We reserve the right to modify or discontinue the service (or any part thereof) with or without notice at any time. We shall not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the service.
                                </p>
                            </section>
                        </div>

                        <div className="mt-20 pt-8 border-t border-[var(--swiss-border)] text-center">
                            <p className="text-[var(--swiss-text-muted)] mb-4">Legal inquiries?</p>
                            <a href="mailto:legal@vaulted.app" className="text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] transition-colors font-medium">
                                legal@vaulted.app
                            </a>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-[var(--swiss-border)] py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto flex justify-center gap-6 text-[var(--swiss-text-muted)] text-sm">
                    <Link href="/" className="hover:text-[var(--swiss-black)] transition-colors">Home</Link>
                    <Link href="/privacy" className="hover:text-[var(--swiss-black)] transition-colors">Privacy</Link>
                    <span>© 2026 Vaulted</span>
                </div>
            </footer>
        </div>
    );
}
