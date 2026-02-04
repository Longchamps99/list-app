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
    ownerId: string;
    owner: { email: string; id: string };
    shares: { userId: string; permission: string; user: { email: string } }[];
    itemCount: number;
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
    const [isOnboarding, setIsOnboarding] = useState(false);

    // Toast State
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const pendingDeletes = useRef<Map<string, { timeout: NodeJS.Timeout, item: Item, index: number }>>(new Map());
    const processedOnboarding = useRef(false);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
    );

    useEffect(() => {
        const initializeDashboard = async () => {
            // Check if we have onboarding items waiting
            const hasOnboarding = typeof window !== 'undefined' && !!localStorage.getItem("tempTop5");

            if (hasOnboarding && !processedOnboarding.current) {
                setIsOnboarding(true);
                processedOnboarding.current = true;
                await checkOnboarding();
            } else {
                await Promise.all([fetchItems(), fetchLists()]);
            }
        };
        initializeDashboard();
    }, []);

    const checkOnboarding = async () => {
        const saved = localStorage.getItem("tempTop5");
        if (!saved) return;

        // Optimistically remove to prevent double-submission in race conditions
        localStorage.removeItem("tempTop5");

        try {
            let items = JSON.parse(saved).filter((item: string) => item && item.trim() !== "");
            // Deduplicate items
            items = Array.from(new Set(items));

            if (items.length === 0) return;

            // Create the onboarding list
            const response = await fetch("/api/lists/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items,
                    title: "My Top 5 Movies"
                }),
            });

            if (response.ok) {
                const data = await response.json();

                // If backend skipped it (e.g. user already has lists), just clean up and exit
                if (data.skipped) {
                    console.log("Onboarding skipped by server (user likely already has lists)");
                    setIsOnboarding(false);
                    return;
                }

                showToast("Your Top 5 list has been saved!", {
                    label: "View List",
                    onClick: () => router.push(`/lists/${data.listId}`)
                });
                // Refresh lists to show the new one in sidebar
                await fetchLists();
                // Refresh items to show them in the main view immediately
                await fetchItems();
                setIsOnboarding(false);
            } else {
                // If failed, restore the item so they can try again (or we can retry)
                console.error("Onboarding failed, restoring items");
                localStorage.setItem("tempTop5", saved);
                setIsOnboarding(false);
            }
        } catch (error) {
            console.error("Failed to create onboarding list:", error);
            // Restore on error
            localStorage.setItem("tempTop5", saved);
        }
    };

    useEffect(() => {
        if (isOnboarding) return;
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
        router.push(`/smart-lists?tags=${encodeURIComponent(tagName.toLowerCase())}`);
    };

    const isDraggable = !sort || sort === "rank";

    // Separate lists into owned and shared
    const myLists = lists.filter(list => list.ownerId === (session?.user as any)?.id);
    const sharedWithMe = lists.filter(list => list.ownerId !== (session?.user as any)?.id);

    const sortLists = (listsToSort: ListSummary[]) => {
        return [...listsToSort].sort((a, b) => {
            if (listSort === "alpha") {
                return a.title.localeCompare(b.title);
            } else {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });
    };

    const SidebarContent = (
        <div className="p-6">
            {/* Search Bar in Sidebar */}
            <div className="mb-8 relative">
                <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-[var(--swiss-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-[var(--swiss-border)] rounded-full focus:border-[var(--swiss-black)] focus:outline-none transition-all text-sm text-[var(--swiss-text)] placeholder-[var(--swiss-text-muted)]"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* My Lists Section */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-[var(--swiss-text-secondary)] uppercase tracking-wider text-xs">My Lists</h2>
                <button
                    onClick={() => setListSort(prev => prev === "alpha" ? "newest" : "alpha")}
                    className="p-1 text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] rounded transition-colors"
                    title={listSort === "alpha" ? "Sort by Newest" : "Sort A-Z"}
                >
                    {listSort === "alpha" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 2a1 1 0 011 1v13.586l2.293-2.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 16.586V3a1 1 0 011-1z" />
                        </svg>
                    )}
                </button>
            </div>

            <ul className="space-y-0.5 mb-8">
                {sortLists(myLists).map(list => (
                    <li key={list.id}>
                        <Link
                            href={`/lists/${list.id}`}
                            className="flex items-center justify-between px-3 py-2 rounded-md text-[var(--swiss-text)] hover:bg-white transition group"
                            onClick={() => setIsMobileSidebarOpen(false)}
                        >
                            <span className="truncate">{list.title}</span>
                            <span className="flex-shrink-0 text-xs text-[var(--swiss-text-muted)]">({list.itemCount})</span>
                        </Link>
                    </li>
                ))}
                {myLists.length === 0 && (
                    <p className="text-[var(--swiss-text-muted)] text-sm px-3 py-2">Save a tag search to create your first Smart List</p>
                )}
            </ul>

            {/* Shared with Me Section */}
            {sharedWithMe.length > 0 && (
                <>
                    <div className="flex items-center mb-4">
                        <h2 className="font-medium text-[var(--swiss-text-secondary)] uppercase tracking-wider text-xs">Shared with Me</h2>
                    </div>

                    <ul className="space-y-0.5">
                        {sortLists(sharedWithMe).map(list => (
                            <li key={list.id}>
                                <Link
                                    href={`/lists/${list.id}`}
                                    className="block px-3 py-2 rounded-md text-[var(--swiss-text)] hover:bg-white transition group"
                                    onClick={() => setIsMobileSidebarOpen(false)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="truncate flex-1">{list.title}</span>
                                        <span className="flex-shrink-0 text-xs text-[var(--swiss-text-muted)]">({list.itemCount})</span>
                                    </div>
                                    <p className="text-[10px] text-[var(--swiss-text-muted)] mt-0.5 truncate">by {list.owner.email}</p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );

    if (loading && items.length === 0) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-[var(--swiss-border)] border-t-[var(--swiss-black)] rounded-full animate-spin"></div>
                    <p className="text-[var(--swiss-text-secondary)] font-medium">
                        {isOnboarding ? "Creating your vault..." : "Loading..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <ToastContainer toasts={toasts} onDismiss={removeToast} />
            <Header variant="dashboard" onMenuClick={() => setIsMobileSidebarOpen(true)} />
            <div className="min-h-screen bg-white flex flex-col md:flex-row">

                <aside className="hidden md:block w-64 bg-[var(--swiss-off-white)] border-r border-[var(--swiss-border)] min-h-screen flex-shrink-0">
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
                                className="fixed inset-0 bg-black/30 z-[101] md:hidden"
                            />
                            <motion.aside
                                initial={{ x: "-100%" }}
                                animate={{ x: 0 }}
                                exit={{ x: "-100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed inset-y-0 left-0 w-72 bg-white border-r border-[var(--swiss-border)] z-[102] md:hidden overflow-y-auto"
                            >
                                <div className="flex justify-end p-4">
                                    <button
                                        onClick={() => setIsMobileSidebarOpen(false)}
                                        className="p-2 text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] transition-colors"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                {SidebarContent}
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                <main className="flex-1 p-8 min-w-0">
                    <div className="mb-8 flex items-center justify-end">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/items/new"
                                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--swiss-black)] text-white rounded-full hover:bg-[var(--swiss-accent-hover)] transition-all font-medium text-sm"
                            >
                                <svg className="h-4 w-4 stroke-white" fill="none" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="hidden sm:inline text-white">New Item</span>
                            </Link>


                            <div className="flex items-center gap-3 border border-[var(--swiss-border)] rounded-full px-2 py-1 bg-white">
                                <div className="flex items-center gap-1 border-r border-[var(--swiss-border)] pr-3">
                                    <button
                                        onClick={() => {
                                            setViewMode("grid");
                                            posthog.capture('view_mode_changed', { view_mode: 'grid' });
                                        }}
                                        className={`p-1.5 rounded-full transition-colors ${viewMode === "grid" ? "bg-[var(--swiss-black)]" : "text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)]"}`}
                                        title="Grid view"
                                    >
                                        <svg className={`h-4 w-4 ${viewMode === "grid" ? "stroke-white" : "stroke-current"}`} fill="none" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setViewMode("list");
                                            posthog.capture('view_mode_changed', { view_mode: 'list' });
                                        }}
                                        className={`p-1.5 rounded-full transition-colors ${viewMode === "list" ? "bg-[var(--swiss-black)]" : "text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)]"}`}
                                        title="List view"
                                    >
                                        <svg className={`h-4 w-4 ${viewMode === "list" ? "stroke-white" : "stroke-current"}`} fill="none" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-[var(--swiss-text-muted)] font-medium">Sort:</span>
                                    <select
                                        className="border-0 focus:ring-0 text-sm font-medium text-[var(--swiss-text)] bg-transparent cursor-pointer pr-6"
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
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {items.map((item, index) => (
                                        <SortableItem key={item.id} id={item.id}>
                                            {(dragHandleProps) => (
                                                <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-5 flex items-start gap-5 group hover:border-[var(--swiss-text-muted)] transition-all h-full">
                                                    {isDraggable && (
                                                        <div className="text-[var(--swiss-text-muted)] hover:text-[var(--swiss-text)] cursor-grab active:cursor-grabbing flex-shrink-0 pt-1" {...dragHandleProps}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                        </div>
                                                    )}

                                                    <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                        {item.imageUrl ? (
                                                            <div className="w-20 h-20 rounded-lg overflow-hidden">
                                                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-20 h-20 rounded-lg bg-[var(--swiss-off-white)] flex items-center justify-center text-[var(--swiss-text-muted)] text-xs">
                                                                No Img
                                                            </div>
                                                        )}
                                                    </Link>

                                                    <div className="flex-1 flex flex-col gap-1.5 min-w-0 overflow-hidden">
                                                        <div className="flex items-center gap-2">
                                                            {isDraggable && (
                                                                <div className="flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
                                                                    <span className="text-base font-bold">{String(index + 1).padStart(2, '0')}</span>
                                                                </div>
                                                            )}
                                                            <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                                <h3 className="font-semibold text-lg text-[var(--swiss-black)] hover:text-[var(--swiss-text-secondary)] transition truncate">
                                                                    {item.title || "Untitled"}
                                                                </h3>
                                                            </Link>
                                                        </div>

                                                        <p className="text-[var(--swiss-text-secondary)] text-sm line-clamp-1">{item.content}</p>

                                                        {item.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                                {item.tags.slice(0, 4).map(({ tag }) => (
                                                                    <button
                                                                        key={tag.id}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            openSmartList(tag.name);
                                                                        }}
                                                                        className="inline-block px-2.5 py-0.5 bg-[var(--swiss-off-white)] text-[var(--swiss-text-secondary)] border border-[var(--swiss-border)] rounded-full text-xs font-medium hover:bg-[var(--swiss-cream)] hover:border-[var(--swiss-text-muted)] transition-all cursor-pointer"
                                                                    >
                                                                        #{tag.name}
                                                                    </button>
                                                                ))}
                                                                {item.tags.length > 4 && (
                                                                    <span className="text-xs text-[var(--swiss-text-muted)] self-center">+{item.tags.length - 4}</span>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-3 mt-2">
                                                            <ShareButton
                                                                type="ITEM"
                                                                id={item.id}
                                                                title={item.title || "Item"}
                                                                className="bg-[var(--swiss-black)] text-white hover:bg-[var(--swiss-accent-hover)] px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors border-0"
                                                            />

                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleDelete(item.id);
                                                                }}
                                                                className="p-1 rounded text-[var(--swiss-text-muted)] hover:text-[var(--swiss-red)] transition-colors"
                                                                title="Delete item"
                                                            >
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>

                                                            <span className="text-xs text-[var(--swiss-text-muted)]">{new Date(item.createdAt).toLocaleDateString()}</span>
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
                                                <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-3 flex flex-col gap-2 group hover:border-[var(--swiss-text-muted)] transition-all">
                                                    <div className="flex items-center gap-3">
                                                        {isDraggable && (
                                                            <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
                                                                <span className="text-sm font-bold">{String(index + 1).padStart(2, '0')}</span>
                                                            </div>
                                                        )}

                                                        {isDraggable && (
                                                            <div className="cursor-grab text-[var(--swiss-text-muted)] hover:text-[var(--swiss-text)] px-1 border-r border-[var(--swiss-border)] pr-2 flex-shrink-0" {...dragHandleProps}>
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                            <h3 className="font-medium text-[var(--swiss-black)] hover:text-[var(--swiss-text-secondary)] transition truncate text-sm">
                                                                {item.title || "Untitled"}
                                                            </h3>
                                                        </Link>

                                                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                                                            <span className="text-xs text-[var(--swiss-text-muted)] whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</span>

                                                            <ShareButton
                                                                type="ITEM"
                                                                id={item.id}
                                                                title={item.title || "Item"}
                                                                className="bg-[var(--swiss-black)] text-white hover:bg-[var(--swiss-accent-hover)] px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border-0"
                                                            />

                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleDelete(item.id);
                                                                }}
                                                                className="p-1 rounded text-[var(--swiss-text-muted)] hover:text-[var(--swiss-red)] transition-colors"
                                                                title="Delete item"
                                                            >
                                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {item.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pl-0 sm:pl-6">
                                                            {item.tags.slice(0, 4).map(({ tag }) => (
                                                                <button
                                                                    key={tag.id}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        openSmartList(tag.name);
                                                                    }}
                                                                    className="inline-block px-2 py-0.5 bg-[var(--swiss-off-white)] text-[var(--swiss-text-secondary)] border border-[var(--swiss-border)] rounded-full text-[10px] font-medium hover:bg-[var(--swiss-cream)] hover:border-[var(--swiss-text-muted)] transition-all cursor-pointer"
                                                                >
                                                                    #{tag.name}
                                                                </button>
                                                            ))}
                                                            {item.tags.length > 4 && (
                                                                <span className="text-[10px] text-[var(--swiss-text-muted)] self-center">+{item.tags.length - 4}</span>
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

                    <footer className="mt-12 text-xs text-[var(--swiss-text-muted)] text-center border-t border-[var(--swiss-border)] pt-4">
                    </footer>
                </main>
            </div>
        </>
    );
}
