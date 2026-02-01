"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    TouchSensor,
    MouseSensor
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
    horizontalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// @ts-ignore
import { LexoRank } from "lexorank";

import { ShareButton } from "../../components/ShareButton";
import { Header } from "../../components/Header";

function SortableItem({ id, children }: { id: string; children: (props: any) => React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : "auto",
        position: isDragging ? "relative" as const : "static" as const, // Fix z-index
    };

    return (
        <div ref={setNodeRef} style={style} className="h-full">
            {children({ ...attributes, ...listeners })}
        </div>
    );
}

interface Tag {
    id: string;
    name: string;
    color: string;
}

interface Item {
    id: string;
    content: string;
    title?: string;
    imageUrl?: string;
    link?: string;
    isChecked: boolean;
    tags: { tag: Tag }[];
    ranks: { rank: string }[];
    shares: {
        sharedBy: {
            name: string | null;
            image: string | null;
            email: string | null;
        }
    }[];
    createdAt: string;
}

interface List {
    id: string;
    title: string;
    items: Item[];
    filterTags: { tag: Tag }[];
    ownerId: string;
    shares: {
        userId: string;
        permission: string;
        user: { email: string };
    }[];
}

export default function ListPage() {
    const params = useParams();
    const id = params?.id as string;

    const [list, setList] = useState<List | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("rank");

    const router = useRouter();

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
    );

    // Invite Collaborator state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePermission, setInvitePermission] = useState<'READ' | 'WRITE'>('WRITE');
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        if (id) fetchList();
    }, [id]);

    const fetchList = async () => {
        try {
            const res = await fetch(`/api/lists/${id}`);
            if (!res.ok) {
                if (res.status === 404) router.push("/dashboard");
                return;
            }
            const data = await res.json();
            setList(data);
        } catch (e) {
            console.error(e);
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
        if (!over || active.id === over.id || !list) return;

        const items = list.items;
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
            if (prevRankStr === nextRankStr) {
                const prev = LexoRank.parse(prevRankStr);
                newRankStr = prev.genNext().toString();
            } else {
                const prev = LexoRank.parse(prevRankStr);
                const next = LexoRank.parse(nextRankStr);
                newRankStr = prev.between(next).toString();
            }
        } catch (e) {
            console.error("Rank error", e);
            try {
                const prev = LexoRank.parse(prevRankStr);
                newRankStr = prev.genNext().toString();
            } catch (fallbackErr) {
                newRankStr = LexoRank.middle().toString();
            }
        }

        // Optimistic Update
        const updatedList = { ...list, items: newItems };
        // Update the item rank locally in the optimism
        if (updatedList.items[newIndex].ranks) {
            updatedList.items[newIndex].ranks[0] = { rank: newRankStr };
        } else {
            updatedList.items[newIndex].ranks = [{ rank: newRankStr }];
        }
        setList(updatedList);

        // API Update
        await fetch("/api/ranks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contextId: id,
                updates: [{ itemId: active.id, rank: newRankStr }]
            })
        });
    };

    const toggleItem = async (itemId: string, currentStatus: boolean) => {
        // Optimistic update
        setList(prev => prev ? ({
            ...prev,
            items: prev.items.map(i => i.id === itemId ? { ...i, isChecked: !currentStatus } : i)
        }) : null);

        await fetch(`/api/items/${itemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isChecked: !currentStatus })
        });
    };

    const deleteItem = async (itemId: string) => {
        setList(prev => prev ? ({
            ...prev,
            items: prev.items.filter(i => i.id !== itemId)
        }) : null);

        await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    };

    const addTag = async (itemId: string, tagName: string) => {
        if (!tagName.trim()) return;

        await fetch(`/api/items/${itemId}/tags`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagName })
        });
        fetchList();
    };

    const removeTag = async (itemId: string, tagId: string) => {
        // Optimistic
        setList(prev => prev ? ({
            ...prev,
            items: prev.items.map(i => i.id === itemId ? {
                ...i,
                tags: i.tags.filter(t => t.tag.id !== tagId)
            } : i)
        }) : null);

        await fetch(`/api/items/${itemId}/tags?tagId=${tagId}`, { method: "DELETE" });
    };

    const [tagInputOpen, setTagInputOpen] = useState<string | null>(null);

    const inviteCollaborator = async () => {
        if (!inviteEmail.trim()) return;
        setInviting(true);

        try {
            const res = await fetch(`/api/lists/${id}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, permission: invitePermission })
            });

            if (res.ok) {
                setInviteEmail('');
                fetchList(); // Refresh to show new collaborator
            } else {
                const txt = await res.text();
                alert(`Failed: ${txt}`);
            }
        } catch (e) {
            console.error('Error inviting', e);
        } finally {
            setInviting(false);
        }
    };

    const removeCollaborator = async (userId: string) => {
        try {
            await fetch(`/api/lists/${id}/invite?userId=${userId}`, {
                method: 'DELETE'
            });
            fetchList();
        } catch (e) {
            console.error('Error removing collaborator', e);
        }
    };

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");

    useEffect(() => {
        if (list) setEditTitle(list.title);
    }, [list]);

    const handleTitleSave = async () => {
        if (!editTitle.trim()) return;

        try {
            const res = await fetch(`/api/lists/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: editTitle })
            });
            if (res.ok) {
                setList(prev => prev ? { ...prev, title: editTitle } : null);
                setIsEditingTitle(false);
            }
        } catch (e) {
            console.error("Failed to update title", e);
        }
    };

    const deleteList = async () => {
        if (!confirm("Are you sure you want to delete this list?")) return;
        try {
            const res = await fetch(`/api/lists/${id}`, { method: "DELETE" });
            if (res.ok) router.push("/dashboard");
        } catch (e) {
            console.error(e);
        }
    };

    const isDraggable = !search && sort === "rank";

    const filteredItems = list?.items
        ? list.items
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
                } else {
                    // Rank sort (lexicographical) - Use middle fallback to allow items to be moved above/below unranked items
                    const rankA = a.ranks?.[0]?.rank || "0|h00000:";
                    const rankB = b.ranks?.[0]?.rank || "0|h00000:";
                    return rankA.localeCompare(rankB);
                }
            })
        : [];

    const openSmartList = (clickedTagName: string) => {
        if (!list) return;

        const isSmartList = list.filterTags && list.filterTags.length > 0;

        if (isSmartList) {
            // Drill-down: Combine existing filters with new tag
            const currentTags = list.filterTags.map(ft => ft.tag.name.toLowerCase());
            const clickedLower = clickedTagName.toLowerCase();

            if (!currentTags.includes(clickedLower)) {
                const newTags = [...currentTags, clickedLower];
                router.push(`/smart-lists?tags=${encodeURIComponent(newTags.join(","))}`);
            }
        } else {
            // Regular list: Just open preview for this tag
            router.push(`/smart-lists?tags=${encodeURIComponent(clickedTagName.toLowerCase())}`);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!list) return <div className="p-8">List not found</div>;

    return (
        <>
            <Header
                variant="page"
                title={list.title}
                showBack={true}
                backHref="/dashboard"
            >
                {/* Page-specific actions in header */}
                <div className="flex items-center gap-3 ml-auto">
                    {/* Invite Collaborators Button */}
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded-md transition-colors border-0 shadow-sm font-medium flex items-center gap-2"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM12.75 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                        Invite
                    </button>

                    {/* Blue Share Button */}
                    <ShareButton
                        type="LIST"
                        id={list.id}
                        title={list.title}
                        className="bg-[#2563eb] text-white hover:bg-blue-700 px-4 py-2 rounded-md transition-colors border-0 shadow-sm font-medium flex items-center gap-2"
                    />

                    <button
                        onClick={deleteList}
                        className="p-2 hover:bg-red-50 rounded-md transition-colors text-red-600 border border-transparent hover:border-red-100"
                        title="Delete list"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </Header>
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col relative overflow-hidden">
                {/* Background Effects */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                </div>

                {/* Tag Filters Bar - Green */}
                {list.filterTags && list.filterTags.length > 0 && (
                    <div className="bg-slate-900/50 backdrop-blur-xl border-b border-white/10 relative z-10">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-2 items-center">
                            <span className="text-sm text-gray-400 mr-2">Filters:</span>
                            {list.filterTags.map(({ tag }) => (
                                <span key={tag.id} className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-300 border border-green-500/30 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                    #{tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {/* Main Content */}
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
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
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
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={filteredItems.map(i => i.id)}
                            strategy={viewMode === "grid" ? rectSortingStrategy : undefined}
                            disabled={!isDraggable}
                        >
                            {viewMode === "grid" ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {filteredItems.length === 0 ? (
                                        <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
                                            No items found.
                                        </div>
                                    ) : (
                                        filteredItems.map((item, index) => (
                                            <SortableItem key={item.id} id={item.id}>
                                                {(dragHandleProps) => (
                                                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/20 p-4 flex items-center gap-6 group hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all border border-white/10 hover:border-indigo-500/30 relative h-full">
                                                        {/* Grip */}
                                                        <div className="text-indigo-400 hover:text-indigo-300 cursor-grab active:cursor-grabbing flex-shrink-0 pr-2 border-r border-white/10 h-full flex items-center" {...dragHandleProps}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                        </div>

                                                        {/* Image */}
                                                        <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                            {item.imageUrl ? (
                                                                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/20 relative">
                                                                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center text-gray-500 text-xs border-2 border-white/10 shadow-sm">No Img</div>
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

                                                            {/* Tags */}
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

                                                                <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded border border-[#ef4444] text-[#ef4444] hover:bg-red-50 transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>

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
                                        ))
                                    )}
                                </div>
                            ) : (
                                /* List View (Compact) */
                                <div className="space-y-2">
                                    {filteredItems.map((item, index) => (
                                        <SortableItem key={item.id} id={item.id}>
                                            {(dragHandleProps) => (
                                                <div className="bg-slate-900/50 backdrop-blur-xl rounded-lg shadow-sm border border-white/10 p-3 flex flex-col gap-2 group hover:border-indigo-500/30 transition-all relative">
                                                    <div className="flex items-center gap-3">
                                                        {/* Rank (if draggable) */}
                                                        {isDraggable && (
                                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-500/30 leading-none">
                                                                #{index + 1}
                                                            </div>
                                                        )}

                                                        {/* Drag Handle (if draggable) */}
                                                        {isDraggable && (
                                                            <div className="cursor-grab text-indigo-400 hover:text-indigo-300 px-1 border-r border-white/10 pr-2 flex-shrink-0" {...dragHandleProps}>
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                                </svg>
                                                            </div>
                                                        )}

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
                                                                onClick={() => deleteItem(item.id)}
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
                                                        <div className="flex flex-wrap gap-1.5 pl-0 sm:pl-[calc(1.5rem+12px)]"> {/* Indent to align with title if desired, or keep left */}
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
                                            )}
                                        </SortableItem>
                                    ))}
                                </div>
                            )}
                        </SortableContext>
                    </DndContext>
                </main>
            </div>

            {/* Invite Collaborator Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900">Invite Collaborators</h2>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4">
                            {/* Invite Form */}
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        placeholder="collaborator@example.com"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-900"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setInvitePermission('WRITE')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${invitePermission === 'WRITE'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            Can Edit
                                        </button>
                                        <button
                                            onClick={() => setInvitePermission('READ')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${invitePermission === 'READ'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            View Only
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={inviteCollaborator}
                                    disabled={inviting || !inviteEmail.trim()}
                                    className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                                >
                                    {inviting ? 'Inviting...' : 'Send Invite'}
                                </button>
                            </div>

                            {/* Current Collaborators */}
                            {list.shares && list.shares.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Current Collaborators</h3>
                                    <div className="space-y-2">
                                        {list.shares.map((share) => (
                                            <div key={share.userId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{share.user.email}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {share.permission === 'WRITE' ? 'Can Edit' : 'View Only'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removeCollaborator(share.userId)}
                                                    className="text-red-600 hover:text-red-800 p-1"
                                                    title="Remove collaborator"
                                                >
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
