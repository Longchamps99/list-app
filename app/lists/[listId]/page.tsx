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
}

export default function ListPage() {
    const params = useParams();
    const listId = params?.listId as string;

    const [list, setList] = useState<List | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const router = useRouter();

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
    );

    useEffect(() => {
        if (listId) fetchList();
    }, [listId]);

    const fetchList = async () => {
        try {
            const res = await fetch(`/api/lists/${listId}`);
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
                contextId: listId,
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

    const shareList = async () => {
        const email = prompt("Enter email to share with:");
        if (!email) return;

        try {
            const res = await fetch(`/api/lists/${listId}/share`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                alert(`Shared with ${email}`);
            } else {
                const txt = await res.text();
                alert(`Failed: ${txt}`);
            }
        } catch (e) {
            alert("Error sharing");
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
            const res = await fetch(`/api/lists/${listId}`, {
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
        if (!confirm("Are you sure you want to delete this list? This cannot be undone.")) return;

        try {
            const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
            if (res.ok) {
                router.push("/dashboard");
            } else {
                alert("Failed to delete list");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting list");
        }
    };

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
            router.push(`/smart-lists?tags=${encodeURIComponent(clickedTagName)}`);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!list) return <div className="p-8">List not found</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header - Sticky */}
            <header className="bg-white border-b sticky top-0 z-10 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                            &larr; Back
                        </Link>

                        <div className="flex items-center gap-2">
                            {isEditingTitle ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="text-xl font-bold text-gray-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent"
                                        autoFocus
                                    />
                                    <button onClick={handleTitleSave} className="text-green-600 hover:text-green-800">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                    <button onClick={() => setIsEditingTitle(false)} className="text-gray-400 hover:text-gray-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <h1 className="text-xl font-bold flex items-center gap-2 group">
                                    <span className="text-indigo-600">#</span> {list.title}
                                    <button onClick={() => setIsEditingTitle(true)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                </h1>
                            )}
                        </div>
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
                </div>

                {/* Tag Filters Bar - Green */}
                {list.filterTags && list.filterTags.length > 0 && (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-t bg-gray-50 flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-gray-500 mr-2">Filters:</span>
                        {list.filterTags.map(({ tag }) => (
                            <span key={tag.id} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                #{tag.name}
                            </span>
                        ))}
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={list.items.map(i => i.id)} strategy={rectSortingStrategy}>
                        {viewMode === "grid" ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {list.items.length === 0 ? (
                                    <p className="col-span-full p-6 text-gray-500 text-center bg-white rounded-lg shadow">No items yet. Add one!</p>
                                ) : (
                                    list.items.map((item, index) => (
                                        <SortableItem key={item.id} id={item.id}>
                                            {(dragHandleProps) => (
                                                <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-6 group hover:shadow-lg transition-shadow border border-gray-100 relative h-full">
                                                    {/* Grip */}
                                                    <div className="text-[#a5b4fc] hover:text-[#818cf8] cursor-grab active:cursor-grabbing flex-shrink-0 pr-2 border-r border-gray-100 h-full flex items-center" {...dragHandleProps}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                    </div>

                                                    {/* Image */}
                                                    <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                        {item.imageUrl ? (
                                                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm relative">
                                                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-2 border-gray-100 shadow-sm">No Img</div>
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

                                                        {/* Tags */}
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
                            /* List View (Same Card) */
                            <div className="space-y-2">
                                {list.items.map((item, index) => (
                                    <SortableItem key={item.id} id={item.id}>
                                        {(dragHandleProps) => (
                                            <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-6 group hover:shadow-lg transition-shadow border border-gray-100 relative">
                                                {/* Grip */}
                                                <div className="text-[#a5b4fc] hover:text-[#818cf8] cursor-grab active:cursor-grabbing flex-shrink-0 pr-2 border-r border-gray-100 h-full flex items-center" {...dragHandleProps}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                </div>

                                                {/* Image */}
                                                <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                    {item.imageUrl ? (
                                                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm relative">
                                                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-2 border-gray-100 shadow-sm">No Img</div>
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

                                                    {/* Tags */}
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
                                ))}
                            </div>
                        )}
                    </SortableContext>
                </DndContext>
            </main>
        </div>
    );
}
