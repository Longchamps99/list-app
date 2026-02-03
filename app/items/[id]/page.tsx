"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Header } from "../../components/Header";
import { ShareButton } from "../../components/ShareButton";
import { SafeImage } from "../../../components/SafeImage";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, X, Image as ImageIcon, ExternalLink, MapPin, Loader2, Plus, Upload, Link as LinkIcon } from "lucide-react";
import {
    tagPillClass,
    primaryButtonClass,
    secondaryButtonClass,
    inputClass
} from "../../components/styles";

interface Tag {
    id: string;
    name: string;
    color: string;
}

interface ListSummary {
    id: string;
    title: string;
    ownerId: string;
    owner: { email: string; id: string };
}

interface Item {
    id: string;
    title?: string;
    content: string;
    imageUrl?: string;
    link?: string;
    location?: string;
    isChecked: boolean;
    status?: 'EXPERIENCED' | 'WANT_TO_EXPERIENCE' | null;
    tags: { tag: Tag }[];
}

export default function ItemDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const { data: session } = useSession();
    const currentUserId = (session?.user as any)?.id;

    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Edit form state
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editImageUrl, setEditImageUrl] = useState("");
    const [editLink, setEditLink] = useState("");
    const [editLocation, setEditLocation] = useState("");
    const [newTagName, setNewTagName] = useState("");

    // Status and Add to List state
    const [status, setStatus] = useState<'EXPERIENCED' | 'WANT_TO_EXPERIENCE' | null>(null);
    const [showAddToListModal, setShowAddToListModal] = useState(false);
    const [lists, setLists] = useState<ListSummary[]>([]);
    const [addingToList, setAddingToList] = useState(false);

    // Thumbnail editing state
    const [isEditingThumbnail, setIsEditingThumbnail] = useState(false);
    const [thumbnailMode, setThumbnailMode] = useState<"url" | "upload">("url");

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (id) fetchItem();
    }, [id]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [editDescription]);

    const fetchItem = async () => {
        try {
            const res = await fetch(`/api/items/${id}`);
            if (!res.ok) {
                if (res.status === 404) router.push("/dashboard");
                return;
            }
            const data = await res.json();
            setItem(data);

            // Initialize edit form
            setEditTitle(data.title || "");
            setEditDescription(data.content || "");
            setEditImageUrl(data.imageUrl || "");
            setEditLink(data.link || "");
            setEditLocation(data.location || "");
            setStatus(data.status || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLists = async () => {
        try {
            const res = await fetch('/api/lists');
            if (res.ok) {
                const data = await res.json();
                setLists(data);
            }
        } catch (e) {
            console.error('Failed to fetch lists', e);
        }
    };

    const handleStatusChange = async (newStatus: 'EXPERIENCED' | 'WANT_TO_EXPERIENCE') => {
        const updatedStatus = status === newStatus ? null : newStatus;
        setStatus(updatedStatus);

        try {
            await fetch(`/api/items/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: updatedStatus })
            });
        } catch (e) {
            console.error('Failed to update status', e);
        }
    };

    const handleAddToList = async (listId: string) => {
        setAddingToList(true);
        try {
            const res = await fetch(`/api/lists/${listId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: id })
            });

            if (res.ok) {
                setShowAddToListModal(false);
                fetchItem();
            }
        } catch (e) {
            console.error('Failed to add to list', e);
        } finally {
            setAddingToList(false);
        }
    };

    const handleSave = async () => {
        if (!item) return;

        try {
            const res = await fetch(`/api/items/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editTitle,
                    content: editDescription,
                    imageUrl: editImageUrl,
                    link: editLink,
                    location: editLocation,
                }),
            });

            if (res.ok) {
                const updated = await res.json();
                setItem(updated);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Auto-save on blur
    const handleBlur = async () => {
        setSaving(true);
        await handleSave();
        setTimeout(() => setSaving(false), 1000);
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this item?")) return;
        try {
            const res = await fetch(`/api/items/${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                router.push("/dashboard");
            } else {
                alert("Failed to delete item");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting");
        }
    };

    const addTag = async () => {
        if (!newTagName.trim() || !item) return;

        try {
            const res = await fetch(`/api/items/${id}/tags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tagName: newTagName.trim() })
            });

            if (res.ok) {
                setNewTagName("");
                fetchItem();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const removeTag = async (tagId: string) => {
        try {
            const res = await fetch(`/api/items/${id}/tags/${tagId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                fetchItem();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const openSmartList = (tagName: string) => {
        router.push(`/smart-lists?tags=${encodeURIComponent(tagName)}`);
    };

    // Thumbnail upload handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditImageUrl(reader.result as string);
                setIsEditingThumbnail(false);
                handleBlur();
            };
            reader.readAsDataURL(file);
        }
    };

    if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--swiss-text-muted)]" /></div>;
    if (!item) return <div className="min-h-screen bg-white flex items-center justify-center text-[var(--swiss-text-muted)]">Item not found</div>;

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Header
                variant="page"
                title="Item Details"
                showBack={true}
                backHref="/dashboard"
            >
                <div className="ml-auto flex items-center gap-2">
                    {saving && (
                        <div className="flex items-center gap-2 text-[var(--swiss-text-muted)] text-xs font-medium">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Saving...
                        </div>
                    )}
                    <button
                        onClick={() => {
                            fetchLists();
                            setShowAddToListModal(true);
                        }}
                        className="px-3 py-1.5 bg-[var(--swiss-black)] text-white text-sm font-medium rounded-lg hover:bg-[var(--swiss-accent-hover)] transition-colors flex items-center gap-1"
                    >
                        <Plus className="h-4 w-4" />
                        Add to List
                    </button>
                    <ShareButton type="ITEM" id={item.id} title={item.title || "Item"} />
                    <button
                        onClick={handleDelete}
                        className="p-2 text-[var(--swiss-red)] hover:bg-[var(--swiss-red-light)] rounded-lg transition-colors"
                        title="Delete item"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </Header>

            <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-4xl w-full"
                >
                    <div className="bg-white border border-[var(--swiss-border)] rounded-lg shadow-sm flex flex-col overflow-hidden relative p-0">
                        <div className="p-8 sm:p-10 flex flex-col md:flex-row gap-8 items-start relative box-border">
                            {/* Thumbnail Selection Area */}
                            <div className="relative group shrink-0">
                                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden border border-[var(--swiss-border)] bg-[var(--swiss-off-white)]">
                                    <SafeImage
                                        src={editImageUrl}
                                        alt={editTitle}
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
                                                    value={editImageUrl}
                                                    onChange={(e) => setEditImageUrl(e.target.value)}
                                                    onBlur={handleBlur}
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
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onBlur={handleBlur}
                                        placeholder="Title"
                                    />

                                    {/* Status Toggle */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest">Status:</span>
                                        <div className="inline-flex rounded-lg border border-[var(--swiss-border)] p-0.5 bg-[var(--swiss-off-white)]">
                                            <button
                                                onClick={() => handleStatusChange('EXPERIENCED')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${status === 'EXPERIENCED'
                                                    ? 'bg-[#0d5c0a] text-white shadow-sm'
                                                    : 'text-[var(--swiss-text-muted)] hover:bg-white hover:text-[#0d5c0a] active:bg-[#e8f5e8]'
                                                    }`}
                                            >
                                                ✓ Experienced
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('WANT_TO_EXPERIENCE')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${status === 'WANT_TO_EXPERIENCE'
                                                    ? 'bg-[#b45309] text-white shadow-sm'
                                                    : 'text-[var(--swiss-text-muted)] hover:bg-white hover:text-[#b45309] active:bg-[#fef3c7]'
                                                    }`}
                                            >
                                                ★ Want to Go
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-2">
                                        {(item.tags || []).map(({ tag }) => (
                                            <span
                                                key={tag.id}
                                                className="inline-flex items-center px-2.5 py-0.5 bg-[var(--swiss-off-white)] text-[var(--swiss-text-secondary)] border border-[var(--swiss-border)] rounded-full text-xs font-medium hover:bg-[var(--swiss-cream)] hover:border-[var(--swiss-text-muted)] transition-all"
                                            >
                                                <button onClick={() => openSmartList(tag.name)} className="hover:text-[var(--swiss-black)] transition-colors cursor-pointer">
                                                    #{tag.name}
                                                </button>
                                                <button onClick={() => removeTag(tag.id)} className="ml-1.5 hover:text-[var(--swiss-red)] transition-colors cursor-pointer">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                        {/* Tag input */}
                                        <div className="relative flex items-center">
                                            <Plus className="absolute left-3 h-3 w-3 text-[var(--swiss-text-muted)] pointer-events-none" />
                                            <input
                                                type="text"
                                                className="bg-[var(--swiss-off-white)] border border-dashed border-[var(--swiss-border)] rounded-full pl-8 pr-4 py-1.5 text-xs text-[var(--swiss-black)] w-32 focus:outline-none focus:ring-1 focus:ring-[var(--swiss-black)] focus:border-[var(--swiss-text-muted)] placeholder:text-[var(--swiss-text-muted)] transition-all"
                                                placeholder="Add tag..."
                                                value={newTagName}
                                                onChange={(e) => setNewTagName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addTag();
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] px-4 py-3 rounded-lg group hover:border-[var(--swiss-text-muted)] focus-within:border-[var(--swiss-black)] transition-all">
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-[var(--swiss-text-muted)] mb-1">Description</label>
                                    <textarea
                                        ref={textareaRef}
                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-[var(--swiss-text)] placeholder-[var(--swiss-text-muted)] resize-none overflow-hidden min-h-[80px]"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        onBlur={handleBlur}
                                        placeholder="Add a description..."
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
                                                    value={editLink}
                                                    onChange={(e) => setEditLink(e.target.value)}
                                                    onBlur={handleBlur}
                                                    placeholder="https://..."
                                                />
                                                {editLink && (
                                                    <a href={editLink} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 hover:text-[var(--swiss-black)] text-[var(--swiss-text-muted)] transition-colors">
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
                                                value={editLocation}
                                                onChange={(e) => setEditLocation(e.target.value)}
                                                onBlur={handleBlur}
                                                placeholder="Add location..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer bar */}
                        <div className="p-6 bg-[var(--swiss-off-white)] border-t border-[var(--swiss-border)] flex justify-between items-center sm:px-10">
                            <div className="flex items-center gap-3">
                                <div className={`h-1.5 w-1.5 rounded-full ${saving ? 'bg-[var(--swiss-text-muted)] animate-pulse' : 'bg-[var(--swiss-green)]'}`} />
                                <span className="text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest leading-none">
                                    {saving ? 'Saving Changes...' : 'All changes saved'}
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
                </motion.div>
            </main>

            {/* Add to List Modal */}
            <AnimatePresence>
                {showAddToListModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white rounded-lg shadow-xl border border-[var(--swiss-border)] max-w-md w-full mx-4 overflow-hidden"
                        >
                            <div className="p-4 border-b border-[var(--swiss-border)] bg-[var(--swiss-off-white)] flex justify-between items-center">
                                <h2 className="text-lg font-bold text-[var(--swiss-black)]">Add to List</h2>
                                <button
                                    onClick={() => setShowAddToListModal(false)}
                                    className="p-1 hover:bg-white rounded transition-colors text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)]"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-4 max-h-80 overflow-y-auto">
                                {lists.length === 0 ? (
                                    <p className="text-[var(--swiss-text-muted)] text-center py-4">No lists available</p>
                                ) : (
                                    <>
                                        {/* My Lists (Personal) */}
                                        <div className="mb-4">
                                            <h3 className="text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest mb-2">My Lists</h3>
                                            <div className="space-y-1">
                                                {lists.filter(l => l.ownerId === currentUserId).length === 0 ? (
                                                    <p className="text-sm text-[var(--swiss-text-muted)] italic">No personal lists</p>
                                                ) : (
                                                    lists.filter(l => l.ownerId === currentUserId).map(list => (
                                                        <button
                                                            key={list.id}
                                                            onClick={() => handleAddToList(list.id)}
                                                            disabled={addingToList}
                                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--swiss-off-white)] transition-colors disabled:opacity-50 text-[var(--swiss-black)]"
                                                        >
                                                            {list.title}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Collaborative Lists */}
                                        {lists.filter(l => l.ownerId !== currentUserId).length > 0 && (
                                            <div>
                                                <h3 className="text-[10px] font-bold text-[var(--swiss-text-muted)] uppercase tracking-widest mb-2 flex items-center gap-1">
                                                    Collaborative Lists
                                                </h3>
                                                <div className="space-y-1">
                                                    {lists.filter(l => l.ownerId !== currentUserId).map(list => (
                                                        <button
                                                            key={list.id}
                                                            onClick={() => handleAddToList(list.id)}
                                                            disabled={addingToList}
                                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--swiss-off-white)] transition-colors disabled:opacity-50 flex items-center justify-between text-[var(--swiss-black)]"
                                                        >
                                                            <span>{list.title}</span>
                                                            <span className="text-[10px] text-[var(--swiss-text-muted)] bg-[var(--swiss-off-white)] px-1.5 py-0.5 rounded-full border border-[var(--swiss-border)]">Collab</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
