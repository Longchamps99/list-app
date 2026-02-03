"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "../components/Header";
import { DeleteAccountModal } from "../components/DeleteAccountModal";
import { User, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsPage() {
    const { data: session } = useSession();
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    if (!session?.user) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <p className="text-[var(--swiss-text-muted)]">Please log in to access settings.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-[var(--swiss-black)] flex flex-col">
            <Header variant="page" title="Settings" showBack={true} backHref="/dashboard" />

            <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Profile Section */}
                        <section className="bg-white border border-[var(--swiss-border)] rounded-lg p-6 mb-8">
                            <div className="flex items-center gap-4 mb-6">
                                <User className="h-6 w-6 text-[var(--swiss-text-secondary)]" />
                                <h2 className="text-xl font-bold text-[var(--swiss-black)]">Profile</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-[var(--swiss-text-muted)]">Name</label>
                                    <p className="text-[var(--swiss-black)] font-medium">{session.user.name || "Not set"}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-[var(--swiss-text-muted)]">Email</label>
                                    <p className="text-[var(--swiss-black)] font-medium">{session.user.email}</p>
                                </div>
                                {session.user.image && (
                                    <div>
                                        <label className="text-sm text-[var(--swiss-text-muted)]">Profile Picture</label>
                                        <img
                                            src={session.user.image}
                                            alt="Profile"
                                            className="w-16 h-16 rounded-full mt-2 border-2 border-[var(--swiss-border)]"
                                        />
                                    </div>
                                )}
                            </div>
                        </section>


                        {/* Danger Zone */}
                        <section className="bg-[var(--swiss-red-light)] border border-[var(--swiss-red)]/30 rounded-lg p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <Trash2 className="h-6 w-6 text-[var(--swiss-red)]" />
                                <h2 className="text-xl font-bold text-[var(--swiss-red)]">Danger Zone</h2>
                            </div>

                            <p className="text-[var(--swiss-text-secondary)] text-sm mb-6">
                                Permanently delete your account and all associated data. This action cannot be undone.
                            </p>

                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="px-6 py-2.5 bg-[var(--swiss-red)] hover:opacity-90 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
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
