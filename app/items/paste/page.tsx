"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Trash2, CheckCircle, AlertCircle, ImageIcon, Plus, X, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { SafeImage } from "../../../components/SafeImage";
import {
    tagPillClass,
    primaryButtonClass,
    secondaryButtonClass,
    inputClass,
    cardClass
} from "../../components/styles";

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

            console.log("Bulk save response status:", res.status, res.statusText);

            if (res.ok) {
                const data = await res.json();
                console.log("Bulk save successful:", data);
                posthog.capture('smart_paste_saved', { count: data.count });
                router.push("/dashboard");
            } else {
                const errorText = await res.text();
                console.error("Failed to save items. Status:", res.status, "Response:", errorText);
                alert(`Failed to save items: ${res.statusText}`);
            }
        } catch (e) {
            console.error("Error saving items:", e);
            alert("An error occurred while saving. Please try again.");
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
        <div className="min-h-screen bg-white text-[var(--swiss-black)] flex flex-col">
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
                            <div className="text-center mb-12">
                                <span className="inline-flex items-center justify-center p-4 bg-[var(--swiss-off-white)] rounded-full mb-6 border border-[var(--swiss-border)]">
                                    <Sparkles className="h-8 w-8 text-[var(--swiss-text-secondary)]" />
                                </span>
                                <h1 className="text-4xl font-bold mb-4 text-[var(--swiss-black)] tracking-tight">Smart Paste</h1>
                                <p className="text-lg text-[var(--swiss-text-muted)] max-w-xl mx-auto leading-relaxed">
                                    Copy valid text from your Notes, Excel, or Docs. We&apos;ll clean it up and automatically enrich it using Gemini AI.
                                </p>
                            </div>

                            <div className="relative group">
                                <motion.div
                                    className="relative bg-white border-2 border-[var(--swiss-border)] rounded-lg overflow-hidden p-1 transition-all hover:border-[var(--swiss-black)]"
                                >
                                    <textarea
                                        autoFocus
                                        className="w-full h-80 bg-transparent border-none p-8 text-lg placeholder-[var(--swiss-text-muted)] focus:ring-0 transition-all font-mono resize-none appearance-none outline-none text-[var(--swiss-black)]"
                                        placeholder={`1. The Matrix\n2. Inception\n3. Interstellar\n...`}
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                    />
                                    <div className="absolute bottom-6 right-6 text-xs font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest">
                                        {rawText.split(/\n/).filter(l => l.trim()).length} Items Detected
                                    </div>
                                </motion.div>
                                <p className="text-center mt-6 text-[var(--swiss-text-muted)] font-medium text-xs tracking-widest uppercase">
                                    AI-powered list detection active
                                </p>
                            </div>

                            <button
                                onClick={handleProcess}
                                disabled={!rawText.trim() || isProcessing}
                                className={`${primaryButtonClass} w-full py-5 text-lg flex items-center justify-center gap-3 rounded-lg`}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        Processing with Gemini AI...
                                    </>
                                ) : (
                                    <>
                                        Process List <ArrowRight className="h-6 w-6" />
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
                                    <h2 className="text-2xl font-bold text-[var(--swiss-black)]">Review & Save</h2>
                                    <p className="text-[var(--swiss-text-muted)] text-sm">Found {parsedItems.length} items</p>
                                </div>
                                <button
                                    onClick={() => setStep("input")}
                                    className={`${secondaryButtonClass} py-2 px-4 text-xs font-bold uppercase tracking-widest`}
                                >
                                    Back to Edit
                                </button>
                            </div>

                            <div className="space-y-4">
                                {parsedItems.map((item) => (
                                    <div key={item.id} className="bg-white border border-[var(--swiss-border)] rounded-lg flex gap-6 p-6 group relative hover:border-[var(--swiss-black)] transition-all">
                                        {/* Image Preview */}
                                        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[var(--swiss-off-white)] rounded-lg flex-shrink-0 overflow-hidden border border-[var(--swiss-border)] relative">
                                            <SafeImage
                                                src={item.imageUrl}
                                                alt={item.title}
                                                className="w-full h-full object-cover"
                                                fallback={<ImageIcon className="h-10 w-10 text-[var(--swiss-text-muted)]" />}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0 space-y-4">
                                            <div className="flex gap-2">
                                                <input
                                                    value={item.title}
                                                    onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                                                    className="flex-1 bg-transparent border-b border-[var(--swiss-border)] focus:border-[var(--swiss-black)] focus:outline-none p-1 -ml-1 text-xl font-bold text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)] transition-all"
                                                    placeholder="Item Title"
                                                />
                                            </div>

                                            <div className="bg-[var(--swiss-off-white)] rounded-lg p-3 border border-[var(--swiss-border)]">
                                                <label className="block text-[9px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest mb-1">Description</label>
                                                <textarea
                                                    value={item.description || ""}
                                                    onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-[var(--swiss-text-secondary)] leading-relaxed resize-none overflow-hidden min-h-[60px]"
                                                    rows={2}
                                                    placeholder="Add a description..."
                                                    onInput={(e) => {
                                                        const target = e.target as HTMLTextAreaElement;
                                                        target.style.height = 'auto';
                                                        target.style.height = target.scrollHeight + 'px';
                                                    }}
                                                />
                                            </div>

                                            {/* Tags Input Display */}
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {item.tags.map((tag, i) => (
                                                    <span key={i} className="bg-[var(--swiss-green-light)] text-[var(--swiss-green)] border border-[var(--swiss-green)]/30 px-3 py-1 rounded-full text-xs font-medium flex items-center">
                                                        #{tag}
                                                        <button
                                                            onClick={() => handleUpdateItem(item.id, { tags: item.tags.filter((_, idx) => idx !== i) })}
                                                            className="ml-1.5 hover:text-[var(--swiss-red)] transition-colors"
                                                            title="Remove tag"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                <div className="relative flex items-center">
                                                    <Plus className="absolute left-3 h-3 w-3 text-[var(--swiss-text-muted)] pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        className="bg-[var(--swiss-off-white)] border border-dashed border-[var(--swiss-border)] rounded-full pl-8 pr-4 py-1 text-[10px] text-[var(--swiss-black)] w-28 focus:outline-none focus:ring-1 focus:ring-[var(--swiss-black)] focus:border-[var(--swiss-text-muted)] placeholder:text-[var(--swiss-text-muted)] transition-all font-bold uppercase"
                                                        placeholder="Tag"
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
                                        </div>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="text-[var(--swiss-text-muted)] hover:text-[var(--swiss-red)] transition-colors self-start p-2 hover:bg-[var(--swiss-red-light)] rounded-lg"
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
                                className="bg-[var(--swiss-black)] text-white hover:bg-[var(--swiss-accent-hover)] transition-all sticky bottom-6 w-full py-5 text-lg flex items-center justify-center gap-3 rounded-lg font-bold"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        Saving to Vault...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-6 w-6" />
                                        Save {parsedItems.length} Items to Vault
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
