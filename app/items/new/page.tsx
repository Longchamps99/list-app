"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewItemPage() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [itemLink, setItemLink] = useState("");
    const [location, setLocation] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [isEnriching, setIsEnriching] = useState(false);

    // Tag Editing State
    const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
    const [editTagValue, setEditTagValue] = useState("");
    const [newTagValue, setNewTagValue] = useState("");
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [showCandidateModal, setShowCandidateModal] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const searchForCandidates = async () => {
        if (!title.trim()) return;

        // Detect if input is a URL - skip disambiguation, enrich directly
        const isUrl = /^https?:\/\//i.test(title.trim());
        if (isUrl) {
            setIsEnriching(true);
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
                    // Fallback to direct enrich if no candidates found
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
                    if (data.description) setDescription(data.description);
                    if (data.imageUrl) setImageUrl(data.imageUrl);
                    if (data.link) setItemLink(data.link);
                    if (data.location) setLocation(data.location);
                    if (data.tags && Array.isArray(data.tags)) {
                        setTags(data.tags);
                    }
                } else {
                    alert("No info found.");
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsEnriching(false);
            setShowCandidateModal(false);
        }
    };

    const removeTag = (indexToRemove: number) => {
        setTags(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    const startEditingTag = (index: number) => {
        setEditingTagIndex(index);
        setEditTagValue(tags[index]);
    };

    const saveEditedTag = () => {
        if (editingTagIndex !== null && editTagValue.trim()) {
            const updated = [...tags];
            updated[editingTagIndex] = editTagValue.trim().toLowerCase();
            setTags(updated);
        }
        setEditingTagIndex(null);
        setEditTagValue("");
    };

    const addNewTag = () => {
        if (newTagValue.trim()) {
            setTags(prev => [...prev, newTagValue.trim().toLowerCase()]);
            setNewTagValue("");
            setIsAddingTag(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            const res = await fetch(`/api/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    content: description,
                    imageUrl,
                    link: itemLink,
                    location,
                    customTags: tags
                })
            });

            if (res.ok) {
                router.push("/dashboard");
            } else {
                alert("Failed to create item");
            }
        } catch (e) {
            console.error(e);
            alert("Error");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-8">
                <header className="mb-6 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Add New Item</h1>
                    <div className="flex gap-3 items-center">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors font-semibold text-sm shadow-sm"
                        >
                            <span>Create Item</span>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">Cancel</Link>
                    </div>
                </header>

                <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-6">
                    {/* Title & Auto-Fill */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Headline / Title *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                required
                                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        searchForCandidates();
                                    }
                                }}
                                placeholder="E.g. The Expanse TV"
                            />
                            <button
                                type="button"
                                onClick={searchForCandidates}
                                disabled={isSearching || isEnriching || !title.trim()}
                                className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-md hover:bg-indigo-200 transition text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSearching ? (
                                    <span>Searching...</span>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        Search
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Search to auto-fill details using AI and Google Knowledge Graph.
                        </p>
                    </div>

                    {/* Tags (Auto-Generated + Custom) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tags
                        </label>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex flex-wrap gap-2 items-center">
                                {tags.map((tag, idx) => (
                                    <div key={idx} className="relative group">
                                        {editingTagIndex === idx ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                className="bg-white text-blue-800 px-3 py-1 rounded-full text-sm font-medium border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                                                value={editTagValue}
                                                onChange={(e) => setEditTagValue(e.target.value)}
                                                onBlur={saveEditedTag}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        saveEditedTag();
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <span
                                                className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 cursor-pointer hover:bg-green-200 transition select-none"
                                                onClick={() => startEditingTag(idx)}
                                                title="Click to edit"
                                            >
                                                #{tag}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeTag(idx);
                                                    }}
                                                    className="hover:text-red-600 font-bold ml-1 p-0.5 rounded-full hover:bg-green-300/50 transition"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                ))}

                                {/* Add New Tag Button/Input */}
                                {isAddingTag ? (
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="New tag..."
                                        className="bg-white text-gray-700 px-3 py-1 rounded-full text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-24"
                                        value={newTagValue}
                                        onChange={(e) => setNewTagValue(e.target.value)}
                                        onBlur={() => {
                                            if (newTagValue.trim()) addNewTag();
                                            else setIsAddingTag(false);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addNewTag();
                                            } else if (e.key === 'Escape') {
                                                setIsAddingTag(false);
                                            }
                                        }}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingTag(true)}
                                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium px-2 py-1 rounded hover:bg-indigo-50 transition flex items-center gap-1"
                                    >
                                        + Add Tag
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Click a tag to edit. Click &times; to remove.
                            </p>
                        </div>
                    </div>

                    {/* Image URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                        <input
                            type="url"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                        />
                        {/* Image Preview */}
                        {imageUrl && (
                            <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-1">Preview:</p>
                                <div className="w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                    <img
                                        src={imageUrl}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
                        <textarea
                            rows={4}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Details about this item..."
                        />
                    </div>

                    {/* Link */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Web Link</label>
                        <input
                            type="url"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            value={itemLink}
                            onChange={(e) => setItemLink(e.target.value)}
                            placeholder="https://example.com"
                        />
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location / Map Address</label>
                        <input
                            type="text"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="E.g. Eiffel Tower, Paris"
                        />
                    </div>


                </form>

                {/* Candidate Selection Modal */}
                {showCandidateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                                <h3 className="text-lg font-bold text-gray-900">Did you mean...</h3>
                                <button
                                    onClick={() => setShowCandidateModal(false)}
                                    className="text-gray-400 hover:text-gray-600 font-bold text-xl"
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="overflow-y-auto p-4 space-y-4 flex-1">
                                {candidates.map((candidate) => {
                                    return (
                                        <button
                                            key={candidate.id}
                                            onClick={() => {
                                                enrichItem(title, candidate.id, candidate.imageUrl, candidate.internalType || candidate.type);
                                            }}
                                            className="w-full text-left p-4 rounded-xl border-2 hover:bg-indigo-50 hover:border-indigo-400 transition flex gap-4 items-start group shadow-sm hover:shadow-md"
                                        >
                                            {/* Large Image or Placeholder */}
                                            <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                                                {candidate.imageUrl ? (
                                                    <img
                                                        src={candidate.imageUrl}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        referrerPolicy="no-referrer"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-lg text-gray-900 group-hover:text-indigo-700 line-clamp-1">
                                                    {candidate.name}
                                                </div>
                                                <div className="text-xs uppercase font-bold text-indigo-500 mt-0.5 tracking-wide">
                                                    {candidate.type}
                                                </div>
                                                <div className="text-sm text-gray-600 mt-2 line-clamp-3">
                                                    {candidate.detailedDescription || candidate.description}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                                <button
                                    onClick={() => setShowCandidateModal(false)}
                                    className="text-sm text-gray-500 hover:text-gray-700 mr-4"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
