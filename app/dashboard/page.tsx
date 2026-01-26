"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShareButton } from "../components/ShareButton";
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, TouchSensor, MouseSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "../components/SortableItem";
import { LexoRank } from "lexorank";

// ... interfaces Item, Tag, ListSummary (keep them)
interface Tag {
    id: string;
    name: string;
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
    ranks: { rank: string }[];
    createdAt: string;
}

interface ListSummary {
    id: string;
    title: string;
    filterTags: { tag: Tag }[];
    createdAt: string;
}

export default function Dashboard() {
    const { data: session } = useSession();
    const router = useRouter();

    const [items, setItems] = useState<Item[]>([]);
    const [lists, setLists] = useState<ListSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<string>("date");
    const [listSort, setListSort] = useState<"alpha" | "newest">("newest");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
    );

    useEffect(() => {
        Promise.all([fetchItems(), fetchLists()]);
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchItems();
        }, 300);
        return () => clearTimeout(handler);
    }, [search, sort]);

    const fetchLists = async () => {
        try {
            const res = await fetch("/api/lists");
            if (res.ok) {
                const data = await res.json();
                setLists(data);
            }
        } catch (e) {
            console.error("Failed to fetch lists", e);
        }
    }

    const fetchItems = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (sort && sort !== "rank") params.set("sort", sort);

            console.log('[Dashboard] Fetching items with params:', params.toString());
            const res = await fetch(`/api/items?${params.toString()}`);
            console.log('[Dashboard] Response status:', res.status, res.statusText);

            if (res.ok) {
                const data = await res.json();
                console.log('[Dashboard] Received items:', data.length, 'items');
                console.log('[Dashboard] First item:', data[0]);
                setItems(data);
            } else {
                console.error('[Dashboard] Failed to fetch items:', res.status, await res.text());
            }
        } catch (e) {
            console.error('[Dashboard] Error fetching items:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(10);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setItems((items) => {
            const oldIndex = items.findIndex((i) => i.id === active.id);
            const newIndex = items.findIndex((i) => i.id === over.id);

            const newItems = arrayMove(items, oldIndex, newIndex);

            // Calculate Rank
            const prevItem = newItems[newIndex - 1];
            const nextItem = newItems[newIndex + 1];

            const prevRankStr = prevItem?.ranks?.[0]?.rank || LexoRank.min().toString();
            const nextRankStr = nextItem?.ranks?.[0]?.rank || LexoRank.max().toString();

            let newRankStr;
            try {
                // Check for collision or invalid sort order
                if (prevRankStr === nextRankStr) {
                    console.warn("Rank collision detected. Generating next rank.");
                    const prev = LexoRank.parse(prevRankStr);
                    newRankStr = prev.genNext().toString();
                } else {
                    const prev = LexoRank.parse(prevRankStr);
                    const next = LexoRank.parse(nextRankStr);
                    newRankStr = prev.between(next).toString();
                }
            } catch (e) {
                console.error("Rank calc error", e);
                // Fallback: If calculation fails, try generating next from previous
                // If even that fails, use a timestamp-based fallback to ensure uniqueness (though order might vary)
                try {
                    const prev = LexoRank.parse(prevRankStr);
                    newRankStr = prev.genNext().toString();
                } catch (fallbackErr) {
                    // Last resort: random position in middle bucket to break stuck state
                    // This is just to allow the drop to succeed
                    newRankStr = LexoRank.middle().toString();
                }
            }

            // Update item locally
            newItems[newIndex].ranks[0] = { rank: newRankStr };

            // API Update
            fetch("/api/ranks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contextId: "dashboard",
                    updates: [{ itemId: active.id, rank: newRankStr }]
                })
            });

            return newItems;
        });
    };

    const openSmartList = (tagName: string) => {
        router.push(`/smart-lists?tags=${encodeURIComponent(tagName)}`);
    };

    const isDraggable = !sort || sort === "rank";

    if (loading && items.length === 0) {
        return <div className="p-8 text-center text-gray-500">Loading your world...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-white border-r border-gray-200 min-h-screen flex-shrink-0">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-800">My Top 10</h2>
                        <button
                            onClick={() => setListSort(prev => prev === "alpha" ? "newest" : "alpha")}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors"
                            title={listSort === "alpha" ? "Sort by Newest" : "Sort A-Z"}
                        >
                            {listSort === "alpha" ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path alpha-sort="true" d="M10 2a1 1 0 011 1v13.586l2.293-2.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 16.586V3a1 1 0 011-1z" />
                                    {/* Simplified icon for "Newest" / Time sort */}
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <ul className="space-y-1">
                        {[...lists]
                            .sort((a, b) => {
                                if (listSort === "alpha") {
                                    return a.title.localeCompare(b.title);
                                } else {
                                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                                }
                            })
                            .map(list => (
                                <li key={list.id}>
                                    <Link href={`/lists/${list.id}`} className="block px-3 py-2 rounded-md text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition truncate">
                                        {list.title}
                                    </Link>
                                </li>
                            ))}
                    </ul>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 min-w-0">
                {/* Header with Logo, Search, and Add Button */}
                <header className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        {/* Logo */}
                        <h1 className="text-2xl font-bold text-gray-900">Vaulted</h1>

                        {/* Add New Item Button - Green */}
                        <Link
                            href="/items/new"
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 !text-white rounded-lg hover:bg-green-700 hover:-translate-y-0.5 transition-all font-bold text-sm shadow-lg hover:shadow-xl"
                        >
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-white">Add New Item</span>
                        </Link>
                    </div>

                    {/* Search Bar and Controls Row */}
                    <div className="flex items-center gap-4">
                        {/* Search Bar - Mintlify Style */}
                        <div className="flex-1 max-w-2xl relative">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="w-full pl-10 pr-20 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-300 rounded">
                                        ⌘K
                                    </kbd>
                                </div>
                            </div>
                        </div>

                        {/* View and Sort Controls - Grouped */}
                        <div className="flex items-center gap-3 border border-gray-300 rounded-lg p-1 bg-white">
                            {/* View Toggle */}
                            <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
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

                            {/* Sort Dropdown */}
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 font-medium">Sort:</span>
                                <select
                                    className="border-0 focus:ring-0 text-sm font-medium text-gray-900 bg-transparent cursor-pointer pr-8"
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value)}
                                >
                                    <option value="rank">Rank</option>
                                    <option value="date">Newest</option>
                                    <option value="alpha">A-Z</option>
                                    <option value="shared">Shared By</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </header>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy} disabled={!isDraggable}>
                        {viewMode === "grid" ? (
                            /* Grid View - Tiles */
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {items.map((item, index) => (
                                    <SortableItem key={item.id} id={item.id}>
                                        {(dragHandleProps) => (
                                            <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-6 group hover:shadow-lg transition-shadow border border-gray-100 relative h-full">
                                                {/* Left Control (Grip) */}
                                                {isDraggable && (
                                                    <div className="text-[#a5b4fc] hover:text-[#818cf8] cursor-grab active:cursor-grabbing flex-shrink-0 pr-2 border-r border-gray-100 h-full flex items-center" {...dragHandleProps}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                    </div>
                                                )}

                                                {/* Media (Image) */}
                                                <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                    {item.imageUrl ? (
                                                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm relative">
                                                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-2 border-gray-100 shadow-sm">
                                                            No Img
                                                        </div>
                                                    )}
                                                </Link>

                                                {/* Content Body */}
                                                <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
                                                    {/* Row 1: Header (Rank & Title) */}
                                                    <div className="flex items-center gap-3">
                                                        {isDraggable && (
                                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#6366f1] text-white flex items-center justify-center font-bold text-sm shadow-sm leading-none">
                                                                #{index + 1}
                                                            </div>
                                                        )}
                                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                            <h3 className="font-bold text-xl text-gray-900 hover:text-indigo-600 transition truncate">
                                                                {item.title || "Untitled"}
                                                            </h3>
                                                        </Link>
                                                    </div>

                                                    {/* Row 2: Description */}
                                                    <p className="text-gray-600 text-sm line-clamp-1">{item.content}</p>

                                                    {/* Row 3: Tags */}
                                                    {item.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {item.tags.slice(0, 4).map(({ tag }) => (
                                                                <button
                                                                    key={tag.id}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        openSmartList(tag.name);
                                                                    }}
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

                                                    {/* Row 4: Actions & Metadata (Footer) */}
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
                                                                        if (res.ok) fetchItems();
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
                                        )}
                                    </SortableItem>
                                ))}
                            </div>
                        ) : (
                            /* List View - Compact Rows */
                            <div className="space-y-2">
                                {items.map((item, index) => (
                                    <SortableItem key={item.id} id={item.id}>
                                        {(dragHandleProps) => (
                                            <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-6 group hover:shadow-lg transition-shadow border border-gray-100 relative">
                                                {/* Left Control (Grip) */}
                                                {isDraggable && (
                                                    <div className="text-[#a5b4fc] hover:text-[#818cf8] cursor-grab active:cursor-grabbing flex-shrink-0 pr-2 border-r border-gray-100 h-full flex items-center" {...dragHandleProps}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                    </div>
                                                )}

                                                {/* Thumbnail */}
                                                {/* Media (Image) */}
                                                <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                    {item.imageUrl ? (
                                                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm relative">
                                                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-2 border-gray-100 shadow-sm">
                                                            No Img
                                                        </div>
                                                    )}
                                                </Link>

                                                {/* Content Body */}
                                                <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
                                                    {/* Row 1: Header (Rank & Title) */}
                                                    <div className="flex items-center gap-3">
                                                        {isDraggable && (
                                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#6366f1] text-white flex items-center justify-center font-bold text-sm shadow-sm leading-none">
                                                                #{index + 1}
                                                            </div>
                                                        )}
                                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                            <h3 className="font-bold text-xl text-gray-900 hover:text-indigo-600 transition truncate">
                                                                {item.title || "Untitled"}
                                                            </h3>
                                                        </Link>
                                                    </div>

                                                    {/* Row 2: Description */}
                                                    <p className="text-gray-600 text-sm line-clamp-1">{item.content}</p>

                                                    {/* Row 3: Tags */}
                                                    {item.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {item.tags.slice(0, 4).map(({ tag }) => (
                                                                <button
                                                                    key={tag.id}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        openSmartList(tag.name);
                                                                    }}
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

                                                    {/* Row 4: Actions & Metadata (Footer) */}
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
                                                                        if (res.ok) fetchItems();
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
                                        )}
                                    </SortableItem>
                                ))}
                            </div>
                        )}
                    </SortableContext>
                </DndContext>

                <footer className="mt-12 text-xs text-gray-400 text-center border-t pt-4">
                </footer>
            </main>
        </div>
    );
}

