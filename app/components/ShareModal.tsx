"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link as LinkIcon, MessageCircle, Send } from "lucide-react";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: "ITEM" | "LIST" | "SMART_LIST";
    id?: string; // ID is optional for SMART_LIST if it's based purely on tags in URL
    title: string;
    // For smart lists that might not have a DB ID yet, we might need tags
    tags?: string;
    mode?: "SHARE" | "COLLABORATE";
}

export function ShareModal({ isOpen, onClose, type, id, title, tags, mode = "SHARE" }: ShareModalProps) {
    const [shareUrl, setShareUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [permission, setPermission] = useState<"READ" | "WRITE">("READ");

    // Determine the preview image URL
    // For items/lists we have IDs. For smart lists... we need a strategy. 
    // If it's a saved smart list, it has an ID. 
    // If it's an unsaved smart list (preview), we might not have a stable OG image unless we built a generic endpoint.
    // For now, let's assume valid ID for Items/Saved Lists.
    // Use a generic fallback for 'unsaved' smart lists or if id is missing.
    const previewImageUrl = id
        ? (type === 'ITEM' ? `/items/${id}/opengraph-image` : `/lists/${id}/opengraph-image`)
        : '/opengraph-image'; // Fallback project OG

    useEffect(() => {
        if (isOpen) {
            // Reset permission to default when opening, unless we want to persist? Default to READ is safer.
            setPermission("READ");
            generateLink("READ");
        }
    }, [isOpen, type, id, tags]);

    // Regenerate link when permission changes (only for COLLABORATE mode)
    useEffect(() => {
        if (isOpen && mode === "COLLABORATE") {
            generateLink(permission);
        }
    }, [permission]);

    const generateLink = async (perm: "READ" | "WRITE" = "READ") => {
        setLoading(true);
        try {
            // If we already have a full URL (e.g. valid window location), we could start with that
            // But checking the API is safer for tracking/shortening if implemented.
            // Current API requires ID. If no ID (preview mode), fallback to window.location.
            if (!id && typeof window !== 'undefined') {
                setShareUrl(window.location.href);
                setLoading(false);
                return;
            }

            const res = await fetch("/api/share/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: type === 'SMART_LIST' ? 'LIST' : type,
                    id,
                    permission: perm
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setShareUrl(data.url);
            } else {
                // Fallback
                if (typeof window !== 'undefined') setShareUrl(window.location.href);
            }
        } catch (e) {
            console.error("Link generation failed", e);
            if (typeof window !== 'undefined') setShareUrl(window.location.href);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error("Copy failed", e);
        }
    };

    const shareOptions = [
        {
            name: "Messages",
            icon: <MessageCircle className="w-6 h-6 text-white" />,
            color: "bg-green-500",
            action: () => window.location.href = `sms:?&body=${encodeURIComponent(`Check out this ${title}: ${shareUrl}`)}`
        },
        {
            name: "WhatsApp",
            icon: <div className="w-6 h-6 text-white font-bold flex items-center justify-center text-lg">WA</div>, // Lucide doesn't have WA, using text or finding SVG path later
            color: "bg-[#25D366]",
            action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`, '_blank')
        },
        {
            name: "Messenger",
            icon: <div className="w-6 h-6 text-white font-bold flex items-center justify-center text-xs">Msgr</div>,
            color: "bg-gradient-to-tr from-blue-500 to-purple-500",
            action: () => {
                // FB Messenger often requires SDK, but we can try generic fb share or simply copy link hint
                window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=YOUR_APP_ID&redirect_uri=${encodeURIComponent(shareUrl)}`, '_blank');
            }
        },
        {
            name: copied ? "Copied!" : "Copy link",
            icon: <LinkIcon className="w-6 h-6 text-black" />,
            color: "bg-gray-200",
            textColor: "text-black", // specialized logic for this one
            action: handleCopy
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {mode === "COLLABORATE" ? "Invite Collaborator" : "Share"}
                                </h3>
                                <div className="w-9" /> {/* Spacer for centering */}
                            </div>

                            <div className="p-6 overflow-y-auto">
                                {/* Permission Toggle (Only for COLLABORATE mode) */}
                                {mode === "COLLABORATE" && (
                                    <div className="mb-6">
                                        <label className="block text-sm font-bold text-gray-900 mb-2">Permission Level</label>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPermission('WRITE')}
                                                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-2 ${permission === 'WRITE'
                                                    ? 'bg-[#191919] text-white border-[#191919] shadow-md transform scale-[1.02]'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                                                    }`}
                                            >
                                                {permission === 'WRITE' && (
                                                    <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                                Can Edit
                                            </button>
                                            <button
                                                onClick={() => setPermission('READ')}
                                                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-2 ${permission === 'READ'
                                                    ? 'bg-[#191919] text-white border-[#191919] shadow-md transform scale-[1.02]'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                                                    }`}
                                            >
                                                {permission === 'READ' && (
                                                    <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                                View Only
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Preview Card */}
                                <div className="flex gap-4 mb-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 shrink-0">
                                        {/* We use the OG image route as the source */}
                                        <img
                                            src={previewImageUrl}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="p-4 flex flex-col justify-center min-w-0">
                                        <h4 className="font-bold text-gray-900 leading-tight mb-1 line-clamp-2">
                                            {title}
                                        </h4>
                                        <p className="text-sm text-gray-500">
                                            {type === 'ITEM' ? 'Ranked in Vaulted' : 'Curated List'}
                                        </p>
                                        <div className="text-xs text-green-600 font-bold mt-2">
                                            Vaulted / {type === 'ITEM' ? 'Item' : 'List'}
                                        </div>
                                    </div>
                                </div>

                                {/* Social Grid */}
                                <div className="grid grid-cols-3 sm:grid-cols-3 gap-y-8 gap-x-4">
                                    {shareOptions.map((opt) => (
                                        <button
                                            key={opt.name}
                                            onClick={opt.action}
                                            className="flex flex-col items-center gap-2 group"
                                        >
                                            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform ${opt.color}`}>
                                                {opt.icon}
                                            </div>
                                            <span className="text-xs font-medium text-gray-600 group-hover:text-black transition-colors">
                                                {opt.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

// Helper SVG for generic share if needed, keeping code clean primarily with Lucide
