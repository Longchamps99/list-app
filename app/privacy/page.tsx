"use client";

import Link from "next/link";
import { Header } from "../components/Header";
import { Shield, Lock, Eye, Share2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white text-[var(--swiss-black)] flex flex-col">
            <Header variant="page" title="Privacy Policy" showBack={true} backHref="/" />

            <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-[var(--swiss-black)]">
                            Privacy Policy
                        </h1>
                        <p className="text-[var(--swiss-text-muted)] mb-12 text-lg">
                            Last updated: January 28, 2026. Your privacy is at the core of Vaulted. We built this app to help you curate your legacy, not to exploit your data.
                        </p>

                        <div className="space-y-12">
                            {/* Key Promise */}
                            <section className="bg-[var(--swiss-green-light)] border border-[var(--swiss-green)]/30 rounded-lg p-6 sm:p-8">
                                <div className="flex items-center gap-4 mb-4">
                                    <Shield className="h-8 w-8 text-[var(--swiss-green)]" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-green)]">Our Commitment</h2>
                                </div>
                                <p className="text-[var(--swiss-text)] text-lg leading-relaxed font-medium">
                                    **We do not sell your personal data.** Vaulted is a tool for collectors and curators. We make money by providing value to you, not by selling your information to third-party advertisers or data brokers.
                                </p>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <Eye className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">Information We Collect</h2>
                                </div>
                                <div className="space-y-4 text-[var(--swiss-text-secondary)] leading-relaxed">
                                    <p>
                                        When you use Vaulted, we collect information necessary to provide the service:
                                    </p>
                                    <ul className="list-disc pl-6 space-y-2">
                                        <li><strong>Account Information:</strong> Your name, email address, and profile picture (if provided via Google OAuth).</li>
                                        <li><strong>User Content:</strong> The titles, descriptions, and ranks of the items you add to your lists.</li>
                                        <li><strong>Usage Data:</strong> Basic interaction data (via PostHog) to help us understand which features are most useful and to improve the app.</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <Lock className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">How Your Data is Secured</h2>
                                </div>
                                <p className="text-[var(--swiss-text-secondary)] leading-relaxed">
                                    Your data is stored securely using industry-standard encryption on Google Cloud Platform. We use secure OAuth 2.0 protocols for authentication, meaning we never see or store your Google password.
                                </p>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <Share2 className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">Sharing Data</h2>
                                </div>
                                <p className="text-[var(--swiss-text-secondary)] leading-relaxed">
                                    The only time your data is shared is when **you** explicitly choose to share it—such as when you send a "Share" link for a list or item to a friend. We do not share your private lists or account details with anyone.
                                </p>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <Trash2 className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">Your Rights & Data Deletion</h2>
                                </div>
                                <div className="space-y-4 text-[var(--swiss-text-secondary)] leading-relaxed">
                                    <p>
                                        You have full control over your data. In accordance with GDPR and CCPA guidelines, you have the right to access, correct, or delete your personal information.
                                    </p>
                                    <div className="bg-[var(--swiss-off-white)] rounded-lg p-6 border border-[var(--swiss-border)]">
                                        <h3 className="text-[var(--swiss-black)] font-semibold mb-2 flex items-center gap-2">
                                            Permanent Account Deletion
                                        </h3>
                                        <p className="text-sm mb-3">
                                            You can permanently delete your account at any time through your <strong>Settings</strong> page.
                                        </p>
                                        <ul className="list-disc pl-5 text-sm space-y-1 text-[var(--swiss-text-muted)]">
                                            <li>Deletion is permanent and cannot be undone.</li>
                                            <li>All your lists, items, and shares will be immediately scrubbed from our active databases.</li>
                                            <li>All authentication tokens and session data will be invalidated and removed.</li>
                                            <li>Associated third-party metadata (like your Google profile link) will be disconnected and deleted.</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>
                            <section>
                                <div className="flex items-center gap-3 mb-4 text-[var(--swiss-text-secondary)]">
                                    <Shield className="h-6 w-6" />
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">Compliance & Global Rights</h2>
                                </div>
                                <div className="space-y-4 text-[var(--swiss-text-secondary)] leading-relaxed text-sm">
                                    <p>
                                        <strong>GDPR (General Data Protection Regulation):</strong> For users in the EU/EEA, Vaulted acts as a Data Controller. You have the right to data portability, the right to be forgotten, and the right to object to processing.
                                    </p>
                                    <p>
                                        <strong>CCPA (California Consumer Privacy Act):</strong> We do not sell your personal information. California residents have the right to request disclosure of data collection and the right to delete their data.
                                    </p>
                                    <p>
                                        <strong>Data Retention:</strong> We retain your data as long as your account is active. If you delete your account, data is scrubbed immediately. Inactive accounts with no login for 24 months may be subject to deletion after email notification.
                                    </p>
                                </div>
                            </section>
                        </div>

                        <div className="mt-20 pt-8 border-t border-[var(--swiss-border)] text-center">
                            <p className="text-[var(--swiss-text-muted)] mb-4">Questions about your privacy?</p>
                            <a href="mailto:privacy@vaultedfaves.com" className="text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] transition-colors font-medium">
                                privacy@vaultedfaves.com
                            </a>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-[var(--swiss-border)] py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto flex justify-center gap-6 text-[var(--swiss-text-muted)] text-sm">
                    <Link href="/" className="hover:text-[var(--swiss-black)] transition-colors">Home</Link>
                    <span>© 2026 Vaulted</span>
                </div>
            </footer>
        </div>
    );
}
