"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
    const [confirmText, setConfirmText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDelete = async () => {
        if (confirmText !== "DELETE") return;

        setIsDeleting(true);
        setError(null);

        try {
            const res = await fetch("/api/user", { method: "DELETE" });

            if (!res.ok) {
                throw new Error("Failed to delete account");
            }

            // Sign out and redirect to landing
            await signOut({ callbackUrl: "/" });
        } catch (err) {
            setError("Something went wrong. Please try again.");
            setIsDeleting(false);
        }
    };

    const handleClose = () => {
        setConfirmText("");
        setError(null);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-[201] p-4"
                    >
                        <div className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/20 rounded-full">
                                        <AlertTriangle className="h-6 w-6 text-red-400" />
                                    </div>
                                    <h2 className="text-xl font-bold text-white">Delete Account</h2>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="p-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Warning */}
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                                <p className="text-red-200 text-sm">
                                    <strong>This action is permanent and cannot be undone.</strong>
                                </p>
                                <p className="text-red-200/80 text-sm mt-2">
                                    All your items, lists, shared content, and account data will be permanently deleted.
                                </p>
                            </div>

                            {/* Confirmation Input */}
                            <div className="mb-6">
                                <label className="block text-sm text-gray-400 mb-2">
                                    Type <span className="font-mono text-red-400 font-bold">DELETE</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                                    disabled={isDeleting}
                                />
                            </div>

                            {/* Error Message */}
                            {error && (
                                <p className="text-red-400 text-sm mb-4">{error}</p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg font-medium transition-colors"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={confirmText !== "DELETE" || isDeleting}
                                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                                >
                                    {isDeleting ? "Deleting..." : "Delete Account"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
