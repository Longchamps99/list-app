"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { ShareButton } from "../components/ShareButton";

interface Tag {
    id: string;
    name: string;
    color: string;
}

interface Item {
    id: string;
    title?: string;
    content: string;
    imageUrl?: string;
    tags: { tag: Tag }[];
    shares: {
        sharedBy: {
            name: string | null;
            image: string | null;
            email: string | null;
        }
    }[];
    createdAt: string;
}

function SmartListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tagsParam = searchParams.get("tags");

    const [items, setItems] = useState<Item[]>([]);
    const [matchingTags, setMatchingTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTagInput, setNewTagInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    useEffect(() => {
        fetchPreview();
        fetchAllTags();
    }, [tagsParam]);

    const fetchAllTags = async () => {
        try {
            const res = await fetch("/api/tags");
            if (res.ok) {
                const data = await res.json();
                setAllTags(data);
            }
        } catch (e) {
            console.error("Failed to fetch tags", e);
        }
    };

    const fetchPreview = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/lists/smart/preview?tags=${encodeURIComponent(tagsParam || "")}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.items);
                setMatchingTags(data.matchingTags);
            }
        } catch (e) {
            console.error("Failed to fetch smart list preview", e);
        } finally {
            setLoading(false);
        }
    };

    const addTagFilter = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagInput.trim()) return;

        const currentTags = tagsParam ? tagsParam.split(",") : [];
        const newTag = newTagInput.trim().toLowerCase();

        if (!currentTags.includes(newTag)) {
            const newTags = [...currentTags, newTag];
            router.push(`/smart-lists?tags=${newTags.join(",")}`);
        }
        setNewTagInput("");
    };

    const removeTagFilter = (tagToRemove: string) => {
        const currentTags = tagsParam ? tagsParam.split(",") : [];
        const newTags = currentTags.filter(t => t !== tagToRemove);

        if (newTags.length === 0) {
            router.push("/dashboard");
        } else {
            router.push(`/smart-lists?tags=${newTags.join(",")}`);
        }
    };

    const saveList = async () => {
        if (matchingTags.length === 0) return;
        setSaving(true);
        try {
            const res = await fetch("/api/lists/smart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tagNames: matchingTags.map(t => t.name) })
            });

            if (res.ok) {
                const { listId } = await res.json();
                // Redirect to the now persistent list
                router.push(`/lists/${listId}`);
                // Force a refresh of the sidebar (optional, might need context or reload)
                // A simple way is to route and let the new page load
                router.refresh();
            } else {
                alert("Failed to save list");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving list");
        } finally {
            setSaving(false);
        }
    };

    const openSmartList = (tagName: string) => {
        const currentTags = tagsParam ? tagsParam.split(",") : [];
        if (!currentTags.includes(tagName.toLowerCase())) {
            const newTags = [...currentTags, tagName.toLowerCase()];
            router.push(`/smart-lists?tags=${newTags.join(",")}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                            &larr; Back
                        </Link>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-indigo-600">#</span> Smart List Preview
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Toggle */}
                        <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1 bg-white">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-2 rounded transition-colors ${viewMode === "grid" ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:bg-gray-100"}`}
                                title="Grid view"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:bg-gray-100"}`}
                                title="List view"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        </div>

                        {matchingTags.length > 0 && (
                            <button
                                onClick={saveList}
                                disabled={saving}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save List"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tag Filters Bar */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-t bg-gray-50 flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-gray-500 mr-2">Filters:</span>
                    {matchingTags.map(tag => (
                        <span key={tag.id} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                            #{tag.name}
                            <button
                                onClick={() => removeTagFilter(tag.name)}
                                className="hover:text-green-900 font-bold ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-green-200"
                            >
                                ×
                            </button>
                        </span>
                    ))}

                    <form onSubmit={addTagFilter} className="relative">
                        <div className="flex items-center">
                            <input
                                type="text"
                                placeholder="Add tag filter..."
                                className="text-sm rounded-l-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-1.5 border w-32 md:w-48"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onFocus={() => setShowDropdown(true)}
                                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                            />
                            <button
                                type="submit"
                                className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-r-md hover:bg-gray-300 text-sm border border-l-0 border-gray-300"
                            >
                                +
                            </button>
                        </div>

                        {/* Autocomplete Dropdown */}
                        {showDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-48 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg z-20">
                                {allTags
                                    .filter(tag => {
                                        // Filter out already selected tags
                                        const currentTags = tagsParam ? tagsParam.split(",") : [];
                                        if (currentTags.includes(tag.name)) return false;
                                        // Filter by input text
                                        if (newTagInput.trim()) {
                                            return tag.name.toLowerCase().includes(newTagInput.toLowerCase());
                                        }
                                        return true;
                                    })
                                    .map(tag => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setNewTagInput(tag.name);
                                                // Auto-submit
                                                const currentTags = tagsParam ? tagsParam.split(",") : [];
                                                if (!currentTags.includes(tag.name)) {
                                                    const newTags = [...currentTags, tag.name];
                                                    router.push(`/smart-lists?tags=${newTags.join(",")}`);
                                                }
                                                setNewTagInput("");
                                                setShowDropdown(false);
                                            }}
                                        >
                                            #{tag.name}
                                        </button>
                                    ))
                                }
                                {allTags.filter(tag => {
                                    const currentTags = tagsParam ? tagsParam.split(",") : [];
                                    if (currentTags.includes(tag.name)) return false;
                                    if (newTagInput.trim()) {
                                        return tag.name.toLowerCase().includes(newTagInput.toLowerCase());
                                    }
                                    return true;
                                }).length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-400">
                                            {newTagInput.trim() ? "No matching tags" : "No tags available"}
                                        </div>
                                    )}
                            </div>
                        )}
                    </form>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading preview...</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow p-8">
                        <p className="text-lg mb-2">No items found matching all these tags.</p>
                        <p className="text-sm">Try removing some filters or adding new items.</p>
                    </div>
                ) : viewMode === "grid" ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {items.map((item, index) => (
                            <div key={item.id} className="bg-white rounded-xl shadow-md p-4 flex items-center gap-6 group hover:shadow-lg transition-shadow border border-gray-100 relative h-full">
                                {/* Image */}
                                <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                    {item.imageUrl ? (
                                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm relative">
                                            <img
                                                src={item.imageUrl}
                                                alt={item.title || "Item"}
                                                className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-2 border-gray-100 shadow-sm">
                                            No Img
                                        </div>
                                    )}
                                </Link>

                                {/* Content */}
                                <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#6366f1] text-white flex items-center justify-center font-bold text-sm shadow-sm leading-none">
                                            #{index + 1}
                                        </div>
                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                            <h3 className="font-bold text-xl text-gray-900 hover:text-indigo-600 transition truncate">
                                                {item.title || "Untitled"}
                                            </h3>
                                        </Link>
                                    </div>

                                    <p className="text-gray-600 text-sm line-clamp-1">{item.content}</p>

                                    {item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {item.tags.slice(0, 4).map(({ tag }) => (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => openSmartList(tag.name)}
                                                    className="inline-block px-3 py-1 bg-[#dcfce7] text-[#166534] rounded-full text-xs font-medium hover:bg-green-200 transition-colors cursor-pointer"
                                                >
                                                    #{tag.name}
                                                </button>
                                            ))}
                                            {item.tags.length > 4 && (
                                                <span className="text-xs text-gray-400 self-center">+{item.tags.length - 4}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Footer Actions */}
                                    <div className="flex items-center gap-4 mt-2">
                                        <ShareButton
                                            type="ITEM"
                                            id={item.id}
                                            title={item.title || "Item"}
                                            className="bg-[#2563eb] text-white hover:bg-blue-700 px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors border-0 shadow-sm"
                                        />

                                        <button
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                if (confirm("Delete this item?")) {
                                                    try {
                                                        const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
                                                        if (res.ok) fetchPreview();
                                                    } catch (err) {
                                                        console.error(err);
                                                    }
                                                }
                                            }}
                                            className="p-1.5 rounded border border-[#ef4444] text-[#ef4444] hover:bg-red-50 transition-colors"
                                            title="Delete item"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>

                                        <span className="text-xs text-gray-400 ml-2">{new Date(item.createdAt).toLocaleDateString()}</span>

                                        {item.shares?.length > 0 && (
                                            <div className="ml-auto text-[#4f46e5] font-medium text-sm flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                                </svg>
                                                Shared
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <div className="space-y-2">
                        {items.map((item, index) => (
                            <div key={item.id} className="bg-white rounded-xl shadow-md p-4 flex items-center gap-6 group hover:shadow-lg transition-shadow border border-gray-100 relative">
                                {/* Image */}
                                <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                    {item.imageUrl ? (
                                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm relative">
                                            <img
                                                src={item.imageUrl}
                                                alt={item.title || "Item"}
                                                className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-2 border-gray-100 shadow-sm">
                                            No Img
                                        </div>
                                    )}
                                </Link>

                                {/* Content */}
                                <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#6366f1] text-white flex items-center justify-center font-bold text-sm shadow-sm leading-none">
                                            #{index + 1}
                                        </div>
                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                            <h3 className="font-bold text-xl text-gray-900 hover:text-indigo-600 transition truncate">
                                                {item.title || "Untitled"}
                                            </h3>
                                        </Link>
                                    </div>

                                    <p className="text-gray-600 text-sm line-clamp-1">{item.content}</p>

                                    {item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {item.tags.slice(0, 4).map(({ tag }) => (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => openSmartList(tag.name)}
                                                    className="inline-block px-3 py-1 bg-[#dcfce7] text-[#166534] rounded-full text-xs font-medium hover:bg-green-200 transition-colors cursor-pointer"
                                                >
                                                    #{tag.name}
                                                </button>
                                            ))}
                                            {item.tags.length > 4 && (
                                                <span className="text-xs text-gray-400 self-center">+{item.tags.length - 4}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Footer Actions */}
                                    <div className="flex items-center gap-4 mt-2">
                                        <ShareButton
                                            type="ITEM"
                                            id={item.id}
                                            title={item.title || "Item"}
                                            className="bg-[#2563eb] text-white hover:bg-blue-700 px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors border-0 shadow-sm"
                                        />

                                        <button
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                if (confirm("Delete this item?")) {
                                                    try {
                                                        const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
                                                        if (res.ok) fetchPreview();
                                                    } catch (err) {
                                                        console.error(err);
                                                    }
                                                }
                                            }}
                                            className="p-1.5 rounded border border-[#ef4444] text-[#ef4444] hover:bg-red-50 transition-colors"
                                            title="Delete item"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>

                                        <span className="text-xs text-gray-400 ml-2">{new Date(item.createdAt).toLocaleDateString()}</span>

                                        {item.shares?.length > 0 && (
                                            <div className="ml-auto text-[#4f46e5] font-medium text-sm flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                                </svg>
                                                Shared
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function SmartListPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading...</div>}>
            <SmartListContent />
        </Suspense>
    );
}
