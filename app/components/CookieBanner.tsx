"use client";

import { useState, useEffect } from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Cookie } from "lucide-react";

export default function CookieBanner() {
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        // Check if user has already made a choice
        const consent = localStorage.getItem("cookie_consent");

        if (!consent) {
            setShowBanner(true);
        } else if (consent === "declined") {
            posthog.opt_out_capturing();
        } else if (consent === "accepted") {
            posthog.opt_in_capturing();
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem("cookie_consent", "accepted");
        posthog.opt_in_capturing();
        setShowBanner(false);
    };

    const handleDecline = () => {
        localStorage.setItem("cookie_consent", "declined");
        posthog.opt_out_capturing();
        setShowBanner(false);
    };

    return (
        <AnimatePresence>
            {showBanner && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-[100]"
                >
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-shrink-0 bg-indigo-500/10 p-4 rounded-xl">
                            <Cookie className="h-8 w-8 text-indigo-400" />
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-lg font-bold text-white mb-2">Cookie Consent</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                We use cookies to analyze site traffic and improve your experience.
                                By clicking "Accept", you consent to our use of analytics cookies.
                                Read our <a href="/privacy" className="text-indigo-400 hover:underline">Privacy Policy</a> to learn more.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <button
                                onClick={handleDecline}
                                className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                            >
                                Decline
                            </button>
                            <button
                                onClick={handleAccept}
                                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                            >
                                Accept All
                            </button>
                        </div>

                        <button
                            onClick={() => setShowBanner(false)}
                            className="absolute top-4 right-4 p-1 text-gray-500 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
