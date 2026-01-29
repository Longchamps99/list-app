"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShareButton } from "../components/ShareButton";
import { Header } from "../components/Header";
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, TouchSensor, MouseSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "../components/SortableItem";
import { LexoRank } from "lexorank";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ToastContainer, ToastMessage } from "../components/Toast";

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
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Toast State
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const pendingDeletes = useRef<Map<string, { timeout: NodeJS.Timeout, item: Item, index: number }>>(new Map());

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
            if (search.trim()) {
                posthog.capture('item_search_performed', {
                    search_term: search,
                    sort_by: sort,
                });
            }
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

            const res = await fetch(`/api/items?${params.toString()}`);

            if (res.ok) {
                const data = await res.json();
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

    const showToast = (message: string, action?: { label: string, onClick: () => void }, duration = 4000) => {
        const id = Math.random().toString(36).substring(7);
        setToasts(prev => [...prev, { id, message, action, duration }]);
        setTimeout(() => removeToast(id), duration);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleDelete = async (itemId: string) => {
        const itemIndex = items.findIndex(i => i.id === itemId);
        const itemToDelete = items[itemIndex];
        if (!itemToDelete) return;

        // Optimistic UI update
        setItems(prev => prev.filter(i => i.id !== itemId));

        // Set timeout for actual API call
        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
                if (!res.ok) console.error("Failed to delete item server-side");
                pendingDeletes.current.delete(itemId);
            } catch (err) {
                console.error(err);
            }
        }, 3500); // 3.5s delay to allow undo

        // Store pending delete info
        pendingDeletes.current.set(itemId, { timeout, item: itemToDelete, index: itemIndex });

        // Show Undo Toast
        showToast("Item deleted", {
            label: "Undo",
            onClick: () => handleUndo(itemId)
        });
    };

    const handleUndo = (itemId: string) => {
        const pending = pendingDeletes.current.get(itemId);
        if (pending) {
            clearTimeout(pending.timeout);

            // Restore item to correct position
            setItems(prev => {
                const newItems = [...prev];
                newItems.splice(pending.index, 0, pending.item);
                return newItems;
            });

            pendingDeletes.current.delete(itemId);
            // Ideally we dismiss the toast here, but simple timeout cleanup is strictly enough for functionality
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

            const prevItem = newItems[newIndex - 1];
            const nextItem = newItems[newIndex + 1];

            const prevRankStr = prevItem?.ranks?.[0]?.rank || LexoRank.min().toString();
            const nextRankStr = nextItem?.ranks?.[0]?.rank || LexoRank.max().toString();

            let newRankStr;
            try {
                if (prevRankStr === nextRankStr) {
                    const prev = LexoRank.parse(prevRankStr);
                    newRankStr = prev.genNext().toString();
                } else {
                    const prev = LexoRank.parse(prevRankStr);
                    const next = LexoRank.parse(nextRankStr);
                    newRankStr = prev.between(next).toString();
                }
            } catch (e) {
                console.error("Rank calc error", e);
                try {
                    const prev = LexoRank.parse(prevRankStr);
                    newRankStr = prev.genNext().toString();
                } catch (fallbackErr) {
                    newRankStr = LexoRank.middle().toString();
                }
            }

            newItems[newIndex].ranks[0] = { rank: newRankStr };

            fetch("/api/ranks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contextId: "dashboard",
                    updates: [{ itemId: active.id, rank: newRankStr }]
                })
            });

            posthog.capture('item_reordered', {
                item_id: active.id,
                old_index: oldIndex,
                new_index: newIndex,
                new_rank: newRankStr,
            });

            return newItems;
        });
    };

    const openSmartList = (tagName: string) => {
        posthog.capture('tag_clicked', {
            tag_name: tagName,
        });
        router.push(`/smart-lists?tags=${encodeURIComponent(tagName)}`);
    };

    const isDraggable = !sort || sort === "rank";

    const SidebarContent = (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white uppercase tracking-wider text-xs opacity-50">My Smart Lists</h2>
                <button
                    onClick={() => setListSort(prev => prev === "alpha" ? "newest" : "alpha")}
                    className="p-1 text-gray-400 hover:text-indigo-400 rounded transition-colors"
                    title={listSort === "alpha" ? "Sort by Newest" : "Sort A-Z"}
                >
                    {listSort === "alpha" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path alpha-sort="true" d="M10 2a1 1 0 011 1v13.586l2.293-2.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 16.586V3a1 1 0 011-1z" />
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
                            <Link
                                href={`/lists/${list.id}`}
                                className="block px-3 py-2 rounded-md text-gray-300 hover:bg-white/5 hover:text-indigo-400 transition truncate border border-transparent hover:border-white/10"
                                onClick={() => setIsMobileSidebarOpen(false)}
                            >
                                {list.title}
                            </Link>
                        </li>
                    ))}
                {lists.length === 0 && (
                    <p className="text-gray-500 text-sm px-3 py-2 italic">Save a tag search to create your first Smart List</p>
                )}
            </ul>
        </div>
    );

    if (loading && items.length === 0) {
        return <div className="p-8 text-center text-gray-500">Loading your world...</div>;
    }

    return (
        <>
            <ToastContainer toasts={toasts} onDismiss={removeToast} />
            <Header variant="dashboard" onMenuClick={() => setIsMobileSidebarOpen(true)} />
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col md:flex-row relative overflow-hidden">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                </div>

                <aside className="hidden md:block w-64 bg-slate-900/50 backdrop-blur-xl border-r border-white/10 min-h-screen flex-shrink-0 relative z-10">
                    {SidebarContent}
                </aside>

                <AnimatePresence>
                    {isMobileSidebarOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsMobileSidebarOpen(false)}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[101] md:hidden"
                            />
                            <motion.aside
                                initial={{ x: "-100%" }}
                                animate={{ x: 0 }}
                                exit={{ x: "-100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-white/10 z-[102] md:hidden overflow-y-auto"
                            >
                                <div className="flex justify-end p-4">
                                    <button
                                        onClick={() => setIsMobileSidebarOpen(false)}
                                        className="p-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                {SidebarContent}
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                <main className="flex-1 p-8 min-w-0 relative z-10">
                    <div className="mb-6 flex items-center justify-between">
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

                        <div className="flex items-center gap-3">
                            <Link
                                href="/items/new"
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 !text-white rounded-lg hover:from-green-500 hover:to-emerald-500 hover:-translate-y-0.5 transition-all font-bold text-sm shadow-lg shadow-green-500/30 hover:shadow-green-500/50"
                            >
                                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-white hidden sm:inline">New Item</span>
                            </Link>


                            <div className="flex items-center gap-3 border border-white/10 rounded-lg p-1 bg-slate-800/50 backdrop-blur-sm">
                                <div className="flex items-center gap-1 border-r border-white/10 pr-3">
                                    <button
                                        onClick={() => {
                                            setViewMode("grid");
                                            posthog.capture('view_mode_changed', { view_mode: 'grid' });
                                        }}
                                        className={`p-2 rounded transition-colors ${viewMode === "grid" ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                                        title="Grid view"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setViewMode("list");
                                            posthog.capture('view_mode_changed', { view_mode: 'list' });
                                        }}
                                        className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                                        title="List view"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </button>
                                </div>

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
                                        <option value="shared">Shared By</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy} disabled={!isDraggable}>
                            {viewMode === "grid" ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {items.map((item, index) => (
                                        <SortableItem key={item.id} id={item.id}>
                                            {(dragHandleProps) => (
                                                <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/20 p-4 flex items-center gap-6 group hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all border border-white/10 hover:border-indigo-500/30 relative h-full">
                                                    {isDraggable && (
                                                        <div className="text-indigo-400 hover:text-indigo-300 cursor-grab active:cursor-grabbing flex-shrink-0 pr-2 border-r border-white/10 h-full flex items-center" {...dragHandleProps}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                        </div>
                                                    )}

                                                    <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                        {item.imageUrl ? (
                                                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/20 relative">
                                                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center text-gray-500 text-xs border-2 border-white/10 shadow-sm">
                                                                No Img
                                                            </div>
                                                        )}
                                                    </Link>

                                                    <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
                                                        <div className="flex items-center gap-3">
                                                            {isDraggable && (
                                                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-indigo-500/30 leading-none">
                                                                    #{index + 1}
                                                                </div>
                                                            )}
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
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            openSmartList(tag.name);
                                                                        }}
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

                                                        <div className="flex items-center gap-4 mt-2">
                                                            <ShareButton
                                                                type="ITEM"
                                                                id={item.id}
                                                                title={item.title || "Item"}
                                                                className="bg-[#2563eb] text-white hover:bg-blue-700 px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors border-0 shadow-sm"
                                                            />

                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleDelete(item.id);
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
                                <div className="space-y-2">
                                    {items.map((item, index) => (
                                        <SortableItem key={item.id} id={item.id}>
                                            {(dragHandleProps) => (
                                                <div className="bg-slate-900/50 backdrop-blur-xl rounded-lg shadow-sm border border-white/10 p-3 flex flex-col gap-2 group hover:border-indigo-500/30 transition-all relative">
                                                    <div className="flex items-center gap-3">
                                                        {isDraggable && (
                                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-500/30 leading-none">
                                                                #{index + 1}
                                                            </div>
                                                        )}

                                                        {isDraggable && (
                                                            <div className="cursor-grab text-indigo-400 hover:text-indigo-300 px-1 border-r border-white/10 pr-2 flex-shrink-0" {...dragHandleProps}>
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                            <h3 className="font-bold text-white hover:text-indigo-400 transition truncate text-sm">
                                                                {item.title || "Untitled"}
                                                            </h3>
                                                        </Link>

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
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleDelete(item.id);
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

                                                    {item.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pl-0 sm:pl-[calc(1.5rem+12px)]"> {/* Indent to align with title if desired, or keep left */}
                                                            {item.tags.slice(0, 4).map(({ tag }) => (
                                                                <button
                                                                    key={tag.id}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        openSmartList(tag.name);
                                                                    }}
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
        </>
    );
}
