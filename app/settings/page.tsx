"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "../components/Header";
import { DeleteAccountModal } from "../components/DeleteAccountModal";
import { User, Trash2, Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsPage() {
    const { data: session } = useSession();
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    if (!session?.user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
                <p className="text-gray-400">Please log in to access settings.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col">
            <Header variant="page" title="Settings" showBack={true} backHref="/dashboard" />

            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
            </div>

            <main className="flex-1 relative z-10 py-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Profile Section */}
                        <section className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <User className="h-6 w-6 text-indigo-400" />
                                <h2 className="text-xl font-bold">Profile</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400">Name</label>
                                    <p className="text-white font-medium">{session.user.name || "Not set"}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Email</label>
                                    <p className="text-white font-medium">{session.user.email}</p>
                                </div>
                                {session.user.image && (
                                    <div>
                                        <label className="text-sm text-gray-400">Profile Picture</label>
                                        <img
                                            src={session.user.image}
                                            alt="Profile"
                                            className="w-16 h-16 rounded-full mt-2 border-2 border-indigo-500/30"
                                        />
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Privacy Section */}
                        <section className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <Shield className="h-6 w-6 text-indigo-400" />
                                <h2 className="text-xl font-bold">Privacy</h2>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-2">Analytics Tracking</h3>
                                    <p className="text-gray-400 text-xs mb-4">
                                        We use PostHog to help us understand how people use Vaulted. This data is anonymized and helps us prioritize features.
                                    </p>
                                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5">
                                        <div className="text-sm">
                                            <p className="font-medium">Anonymous Usage Data</p>
                                            <p className="text-gray-500 text-xs">Improve Vaulted by sharing usage patterns</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const current = localStorage.getItem("cookie_consent") === "accepted";
                                                const newValue = !current ? "accepted" : "declined";
                                                localStorage.setItem("cookie_consent", newValue);
                                                if (newValue === "accepted") {
                                                    import("posthog-js").then(ph => ph.default.opt_in_capturing());
                                                } else {
                                                    import("posthog-js").then(ph => ph.default.opt_out_capturing());
                                                }
                                                // Force re-render if needed, though for simplicity we just toggle local storage
                                                window.location.reload(); // Simple way to sync for now
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-transparent ring-offset-2 ring-offset-slate-900 ${(typeof window !== 'undefined' && localStorage.getItem("cookie_consent") === "accepted") ? 'bg-indigo-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(typeof window !== 'undefined' && localStorage.getItem("cookie_consent") === "accepted") ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5">
                                    <h3 className="text-sm font-medium text-gray-300 mb-2">Data Management</h3>
                                    <p className="text-gray-400 text-xs mb-4">
                                        You can request a copy of your data or delete your account at any time.
                                    </p>
                                    <button
                                        className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium transition-colors"
                                        onClick={() => alert("Data export coming soon!")}
                                    >
                                        Export My Data
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Danger Zone */}
                        <section className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <Trash2 className="h-6 w-6 text-red-400" />
                                <h2 className="text-xl font-bold text-red-400">Danger Zone</h2>
                            </div>

                            <p className="text-gray-300 text-sm mb-6">
                                Permanently delete your account and all associated data. This action cannot be undone.
                            </p>

                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete My Account
                            </button>
                        </section>
                    </motion.div>
                </div>
            </main>

            <DeleteAccountModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
            />
        </div>
    );
}
