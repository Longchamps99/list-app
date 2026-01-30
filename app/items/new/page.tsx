"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "../../components/Header";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, X, Edit2, ExternalLink, MapPin, Loader2, Image as ImageIcon, Link as LinkIcon, Upload } from "lucide-react";
import { SafeImage } from "../../../components/SafeImage";
import {
    tagPillClass,
    primaryButtonClass,
    secondaryButtonClass,
    inputClass,
    cardClass,
    iconButtonClass
} from "../../components/styles";

// Debounce helper is inlined here for simplicity
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function NewItemPage() {
    const router = useRouter();

    // App State
    const [hasSearched, setHasSearched] = useState(false);
    const [savedItemId, setSavedItemId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [itemLink, setItemLink] = useState("");
    const [location, setLocation] = useState("");
    const [tags, setTags] = useState<string[]>([]);

    // UI State
    const [isEnriching, setIsEnriching] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [showCandidateModal, setShowCandidateModal] = useState(false);
    const [isEditingThumbnail, setIsEditingThumbnail] = useState(false);
    const [thumbnailMode, setThumbnailMode] = useState<"url" | "upload">("url");
    const [newTagValue, setNewTagValue] = useState("");
    const [isAddingTag, setIsAddingTag] = useState(false);

    // Debounced values for auto-saving
    const debouncedTitle = useDebounce(title, 1000);
    const debouncedDescription = useDebounce(description, 1000);
    const debouncedImageUrl = useDebounce(imageUrl, 1000);
    const debouncedLink = useDebounce(itemLink, 1000);
    const debouncedLocation = useDebounce(location, 1000);

    // Auto-save effect
    useEffect(() => {
        if (savedItemId && hasSearched) {
            saveChanges();
        }
    }, [debouncedTitle, debouncedDescription, debouncedImageUrl, debouncedLink, debouncedLocation]);

    const saveChanges = async (specificUpdates?: any) => {
        if (!savedItemId) return;
        setIsSaving(true);
        try {
            const updates = specificUpdates || {
                title,
                content: description,
                imageUrl,
                link: itemLink,
                location
            };
            const res = await fetch(`/api/items/${savedItemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (!res.ok) console.error("Failed to auto-save");
        } catch (e) {
            console.error("Auto-save error:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const searchForCandidates = async () => {
        if (!title.trim()) return;

        const isUrl = /^https?:\/\//i.test(title.trim());
        if (isUrl) {
            enrichItem(title);
            return;
        }

        setIsSearching(true);
        try {
            const params = new URLSearchParams({ q: title });
            const res = await fetch(`/api/search?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    setCandidates(data);
                    setShowCandidateModal(true);
                } else {
                    enrichItem(title);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    }

    const enrichItem = async (queryOrTitle: string, entityId?: string, candidateImageUrl?: string, candidateType?: string) => {
        setIsEnriching(true);
        try {
            const params = new URLSearchParams({ q: queryOrTitle });
            if (entityId) params.append("entityId", entityId);
            if (candidateImageUrl) params.append("imageUrl", candidateImageUrl);
            if (candidateType) params.append("type", candidateType);

            const res = await fetch(`/api/enrich?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data && Object.keys(data).length > 0) {
                    // Update local state
                    const newTitle = data.title || title;
                    const newDesc = data.description || "";
                    const newImg = data.imageUrl || "";
                    const newLink = data.link || "";
                    const newLoc = data.location || "";
                    const newTags = data.tags || [];

                    setTitle(newTitle);
                    setDescription(newDesc);
                    setImageUrl(newImg);
                    setItemLink(newLink);
                    setLocation(newLoc);
                    setTags(newTags);

                    // INITIAL PERSISTENCE: Create the item record
                    const createRes = await fetch(`/api/items`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: newTitle,
                            content: newDesc,
                            imageUrl: newImg,
                            link: newLink,
                            location: newLoc,
                            customTags: newTags
                        })
                    });

                    if (createRes.ok) {
                        const savedData = await createRes.json();
                        setSavedItemId(savedData.id);
                        setHasSearched(true);
                        posthog.capture('new_item_created_from_search', {
                            item_id: savedData.id,
                            title: newTitle
                        });
                    } else {
                        alert("Initial save failed. Please try searching again.");
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsEnriching(false);
            setShowCandidateModal(false);
        }
    };

    const addTag = async (tagName: string) => {
        const normalized = tagName.trim().toLowerCase();
        if (!normalized || tags.includes(normalized)) return;

        setTags(prev => [...prev, normalized]);
        if (savedItemId) {
            try {
                await fetch(`/api/items/${savedItemId}/tags`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tagName: normalized })
                });
            } catch (e) {
                console.error("Failed to save tag", e);
            }
        }
    };

    const removeTag = async (tagName: string) => {
        setTags(prev => prev.filter(t => t !== tagName));
        // Note: Full tag removal would require tagId or a different API.
        // For now, we'll keep it in state and it will stay in DB until real tag management is added.
        // Or we could implement a 'setTags' API.
    };

    // Thumbnail upload mock
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result as string);
                setIsEditingThumbnail(false);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col relative overflow-hidden">
            <Header
                variant="page"
                title="Add New Item"
                showBack={true}
                backHref="/dashboard"
            >
                {isSaving && (
                    <div className="ml-auto flex items-center gap-2 text-indigo-400 text-xs font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                    </div>
                )}
            </Header>

            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
            </div>

            <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 relative z-10">
                <AnimatePresence mode="wait">
                    {!hasSearched ? (
                        <motion.div
                            key="initial"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-2xl w-full"
                        >
                            {/* Instructions (Expanded) */}
                            <div className="mb-12 text-gray-200 leading-relaxed bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
                                <h2 className="text-2xl font-bold text-white mb-4">Hello! What are we adding today?</h2>
                                <p className="text-lg text-gray-400">
                                    Favorite movie? Book? Hotel? Nail polish color? Football player? Drop it in the box below and let AI help you fill in the details.
                                </p>
                                <div className="mt-8 flex items-center gap-4 text-sm font-medium text-indigo-400">
                                    <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                        <Search className="h-5 w-5" />
                                    </div>
                                    <span>Try &quot;The Dark Knight&quot; or &quot;Ritz Paris&quot;</span>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Have many items?</span>
                                    <Link href="/items/paste" className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-4 decoration-emerald-500/50 transition-all flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        Try Smart Paste
                                    </Link>
                                </div>
                            </div>

                            {/* Glowing Search Box */}
                            <div className="relative group">
                                <motion.div
                                    animate={{
                                        boxShadow: [
                                            "0 0 0px 0px rgba(99, 102, 241, 0)",
                                            "0 0 30px 4px rgba(99, 102, 241, 0.4)",
                                            "0 0 0px 0px rgba(99, 102, 241, 0)"
                                        ],
                                        borderColor: ["rgba(255,255,255,0.1)", "rgba(99, 102, 241, 0.5)", "rgba(255,255,255,0.1)"]
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                    className="relative flex items-center bg-slate-800/50 backdrop-blur-xl border-2 rounded-2xl overflow-hidden p-2 transition-all hover:border-indigo-500/50 shadow-2xl"
                                >
                                    <div className="pl-6 pr-4">
                                        {isSearching || isEnriching ? (
                                            <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                                        ) : (
                                            <Search className="h-6 w-6 text-indigo-400" />
                                        )}
                                    </div>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="flex-1 bg-transparent border-none focus:ring-0 text-xl py-6 text-white placeholder-gray-500"
                                        placeholder="Enter title or link..."
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') searchForCandidates();
                                        }}
                                    />
                                    <button
                                        onClick={searchForCandidates}
                                        disabled={!title.trim() || isSearching || isEnriching}
                                        className={`${primaryButtonClass} mr-2 py-4 px-8 rounded-xl`}
                                    >
                                        Search
                                    </button>
                                </motion.div>
                                <p className="text-center mt-6 text-indigo-400/60 font-medium animate-pulse text-xs tracking-widest uppercase">
                                    AI-powered enrichment active
                                </p>
                            </div>
                        </motion.div>
                    ) : (
                        /* DASHBOARD-STYLE TILE VIEW RESULTS */
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="max-w-4xl w-full"
                        >
                            <div className={`${cardClass} flex flex-col overflow-hidden relative p-0`}>
                                <div className="p-8 sm:p-10 flex flex-col md:flex-row gap-8 items-start relative box-border">
                                    {/* Thumbnail Selection Area */}
                                    <div className="relative group shrink-0">
                                        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/20 bg-slate-800">
                                            <SafeImage
                                                src={imageUrl}
                                                alt={title}
                                                className="w-full h-full object-cover"
                                                fallback={<ImageIcon className="h-10 w-10 text-gray-600" />}
                                            />
                                        </div>
                                        <button
                                            onClick={() => setIsEditingThumbnail(!isEditingThumbnail)}
                                            className="absolute bottom-1 right-1 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg transition-transform hover:scale-110 active:scale-90 z-20"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>

                                        {/* Thumbnail Choice Overlay */}
                                        <AnimatePresence>
                                            {isEditingThumbnail && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                                    className="absolute top-full mt-4 left-0 w-72 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 p-4"
                                                >
                                                    <div className="flex justify-between items-center mb-4">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Update Thumbnail</span>
                                                        <button onClick={() => setIsEditingThumbnail(false)} className="text-gray-500 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
                                                    </div>
                                                    <div className="flex gap-2 mb-4 p-1 bg-slate-800/50 rounded-lg">
                                                        <button
                                                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${thumbnailMode === 'url' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white'}`}
                                                            onClick={() => setThumbnailMode('url')}
                                                        >URL</button>
                                                        <button
                                                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${thumbnailMode === 'upload' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white'}`}
                                                            onClick={() => setThumbnailMode('upload')}
                                                        >Upload</button>
                                                    </div>
                                                    {thumbnailMode === 'url' ? (
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            className={inputClass}
                                                            placeholder="https://..."
                                                            value={imageUrl}
                                                            onChange={(e) => setImageUrl(e.target.value)}
                                                        />
                                                    ) : (
                                                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-lg p-6 hover:bg-white/5 cursor-pointer transition-colors group/upload">
                                                            <Upload className="h-6 w-6 text-indigo-400 mb-2 group-hover/upload:scale-110 transition-transform" />
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Choose Image</span>
                                                            <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                                                        </label>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-1 min-w-0 space-y-6">
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-500/20 rounded-md p-1 -ml-1 text-3xl sm:text-4xl font-bold text-white placeholder-white/10 transition-all"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="Title"
                                            />
                                            {/* Green Style Tags */}
                                            <div className="flex flex-wrap gap-2">
                                                {tags.map((tag, idx) => (
                                                    <span
                                                        key={`${tag}-${idx}`}
                                                        className={tagPillClass}
                                                    >
                                                        #{tag}
                                                        <button onClick={() => removeTag(tag)} className="ml-1.5 hover:text-red-400 transition-colors">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                {/* Persistent tag input at the end of the list */}
                                                <div className="relative flex items-center">
                                                    <Plus className="absolute left-3 h-3 w-3 text-gray-500 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        className="bg-slate-800/30 border border-dashed border-white/20 rounded-full pl-8 pr-4 py-1 text-xs text-white w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500/50 focus:bg-slate-800/50 placeholder:text-gray-500 transition-all"
                                                        placeholder="Add tag..."
                                                        value={newTagValue}
                                                        onChange={(e) => setNewTagValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && newTagValue.trim()) {
                                                                addTag(newTagValue);
                                                                setNewTagValue("");
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Full Length Description */}
                                        <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 shadow-inner focus-within:border-indigo-500/30 transition-all">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Description</label>
                                            <textarea
                                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-300 leading-relaxed resize-none overflow-hidden min-h-[100px]"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Tell us everything about this..."
                                                onInput={(e) => {
                                                    const target = e.target as HTMLTextAreaElement;
                                                    target.style.height = 'auto';
                                                    target.style.height = target.scrollHeight + 'px';
                                                }}
                                            />
                                        </div>

                                        {/* Links & metadata */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="flex items-center gap-3 bg-slate-800/30 border border-white/5 px-4 py-3 rounded-xl group hover:border-indigo-500/20 focus-within:border-indigo-500/50 transition-all">
                                                <LinkIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Website</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            className="bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-200 placeholder-gray-600 w-full truncate"
                                                            value={itemLink}
                                                            onChange={(e) => setItemLink(e.target.value)}
                                                            placeholder="https://..."
                                                        />
                                                        {itemLink && (
                                                            <a href={itemLink} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 hover:text-indigo-400 text-gray-500 transition-colors">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 bg-slate-800/30 border border-white/5 px-4 py-3 rounded-xl group hover:border-indigo-500/20 focus-within:border-indigo-500/50 transition-all">
                                                <MapPin className="h-4 w-4 text-indigo-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Location</label>
                                                    <input
                                                        type="text"
                                                        className="bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-200 placeholder-gray-600 w-full truncate"
                                                        value={location}
                                                        onChange={(e) => setLocation(e.target.value)}
                                                        placeholder="Add location..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer bar */}
                                <div className="p-6 bg-slate-800/20 border-t border-white/5 flex justify-between items-center sm:px-10">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-1.5 w-1.5 rounded-full ${isSaving ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`} />
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                                            {isSaving ? 'Saving Changes...' : 'All changes saved'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => router.push('/dashboard')}
                                        className={primaryButtonClass}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>

                            <div className="mt-8 text-center">
                                <button
                                    onClick={() => {
                                        setHasSearched(false);
                                        setTitle("");
                                        setSavedItemId(null);
                                        setTags([]);
                                        setImageUrl("");
                                        setDescription("");
                                        setItemLink("");
                                        setLocation("");
                                    }}
                                    className="text-gray-500 hover:text-indigo-400 text-sm font-bold transition-all uppercase tracking-widest p-2"
                                >
                                    + Add another item
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Candidate Selection Modal */}
                <AnimatePresence>
                    {showCandidateModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                                className="bg-slate-900 rounded-2xl shadow-2xl border border-white/10 max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden"
                            >
                                <div className="p-6 border-b border-white/10 bg-slate-800/30">
                                    <h3 className="text-xl font-bold text-white mb-1">Did you mean...</h3>
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Select the closest match</p>
                                </div>
                                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                                    {candidates.map((candidate) => (
                                        <button
                                            key={candidate.id}
                                            onClick={() => enrichItem(title, candidate.id, candidate.imageUrl, candidate.internalType || candidate.type)}
                                            className="w-full text-left p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-indigo-500/50 transition-all flex gap-4 items-start group"
                                        >
                                            <div className="w-20 h-20 bg-slate-800 rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-lg group-hover:border-indigo-500/30 transition-colors">
                                                <SafeImage src={candidate.imageUrl} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                                                    {candidate.name}
                                                </div>
                                                <div className="text-[8px] uppercase font-bold text-indigo-500 mt-0.5 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded inline-block">
                                                    {candidate.type}
                                                </div>
                                                <div className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                                                    {candidate.detailedDescription || candidate.description}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="p-4 border-t border-white/10 bg-slate-800/30 flex justify-between items-center sm:px-6">
                                    <button onClick={() => setShowCandidateModal(false)} className="text-sm font-bold text-gray-500 hover:text-white transition-colors">CANCEL</button>
                                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Powered by Gemini & Search</p>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

