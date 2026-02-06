"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "../../components/Header";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, X, Edit2, ExternalLink, MapPin, Loader2, Image as ImageIcon, Link as LinkIcon, Upload } from "lucide-react";
import { SafeImage } from "../../../components/SafeImage";
import {
    tagPillClass,
    primaryButtonClass,
    primaryButtonStyle,
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

function NewItemContent() {
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

    // Context Params
    const searchParams = useSearchParams();
    const source = searchParams.get("source");
    const sourceTagsParam = searchParams.get("tags");

    // Initialize tags from URL if coming from Smart List
    useEffect(() => {
        if (source === "smart-list" && sourceTagsParam) {
            const initialTags = sourceTagsParam.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
            if (initialTags.length > 0) {
                setTags(prev => Array.from(new Set([...prev, ...initialTags])));
            }
        }
    }, [source, sourceTagsParam]);

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
        <div className="min-h-screen bg-white flex flex-col">
            <Header
                variant="page"
                title="Add New Item"
                showBack={true}
                backHref="/dashboard"
            >
                {isSaving && (
                    <div className="ml-auto flex items-center gap-2 text-[var(--swiss-text-muted)] text-xs font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                    </div>
                )}
            </Header>

            <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8">
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
                            <div className="mb-12 bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] p-8 rounded-lg">
                                <h2 className="text-2xl font-bold text-[var(--swiss-black)] mb-4">Hello! What are we adding today?</h2>
                                <p className="text-lg text-[var(--swiss-text-secondary)]">
                                    Favorite movie? Book? Hotel? Nail polish color? Football player? Drop it in the box below and let AI help you fill in the details.
                                </p>
                                <div className="mt-8 flex items-center gap-4 text-sm font-medium text-[var(--swiss-text-secondary)]">
                                    <div className="h-10 w-10 rounded-full bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] flex items-center justify-center">
                                        <Search className="h-5 w-5 text-[var(--swiss-black)]" />
                                    </div>
                                    <span>Try &quot;The Dark Knight&quot; or &quot;Ritz Paris&quot;</span>
                                </div>
                                <div className="mt-6 pt-6 border-t border-[var(--swiss-border)] flex justify-between items-center text-sm">
                                    <span className="text-[var(--swiss-text-muted)]">Have many items?</span>
                                    <Link href="/items/paste" className="text-[var(--swiss-black)] hover:text-[var(--swiss-text-secondary)] font-bold underline underline-offset-4 transition-all flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        Try Smart Paste
                                    </Link>
                                </div>
                            </div>

                            {/* Search Box - Swiss Design */}
                            <div className="relative group">
                                <div className="relative flex items-center bg-white border-2 border-[var(--swiss-border)] rounded-full overflow-hidden p-2 transition-all hover:border-[var(--swiss-black)] focus-within:border-[var(--swiss-black)]">
                                    <div className="pl-6 pr-4">
                                        {isSearching || isEnriching ? (
                                            <Loader2 className="h-6 w-6 text-[var(--swiss-black)] animate-spin" />
                                        ) : (
                                            <Search className="h-6 w-6 text-[var(--swiss-text-muted)]" />
                                        )}
                                    </div>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="flex-1 bg-transparent border-none focus:ring-0 text-xl py-6 text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)]"
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
                                        className={`${primaryButtonClass} mr-2 py-4 px-8 rounded-full`}
                                        style={primaryButtonStyle}
                                    >
                                        Search
                                    </button>
                                </div>
                                <p className="text-center mt-6 text-[var(--swiss-text-muted)] font-medium text-xs tracking-widest uppercase">
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
                                        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden border border-[var(--swiss-border)] bg-[var(--swiss-off-white)]">
                                            <SafeImage
                                                src={imageUrl}
                                                alt={title}
                                                className="w-full h-full object-cover"
                                                fallback={<ImageIcon className="h-10 w-10 text-[var(--swiss-text-muted)]" />}
                                            />
                                        </div>
                                        <button
                                            onClick={() => setIsEditingThumbnail(!isEditingThumbnail)}
                                            className="absolute bottom-1 right-1 p-2.5 bg-[var(--swiss-black)] hover:bg-[var(--swiss-accent-hover)] text-white rounded-full transition-transform hover:scale-110 active:scale-90 z-20"
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
                                                    className="absolute top-full mt-4 left-0 w-72 bg-white border border-[var(--swiss-border)] rounded-lg shadow-lg z-50 p-4"
                                                >
                                                    <div className="flex justify-between items-center mb-4">
                                                        <span className="text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest">Update Thumbnail</span>
                                                        <button onClick={() => setIsEditingThumbnail(false)} className="text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] transition-colors"><X className="h-4 w-4" /></button>
                                                    </div>
                                                    <div className="flex gap-2 mb-4 p-1 bg-[var(--swiss-off-white)] rounded-lg">
                                                        <button
                                                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${thumbnailMode === 'url' ? 'bg-[var(--swiss-black)] text-white' : 'text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)]'}`}
                                                            onClick={() => setThumbnailMode('url')}
                                                        >URL</button>
                                                        <button
                                                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${thumbnailMode === 'upload' ? 'bg-[var(--swiss-black)] text-white' : 'text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)]'}`}
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
                                                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--swiss-border)] rounded-lg p-6 hover:bg-[var(--swiss-off-white)] cursor-pointer transition-colors group/upload">
                                                            <Upload className="h-6 w-6 text-[var(--swiss-text-muted)] mb-2 group-hover/upload:scale-110 transition-transform" />
                                                            <span className="text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase">Choose Image</span>
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
                                                className="w-full bg-transparent border-b border-[var(--swiss-border)] focus:border-[var(--swiss-black)] focus:outline-none p-2 text-3xl sm:text-4xl font-bold text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)] transition-all"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="Title"
                                            />
                                            {/* Neutral Style Tags - matching dashboard */}
                                            <div className="flex flex-wrap gap-2">
                                                {tags.map((tag, idx) => (
                                                    <span
                                                        key={`${tag}-${idx}`}
                                                        className="inline-flex items-center px-2.5 py-0.5 bg-[var(--swiss-off-white)] text-[var(--swiss-text-secondary)] border border-[var(--swiss-border)] rounded-full text-xs font-medium hover:bg-[var(--swiss-cream)] hover:border-[var(--swiss-text-muted)] transition-all"
                                                    >
                                                        #{tag}
                                                        <button onClick={() => removeTag(tag)} className="ml-1.5 hover:text-[var(--swiss-red)] transition-colors">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                {/* Persistent tag input at the end of the list */}
                                                <div className="relative flex items-center">
                                                    <Plus className="absolute left-3 h-3 w-3 text-[var(--swiss-text-muted)] pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        className="bg-[var(--swiss-off-white)] border border-dashed border-[var(--swiss-border)] rounded-full pl-8 pr-4 py-1 text-xs text-[var(--swiss-black)] w-32 focus:outline-none focus:ring-1 focus:ring-[var(--swiss-black)] focus:border-[var(--swiss-text-secondary)] placeholder:text-[var(--swiss-text-muted)] transition-all"
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
                                        <div className="bg-[var(--swiss-off-white)] rounded-lg p-4 border border-[var(--swiss-border)]">
                                            <label className="block text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest mb-2">Description</label>
                                            <textarea
                                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-[var(--swiss-text)] leading-relaxed resize-none overflow-hidden min-h-[100px]"
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
                                            <div className="flex items-center gap-3 bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] px-4 py-3 rounded-lg group hover:border-[var(--swiss-text-muted)] focus-within:border-[var(--swiss-black)] transition-all">
                                                <LinkIcon className="h-4 w-4 text-[var(--swiss-text-secondary)] shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-[var(--swiss-text-muted)] mb-0.5">Website</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            className="bg-transparent border-none focus:ring-0 p-0 text-sm text-[var(--swiss-text)] placeholder-[var(--swiss-text-muted)] w-full truncate"
                                                            value={itemLink}
                                                            onChange={(e) => setItemLink(e.target.value)}
                                                            placeholder="https://..."
                                                        />
                                                        {itemLink && (
                                                            <a href={itemLink} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 hover:text-[var(--swiss-black)] text-[var(--swiss-text-muted)] transition-colors">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] px-4 py-3 rounded-lg group hover:border-[var(--swiss-text-muted)] focus-within:border-[var(--swiss-black)] transition-all">
                                                <MapPin className="h-4 w-4 text-[var(--swiss-text-secondary)] shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-[var(--swiss-text-muted)] mb-0.5">Location</label>
                                                    <input
                                                        type="text"
                                                        className="bg-transparent border-none focus:ring-0 p-0 text-sm text-[var(--swiss-text)] placeholder-[var(--swiss-text-muted)] w-full truncate"
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
                                <div className="p-6 bg-[var(--swiss-off-white)] border-t border-[var(--swiss-border)] flex flex-col sm:flex-row gap-4 justify-between items-center sm:px-10">
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className={`h-1.5 w-1.5 rounded-full ${isSaving ? 'bg-[var(--swiss-text-muted)] animate-pulse' : 'bg-[var(--swiss-green)]'}`} />
                                        <span className="text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest leading-none">
                                            {isSaving ? 'Saving Changes...' : 'All changes saved'}
                                        </span>
                                    </div>

                                    {source === "smart-list" ? (
                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                            <button
                                                onClick={() => {
                                                    setHasSearched(false);
                                                    setTitle("");
                                                    setSavedItemId(null);
                                                    // Reset but keep source tags
                                                    const initialTags = sourceTagsParam ? sourceTagsParam.split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [];
                                                    setTags(initialTags);
                                                    setImageUrl("");
                                                    setDescription("");
                                                    setItemLink("");
                                                    setLocation("");
                                                }}
                                                className={secondaryButtonClass}
                                            >
                                                + Add Another Item
                                            </button>
                                            <button
                                                onClick={() => router.push(`/smart-lists?tags=${encodeURIComponent(sourceTagsParam || "")}`)}
                                                className={primaryButtonClass}
                                            >
                                                Return to List
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                router.refresh();
                                                router.push('/dashboard');
                                            }}
                                            className={primaryButtonClass}
                                        >
                                            Done
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Only show the disconnected 'Add another' link if NOT in smart list mode (since we have a button above) */}
                            {source !== "smart-list" && (
                                <div className="mt-8 flex items-center justify-center gap-6">
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
                                        className="text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] text-sm font-bold transition-all uppercase tracking-widest p-2 flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Another Item
                                    </button>

                                    <div className="h-4 w-px bg-[var(--swiss-border)]"></div>

                                    <Link
                                        href="/dashboard"
                                        className="text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] text-sm font-bold transition-all uppercase tracking-widest p-2"
                                    >
                                        Return to Dashboard
                                    </Link>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Candidate Selection Modal */}
                <AnimatePresence>
                    {showCandidateModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                                className="bg-white rounded-lg shadow-xl border border-[var(--swiss-border)] max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden"
                            >
                                <div className="p-6 border-b border-[var(--swiss-border)] bg-[var(--swiss-off-white)]">
                                    <h3 className="text-xl font-bold text-[var(--swiss-black)] mb-1">Did you mean...</h3>
                                    <p className="text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest">Select the closest match</p>
                                </div>
                                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                                    {candidates.map((candidate) => (
                                        <button
                                            key={candidate.id}
                                            onClick={() => enrichItem(title, candidate.id, candidate.imageUrl, candidate.internalType || candidate.type)}
                                            className="w-full text-left p-4 rounded-lg border border-[var(--swiss-border)] bg-white hover:bg-[var(--swiss-off-white)] hover:border-[var(--swiss-black)] transition-all flex gap-4 items-start group"
                                        >
                                            <div className="w-20 h-20 bg-[var(--swiss-off-white)] rounded-lg overflow-hidden shrink-0 border border-[var(--swiss-border)] group-hover:border-[var(--swiss-text-muted)] transition-colors">
                                                <SafeImage src={candidate.imageUrl} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-lg text-[var(--swiss-black)] group-hover:text-[var(--swiss-text-secondary)] transition-colors line-clamp-1">
                                                    {candidate.name}
                                                </div>
                                                <div className="text-[8px] uppercase font-bold text-[var(--swiss-text-muted)] mt-0.5 tracking-widest bg-[var(--swiss-off-white)] px-2 py-0.5 rounded inline-block">
                                                    {candidate.type}
                                                </div>
                                                <div className="text-sm text-[var(--swiss-text-secondary)] mt-2 line-clamp-2 leading-relaxed">
                                                    {candidate.detailedDescription || candidate.description}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="p-4 border-t border-[var(--swiss-border)] bg-[var(--swiss-off-white)] flex justify-between items-center sm:px-6">
                                    <button onClick={() => setShowCandidateModal(false)} className="text-sm font-bold text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] transition-colors">CANCEL</button>
                                    <p className="text-[9px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest">Powered by Gemini & Search</p>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

export default function NewItemPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--swiss-black)]" />
            </div>
        }>
            <NewItemContent />
        </Suspense>
    );
}

