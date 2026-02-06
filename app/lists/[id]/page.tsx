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
    verticalListSortingStrategy,
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

        // IMPORTANT: Use filteredItems since that's what SortableContext renders
        // This ensures indices match the visual order
        const oldIndex = filteredItems.findIndex((i) => i.id === active.id);
        const newIndex = filteredItems.findIndex((i) => i.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        const reorderedItems = arrayMove(filteredItems, oldIndex, newIndex);

        // Calculate Rank based on neighbors in the reordered array
        const prevItem = reorderedItems[newIndex - 1];
        const nextItem = reorderedItems[newIndex + 1];

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

        // Optimistic Update - update the ranks on the moved item in list.items
        const movedItem = list.items.find(i => i.id === active.id);
        if (movedItem) {
            if (movedItem.ranks && movedItem.ranks.length > 0) {
                movedItem.ranks[0] = { rank: newRankStr };
            } else {
                movedItem.ranks = [{ rank: newRankStr }];
            }
        }
        // Trigger re-render with updated ranks
        setList({ ...list, items: [...list.items] });

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

    const deleteList = () => {
        if (!list) return;
        // Navigate to dashboard with delete params - dashboard handles the toast and delayed delete
        router.push(`/dashboard?deleteList=${id}&listTitle=${encodeURIComponent(list.title)}`);
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

    if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-[var(--swiss-text-secondary)]">Loading...</div></div>;
    if (!list) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-[var(--swiss-text-secondary)]">List not found</div></div>;

    return (
        <>
            <Header
                variant="page"
                title={list.title}
                showBack={true}
                backHref="/dashboard"
            >
                {/* Page-specific actions in header */}
                <div className="flex items-center gap-2 md:gap-3 ml-auto min-w-0">
                    {/* Invite Collaborators Button - Secondary style */}
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 px-3 md:px-5 py-2 bg-white text-[var(--swiss-text-secondary)] border border-[var(--swiss-border)] rounded-full hover:bg-[var(--swiss-off-white)] hover:text-[var(--swiss-black)] hover:border-[var(--swiss-text-muted)] active:bg-[var(--swiss-cream)] transition-all font-medium text-sm flex-shrink-1 min-w-0 truncate"
                        title="Invite"
                    >
                        <svg className="h-4 w-4 stroke-current flex-shrink-0" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM12.75 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                        <span className="hidden md:inline">Invite</span>
                    </button>

                    {/* Share Button - Secondary style */}
                    <div className="flex-shrink-1 min-w-0">
                        <ShareButton
                            type="LIST"
                            id={list.id}
                            title={list.title}
                            className="flex items-center gap-2 px-3 md:px-5 py-2 bg-white text-[var(--swiss-text-secondary)] border border-[var(--swiss-border)] rounded-full hover:bg-[var(--swiss-off-white)] hover:text-[var(--swiss-black)] hover:border-[var(--swiss-text-muted)] active:bg-[var(--swiss-cream)] transition-all font-medium text-sm w-full justify-center"
                        >
                            <span className="hidden md:inline pl-1">Share</span>
                        </ShareButton>
                    </div>

                    <button
                        onClick={deleteList}
                        className="p-2 hover:bg-red-50 rounded-md transition-colors text-red-600 border border-transparent hover:border-red-100 flex-shrink-0"
                        title="Delete list"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </Header>
            <div className="min-h-screen bg-white flex flex-col">

                {/* Tag Filters Bar - Green */}
                {list.filterTags && list.filterTags.length > 0 && (
                    <div className="bg-[var(--swiss-off-white)] border-b border-[var(--swiss-border)]">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-2 items-center">
                            <span className="text-sm text-[var(--swiss-text-muted)] mr-2">Filters:</span>
                            {list.filterTags.map(({ tag }) => (
                                <span key={tag.id} className="px-3 py-1 bg-[var(--swiss-off-white)] text-[var(--swiss-text)] border border-[var(--swiss-border)] rounded-full text-sm font-medium">
                                    #{tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {/* Main Content */}
                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
                    {/* Controls Bar */}
                    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
                        {/* Search Bar */}
                        <div className="flex-1 w-full md:max-w-2xl relative md:mr-6">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-[var(--swiss-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    className="w-full pl-10 pr-20 py-2.5 bg-white border border-[var(--swiss-border)] rounded-full focus:border-[var(--swiss-black)] focus:outline-none transition-all text-sm text-[var(--swiss-text)] placeholder-[var(--swiss-text-muted)]"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                                    <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-[var(--swiss-text-muted)] bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] rounded">
                                        ⌘K
                                    </kbd>
                                </div>
                            </div>
                        </div>

                        {/* View and Sort Controls */}
                        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                            {/* Add New Item Button */}
                            <Link
                                href="/items/new"
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--swiss-black)] rounded-full hover:bg-[var(--swiss-accent-hover)] transition-all font-medium text-sm whitespace-nowrap"
                            >
                                <svg className="h-4 w-4 stroke-white" fill="none" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-white">New Item</span>
                            </Link>

                            <div className="flex items-center gap-3 border border-[var(--swiss-border)] rounded-full px-2 py-1 bg-white">
                                {/* View Toggle */}
                                <div className="flex items-center gap-1 border-r border-[var(--swiss-border)] pr-3">
                                    <button
                                        onClick={() => setViewMode("grid")}
                                        className={`p-1.5 rounded-full transition-colors ${viewMode === "grid" ? "bg-[var(--swiss-black)] text-white" : "text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)]"}`}
                                        title="Grid view"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className={`p-1.5 rounded-full transition-colors ${viewMode === "list" ? "bg-[var(--swiss-black)] text-white" : "text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)]"}`}
                                        title="List view"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Sort Dropdown */}
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-[var(--swiss-text-muted)] font-medium hidden xs:inline">Sort:</span>
                                    <select
                                        className="border-0 focus:ring-0 text-sm font-medium text-[var(--swiss-text)] bg-transparent cursor-pointer pr-6 max-w-[80px] sm:max-w-none"
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
                            strategy={viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
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
                                                    <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-5 flex items-start gap-5 group hover:border-[var(--swiss-text-muted)] transition-all h-full">
                                                        {/* Rank & Grip Column */}
                                                        {isDraggable && (
                                                            <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-0.5">
                                                                <div className="w-10 h-10 rounded-md flex items-center justify-center bg-[var(--swiss-black)] text-white shadow-sm">
                                                                    <span className="text-base font-bold">{String(index + 1).padStart(2, '0')}</span>
                                                                </div>
                                                                <div className="text-[var(--swiss-text-muted)] hover:text-[var(--swiss-text)] cursor-grab active:cursor-grabbing p-1" {...dragHandleProps}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Image */}
                                                        <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                            {item.imageUrl ? (
                                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden">
                                                                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-[var(--swiss-off-white)] flex items-center justify-center text-[var(--swiss-text-muted)] text-xs">No Img</div>
                                                            )}
                                                        </Link>

                                                        {/* Content */}
                                                        <div className="flex-1 flex flex-col gap-1.5 min-w-0 overflow-hidden">
                                                            <div className="flex items-center gap-2">
                                                                <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                                    <h3 className="font-semibold text-lg text-[var(--swiss-black)] hover:text-[var(--swiss-text-secondary)] transition truncate">
                                                                        {item.title || "Untitled"}
                                                                    </h3>
                                                                </Link>
                                                            </div>

                                                            <p className="text-[var(--swiss-text-secondary)] text-sm line-clamp-1">{item.content}</p>

                                                            {/* Tags */}
                                                            {item.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                                    {item.tags.slice(0, 4).map(({ tag }) => (
                                                                        <button
                                                                            key={tag.id}
                                                                            onClick={() => openSmartList(tag.name)}
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

                                                            {/* Footer Actions */}
                                                            <div className="flex items-center gap-3 mt-2">
                                                                <ShareButton
                                                                    type="ITEM"
                                                                    id={item.id}
                                                                    title={item.title || "Item"}
                                                                    className="bg-[var(--swiss-black)] text-white hover:bg-[var(--swiss-accent-hover)] px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors border-0"
                                                                />

                                                                <button onClick={() => deleteItem(item.id)} className="p-1 rounded text-[var(--swiss-text-muted)] hover:text-[var(--swiss-red)] transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>

                                                                <span className="hidden sm:inline text-xs text-[var(--swiss-text-muted)]">{new Date(item.createdAt).toLocaleDateString()}</span>

                                                                {item.shares?.length > 0 && (
                                                                    <div className="ml-auto text-[var(--swiss-text-secondary)] font-medium text-xs flex items-center gap-1">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
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
                                                <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-3 flex flex-col gap-2 group hover:border-[var(--swiss-text-muted)] transition-all">
                                                    <div className="flex items-center gap-3">
                                                        {/* Rank & Grip Column */}
                                                        {isDraggable && (
                                                            <div className="flex flex-col items-center gap-1 pr-3 border-r border-[var(--swiss-border)] flex-shrink-0">
                                                                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[var(--swiss-black)] text-white">
                                                                    <span className="text-sm font-bold">{String(index + 1).padStart(2, '0')}</span>
                                                                </div>
                                                                <div className="cursor-grab text-[var(--swiss-text-muted)] hover:text-[var(--swiss-text)] px-1" {...dragHandleProps}>
                                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Title */}
                                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                            <h3 className="font-medium text-[var(--swiss-black)] hover:text-[var(--swiss-text-secondary)] transition truncate text-sm">
                                                                {item.title || "Untitled"}
                                                            </h3>
                                                        </Link>

                                                        {/* Actions & Metadata */}
                                                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                                                            <span className="hidden sm:inline text-xs text-[var(--swiss-text-muted)] whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</span>

                                                            {item.shares?.length > 0 && (
                                                                <div className="text-[var(--swiss-text-secondary)] font-medium text-xs flex items-center gap-1" title="Shared">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            )}

                                                            <ShareButton
                                                                type="ITEM"
                                                                id={item.id}
                                                                title={item.title || "Item"}
                                                                className="bg-[var(--swiss-black)] text-white hover:bg-[var(--swiss-accent-hover)] px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border-0"
                                                            />

                                                            <button
                                                                onClick={() => deleteItem(item.id)}
                                                                className="p-1 rounded text-[var(--swiss-text-muted)] hover:text-[var(--swiss-red)] transition-colors"
                                                                title="Delete item"
                                                            >
                                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Bottom Row: Tags (if any) */}
                                                    {item.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pl-0 sm:pl-6">
                                                            {item.tags.slice(0, 4).map(({ tag }) => (
                                                                <button
                                                                    key={tag.id}
                                                                    onClick={() => openSmartList(tag.name)}
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
                                    <label className="block text-sm font-bold text-gray-900 mb-2">Permission Level</label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setInvitePermission('WRITE')}
                                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-2 ${invitePermission === 'WRITE'
                                                ? 'bg-[#191919] text-white border-[#191919] shadow-md transform scale-[1.02]'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                                                }`}
                                            style={{
                                                backgroundColor: invitePermission === 'WRITE' ? '#191919' : '#ffffff',
                                                color: invitePermission === 'WRITE' ? '#ffffff' : '#4b5563',
                                                borderColor: invitePermission === 'WRITE' ? '#191919' : '#e5e7eb'
                                            }}
                                        >
                                            {invitePermission === 'WRITE' && (
                                                <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                            Can Edit
                                        </button>
                                        <button
                                            onClick={() => setInvitePermission('READ')}
                                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-2 ${invitePermission === 'READ'
                                                ? 'bg-[#191919] text-white border-[#191919] shadow-md transform scale-[1.02]'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                                                }`}
                                            style={{
                                                backgroundColor: invitePermission === 'READ' ? '#191919' : '#ffffff',
                                                color: invitePermission === 'READ' ? '#ffffff' : '#4b5563',
                                                borderColor: invitePermission === 'READ' ? '#191919' : '#e5e7eb'
                                            }}
                                        >
                                            {invitePermission === 'READ' && (
                                                <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                            View Only
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={inviteCollaborator}
                                    disabled={inviting || !inviteEmail.trim()}
                                    className="w-full py-3 bg-[#191919] text-white rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    style={{ backgroundColor: '#191919', color: 'white' }}
                                >
                                    {inviting ? (
                                        <>
                                            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                                            Inviting...
                                        </>
                                    ) : (
                                        'Send Invite'
                                    )}
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
