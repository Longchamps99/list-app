"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { ShareButton } from "../components/ShareButton";
import { Header } from "../components/Header";

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
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("rank");

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

    const filteredItems = items
        .filter(item => {
            if (!search.trim()) return true;
            const searchLower = search.toLowerCase();
            return (
                (item.title && item.title.toLowerCase().includes(searchLower)) ||
                item.content.toLowerCase().includes(searchLower)
            );
        })
        .sort((a, b) => {
            if (sort === "date") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else if (sort === "alpha") {
                return (a.title || "").localeCompare(b.title || "");
            }
            return 0; // "rank" keeps original order
        });

    return (
        <>
            <Header
                variant="page"
                title="Smart List Preview"
                showBack={true}
                backHref="/dashboard"
            >
                {/* Page-specific actions in header */}
                <div className="flex items-center gap-3 ml-auto">
                    {matchingTags.length > 0 && (
                        <button
                            onClick={saveList}
                            disabled={saving}
                            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-500 hover:to-purple-500 hover:-translate-y-0.5 transition-all font-semibold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            {saving ? "Saving..." : "Save List"}
                        </button>
                    )}
                </div>
            </Header>
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col relative overflow-hidden">
                {/* Background Effects */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                </div>

                {/* Tag Filters Bar */}
                <div className="bg-slate-900/50 backdrop-blur-xl border-b border-white/10 relative z-30">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-gray-400 mr-2">Filters:</span>
                        {matchingTags.map(tag => (
                            <span key={tag.id} className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-300 border border-green-500/30 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                #{tag.name}
                                <button
                                    onClick={() => removeTagFilter(tag.name)}
                                    className="hover:text-green-200 font-bold ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-green-500/30"
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
                                    className="text-sm rounded-l-md bg-slate-800/50 border-white/10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-1.5 border w-32 md:w-48 text-white placeholder-gray-500"
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                    onFocus={() => setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                                />
                                <button
                                    type="submit"
                                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-r-md hover:bg-indigo-500 text-sm border border-l-0 border-white/10"
                                >
                                    +
                                </button>
                            </div>

                            {/* Autocomplete Dropdown */}
                            {showDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-48 max-h-48 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-md shadow-2xl shadow-black/50 z-50">
                                    {allTags
                                        .filter(tag => {
                                            const currentTags = tagsParam ? tagsParam.split(",") : [];
                                            if (currentTags.includes(tag.name)) return false;
                                            if (newTagInput.trim()) {
                                                return tag.name.toLowerCase().includes(newTagInput.toLowerCase());
                                            }
                                            return true;
                                        })
                                        .map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setNewTagInput(tag.name);
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
                </div>
                {/* Content */}
                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0 relative z-10">
                    {/* Controls Bar */}
                    <div className="mb-6 flex items-center justify-between">
                        {/* Search Bar */}
                        <div className="flex-1 max-w-2xl relative mr-6">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    className="w-full pl-10 pr-20 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm text-white placeholder-gray-500"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-400 bg-slate-700/50 border border-white/10 rounded">
                                        ⌘K
                                    </kbd>
                                </div>
                            </div>
                        </div>

                        {/* View and Sort Controls */}
                        <div className="flex items-center gap-3">
                            {/* Add New Item Button */}
                            <Link
                                href="/items/new"
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 !text-white rounded-lg hover:from-green-500 hover:to-emerald-500 hover:-translate-y-0.5 transition-all font-bold text-sm shadow-lg shadow-green-500/30 hover:shadow-green-500/50"
                            >
                                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-white hidden sm:inline">Add New Item</span>
                            </Link>

                            {/* View and Sort Controls - Grouped */}
                            <div className="flex items-center gap-3 border border-white/10 rounded-lg p-1 bg-slate-800/50 backdrop-blur-sm">
                                {/* View Toggle */}
                                <div className="flex items-center gap-1 border-r border-white/10 pr-3">
                                    <button
                                        onClick={() => setViewMode("grid")}
                                        className={`p-2 rounded transition-colors ${viewMode === "grid" ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                                        title="Grid view"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                                        title="List view"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Sort Dropdown */}
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-400 font-medium">Sort:</span>
                                    <select
                                        className="border-0 focus:ring-0 text-sm font-medium text-white bg-transparent cursor-pointer pr-8"
                                        value={sort}
                                        onChange={(e) => setSort(e.target.value)}
                                    >
                                        <option value="rank">Rank</option>
                                        <option value="date">Newest</option>
                                        <option value="alpha">A-Z</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    {loading ? (
                        <div className="text-center py-12 text-gray-400">Loading preview...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-slate-900/50 backdrop-blur-xl rounded-lg shadow-2xl shadow-black/20 p-8 border border-white/10">
                            <p className="text-lg mb-2">No items found.</p>
                            <p className="text-sm">Try using different search terms or filters.</p>
                        </div>
                    ) : viewMode === "grid" ? (
                        /* Grid View */
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredItems.map((item, index) => (
                                <div key={item.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/20 p-4 flex items-center gap-6 group hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all border border-white/10 hover:border-indigo-500/30 relative h-full">
                                    {/* Image */}
                                    <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                        {item.imageUrl ? (
                                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/20 relative">
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.title || "Item"}
                                                    className="w-full h-full object-cover"
                                                    referrerPolicy="no-referrer"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center text-gray-500 text-xs border-2 border-white/10 shadow-sm">
                                                No Img
                                            </div>
                                        )}
                                    </Link>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-indigo-500/30 leading-none">
                                                #{index + 1}
                                            </div>
                                            <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                <h3 className="font-bold text-xl text-white hover:text-indigo-400 transition truncate">
                                                    {item.title || "Untitled"}
                                                </h3>
                                            </Link>
                                        </div>

                                        <p className="text-gray-400 text-sm line-clamp-1">{item.content}</p>

                                        {item.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {item.tags.slice(0, 4).map(({ tag }) => (
                                                    <button
                                                        key={tag.id}
                                                        onClick={() => openSmartList(tag.name)}
                                                        className="inline-block px-3 py-1 bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-300 border border-green-500/30 rounded-full text-xs font-medium hover:from-green-600/30 hover:to-emerald-600/30 hover:border-green-500/50 transition-all cursor-pointer"
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
                            {filteredItems.map((item, index) => (
                                <div key={item.id} className="bg-slate-900/50 backdrop-blur-xl rounded-lg shadow-sm border border-white/10 p-3 flex flex-col gap-2 group hover:border-indigo-500/30 transition-all relative">
                                    <div className="flex items-center gap-3">
                                        {/* Rank Badge */}
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-500/30 leading-none">
                                            #{index + 1}
                                        </div>

                                        {/* Title */}
                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                            <h3 className="font-bold text-white hover:text-indigo-400 transition truncate text-sm">
                                                {item.title || "Untitled"}
                                            </h3>
                                        </Link>

                                        {/* Actions & Metadata */}
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                                            <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</span>

                                            {item.shares?.length > 0 && (
                                                <div className="text-[#4f46e5] font-medium text-xs flex items-center gap-1" title="Shared">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                                        <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}

                                            <ShareButton
                                                type="ITEM"
                                                id={item.id}
                                                title={item.title || "Item"}
                                                className="bg-[#2563eb] text-white hover:bg-blue-700 px-3 py-1 rounded-full text-xs font-medium transition-colors border-0 shadow-sm"
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
                                                className="p-1 rounded border border-[#ef4444] text-[#ef4444] hover:bg-red-50 transition-colors"
                                                title="Delete item"
                                            >
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Tags (if any) */}
                                    {item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pl-0 sm:pl-[calc(1.5rem+12px)]">
                                            {item.tags.slice(0, 4).map(({ tag }) => (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => openSmartList(tag.name)}
                                                    className="inline-block px-2 py-0.5 bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-300 border border-green-500/30 rounded-full text-[10px] font-medium hover:from-green-600/30 hover:to-emerald-600/30 hover:border-green-500/50 transition-all cursor-pointer"
                                                >
                                                    #{tag.name}
                                                </button>
                                            ))}
                                            {item.tags.length > 4 && (
                                                <span className="text-[10px] text-gray-400 self-center">+{item.tags.length - 4}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}

export default function SmartListPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading...</div>}>
            <SmartListContent />
        </Suspense>
    );
}
