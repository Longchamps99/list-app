"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Trash2, CheckCircle, AlertCircle, ImageIcon } from "lucide-react";
import posthog from "posthog-js";

interface ParsedItem {
    id: string; // temp id for UI
    title: string;
    description?: string;
    imageUrl?: string;
    tags: string[];
}

export default function SmartPastePage() {
    const router = useRouter();
    const [step, setStep] = useState<"input" | "preview">("input");
    const [rawText, setRawText] = useState("");
    const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleProcess = async () => {
        if (!rawText.trim()) return;
        setIsProcessing(true);

        // 1. Client-side Split & Clean
        const lines = rawText.split(/\n+/).filter(line => line.trim().length > 0);

        const cleanedLines = lines.map(line => {
            // Remove bullets, numbers, markdown
            return line.replace(/^[\s\t]*([*•\-]|\d+\.|\d+\))\s*/, "").trim();
        }).filter(line => line.length > 0);

        // 2. AI Enrichment (Gemini)
        try {
            const res = await fetch("/api/enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: cleanedLines })
            });

            if (res.ok) {
                const data = await res.json();
                const enriched = data.items.map((item: any, idx: number) => ({
                    id: `temp-${idx}`,
                    title: item.title,
                    description: item.description,
                    imageUrl: item.imageUrl,
                    tags: item.tags || []
                }));
                setParsedItems(enriched);
                setStep("preview");
                posthog.capture('smart_paste_processed', { count: enriched.length });
            } else {
                // Fallback if AI fails: just use cleaned lines
                const basic = cleanedLines.map((line, idx) => ({
                    id: `temp-${idx}`,
                    title: line,
                    tags: []
                }));
                setParsedItems(basic);
                setStep("preview");
            }
        } catch (e) {
            console.error("Enrichment failed", e);
            // Fallback
            const basic = cleanedLines.map((line, idx) => ({
                id: `temp-${idx}`,
                title: line,
                tags: []
            }));
            setParsedItems(basic);
            setStep("preview");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/items/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: parsedItems })
            });

            if (res.ok) {
                const data = await res.json();
                posthog.capture('smart_paste_saved', { count: data.count });
                router.push("/dashboard");
            } else {
                alert("Failed to save items. Please try again.");
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteItem = (id: string) => {
        setParsedItems(prev => prev.filter(i => i.id !== id));
    };

    const handleUpdateItem = (id: string, updates: Partial<ParsedItem>) => {
        setParsedItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            <Header variant="page" title="Smart Paste" showBack={true} backHref="/dashboard" />

            <main className="flex-1 max-w-4xl mx-auto w-full p-6">
                <AnimatePresence mode="wait">
                    {step === "input" ? (
                        <motion.div
                            key="input-step"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            <div className="text-center mb-8">
                                <span className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-full mb-4 ring-1 ring-indigo-500/30">
                                    <Sparkles className="h-6 w-6 text-indigo-400" />
                                </span>
                                <h1 className="text-3xl font-bold mb-2">Paste Your List</h1>
                                <p className="text-gray-400">
                                    Copy valid text from your Notes, Excel, or Docs. We'll clean it up and automatically tag it using AI.
                                </p>
                            </div>

                            <div className="relative">
                                <textarea
                                    className="w-full h-64 bg-slate-900/50 border border-white/10 rounded-xl p-6 text-lg placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono resize-none appearance-none outline-none"
                                    placeholder={`1. The Matrix\n2. Inception\n3. Interstellar\n...`}
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                />
                                <div className="absolute bottom-4 right-4 text-xs text-gray-500">
                                    {rawText.split(/\n/).length} lines
                                </div>
                            </div>

                            <button
                                onClick={handleProcess}
                                disabled={!rawText.trim() || isProcessing}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing with Gemini AI...
                                    </>
                                ) : (
                                    <>
                                        Process List <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="preview-step"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold">Review & Save</h2>
                                    <p className="text-gray-400 text-sm">Found {parsedItems.length} items</p>
                                </div>
                                <button
                                    onClick={() => setStep("input")}
                                    className="text-sm text-gray-500 hover:text-white transition-colors"
                                >
                                    Back to Edit
                                </button>
                            </div>

                            <div className="space-y-4">
                                {parsedItems.map((item) => (
                                    <div key={item.id} className="bg-slate-900 border border-white/10 rounded-lg p-4 flex gap-4 group hover:border-indigo-500/30 transition-colors">
                                        {/* Image Preview */}
                                        <div className="w-24 h-24 bg-black/40 rounded-lg flex-shrink-0 overflow-hidden border border-white/5 relative">
                                            {item.imageUrl ? (
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                    }}
                                                />
                                            ) : null}
                                            <div className={`absolute inset-0 flex items-center justify-center text-gray-600 ${item.imageUrl ? 'hidden' : ''}`}>
                                                <ImageIcon className="h-8 w-8" />
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-3">
                                            <div className="flex gap-2">
                                                <input
                                                    value={item.title}
                                                    onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                                                    className="flex-1 bg-transparent font-bold text-lg text-white focus:outline-none focus:border-b border-indigo-500 placeholder-white/20"
                                                    placeholder="Item Title"
                                                />
                                            </div>

                                            <textarea
                                                value={item.description || ""}
                                                onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                                                className="w-full bg-white/5 rounded-md p-2 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                                                rows={2}
                                                placeholder="Add a description..."
                                            />

                                            {/* Tags Input Display */}
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {item.tags.map((tag, i) => (
                                                    <span key={i} className="px-3 py-1 bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-300 border border-green-500/30 rounded-full text-xs font-medium flex items-center gap-1 select-none">
                                                        #{tag}
                                                        <button
                                                            onClick={() => handleUpdateItem(item.id, { tags: item.tags.filter((_, idx) => idx !== i) })}
                                                            className="hover:text-red-400 font-bold ml-1 p-0.5 rounded-full hover:bg-white/10 transition"
                                                            title="Remove tag"
                                                        >
                                                            &times;
                                                        </button>
                                                    </span>
                                                ))}
                                                <input
                                                    placeholder="+ tag"
                                                    className="bg-transparent text-xs text-gray-500 focus:outline-none focus:text-white w-20 px-1"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = e.currentTarget.value.trim();
                                                            if (val) {
                                                                handleUpdateItem(item.id, { tags: [...item.tags, val] });
                                                                e.currentTarget.value = "";
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="text-gray-600 hover:text-red-400 transition-colors self-start p-1"
                                            title="Remove Item"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleSaveAll}
                                disabled={parsedItems.length === 0 || isSaving}
                                className="sticky bottom-6 w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-lg shadow-lg shadow-green-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving to Vault...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-5 w-5" />
                                        Save {parsedItems.length} Items
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
