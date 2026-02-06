"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    Menu,
    Plus,
    Search,
    LayoutGrid,
    List,
    ChevronDown,
    Share2,
    Trash2,
    Pencil,
    Check
} from "lucide-react";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// @ts-ignore
import { LexoRank } from "lexorank";

import { ShareButton } from "../components/ShareButton";
import { Header } from "../components/Header";

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
        position: isDragging ? "relative" as const : "static" as const,
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
    title?: string;
    content: string;
    imageUrl?: string;
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

function SmartListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tagsParam = searchParams.get("tags");

    const [items, setItems] = useState<Item[]>([]);
    const [matchingTags, setMatchingTags] = useState<Tag[]>([]);
    const [requestedTagNames, setRequestedTagNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTagInput, setNewTagInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("rank");
    const [listTitle, setListTitle] = useState("Smart List Preview");
    const [contextId, setContextId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
    );

    useEffect(() => {
        fetchPreview();
        fetchAllTags();
    }, [tagsParam]);

    const fetchAllTags = async () => {
        try {
            const res = await fetch("/api/tags", { cache: "no-store" });
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

        // Parse and store the requested tag names from URL
        const tagNamesFromUrl = tagsParam ? tagsParam.split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [];
        setRequestedTagNames(tagNamesFromUrl);

        try {
            const res = await fetch(`/api/lists/smart/preview?tags=${encodeURIComponent(tagsParam || "")}`, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items);
                setMatchingTags(data.matchingTags);
                setContextId(data.contextId);

                // Initialize title based on tags - prefer matching tags, fallback to requested tags
                if (data.matchingTags.length > 0) {
                    setListTitle(data.matchingTags.map((t: Tag) => t.name).join(" + "));
                } else if (tagNamesFromUrl.length > 0) {
                    setListTitle(tagNamesFromUrl.join(" + "));
                }
            }
        } catch (e) {
            console.error("Failed to fetch smart list preview", e);
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
        if (!over || active.id === over.id || !contextId) return;

        // Ensure we are in a rankable view
        if (sort !== "rank" || search.trim()) return;

        setItems(prevItems => {
            const currentFiltered = prevItems
                .filter(item => {
                    if (!search.trim()) return true;
                    const searchLower = search.toLowerCase();
                    return (
                        (item.title && item.title.toLowerCase().includes(searchLower)) ||
                        item.content.toLowerCase().includes(searchLower)
                    );
                })
                .sort((a, b) => {
                    const rankA = a.ranks?.[0]?.rank || "0|zzzzzz:";
                    const rankB = b.ranks?.[0]?.rank || "0|zzzzzz:";
                    return rankA.localeCompare(rankB);
                });

            const oldVisualIndex = currentFiltered.findIndex((i) => i.id === active.id);
            const newVisualIndex = currentFiltered.findIndex((i) => i.id === over.id);

            if (oldVisualIndex === -1 || newVisualIndex === -1) return prevItems;

            const movedFiltered = arrayMove(currentFiltered, oldVisualIndex, newVisualIndex);

            // Calculate Rank based on new neighbors in the visual list
            const prevItem = movedFiltered[newVisualIndex - 1];
            const nextItem = movedFiltered[newVisualIndex + 1];

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

            // API Update - non-blocking
            fetch("/api/ranks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contextId: contextId,
                    updates: [{ itemId: active.id, rank: newRankStr }]
                })
            });

            // Return new global items with the updated rank
            return prevItems.map(item => {
                if (item.id === active.id) {
                    return {
                        ...item,
                        ranks: [{ rank: newRankStr }]
                    };
                }
                return item;
            });
        });
    }

    const addTagFilter = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagInput.trim()) return;

        const currentTags = tagsParam ? tagsParam.split(",").map(t => t.toLowerCase()) : [];
        const newTag = newTagInput.trim().toLowerCase();

        if (!currentTags.includes(newTag)) {
            const newTags = [...currentTags, newTag];
            router.push(`/smart-lists?tags=${newTags.join(",")}`);
        }
        setNewTagInput("");
    };

    const removeTagFilter = (tagToRemove: string) => {
        const currentTags = tagsParam ? tagsParam.split(",").map(t => t.toLowerCase()) : [];
        const newTags = currentTags.filter(t => t !== tagToRemove.toLowerCase());

        if (newTags.length === 0) {
            router.push("/dashboard");
        } else {
            router.push(`/smart-lists?tags=${newTags.join(",")}`);
        }
    };

    const saveList = async () => {
        // Allow saving if we have matching tags OR requested tag names from URL
        const tagsToSave = matchingTags.length > 0
            ? matchingTags.map(t => t.name)
            : requestedTagNames;

        if (tagsToSave.length === 0) return;

        setSaving(true);
        try {
            const res = await fetch("/api/lists/smart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tagNames: tagsToSave,
                    title: listTitle
                })
            });

            if (res.ok) {
                // Return to dashboard as requested
                router.push("/dashboard");
                router.refresh();
            } else {
                const errorData = await res.json().catch(() => ({}));
                alert(`Failed to save list: ${errorData.message || res.statusText}`);
            }
        } catch (e: any) {
            console.error(e);
            alert(`Error saving list: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };



    const openSmartList = (tagName: string) => {
        const currentTags = tagsParam ? tagsParam.split(",").map(t => t.toLowerCase()) : [];
        const normalizedTagName = tagName.toLowerCase();
        if (!currentTags.includes(normalizedTagName)) {
            const newTags = [...currentTags, normalizedTagName];
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
            // For "rank" - actually compare by rank values
            const rankA = a.ranks?.[0]?.rank || '0|zzzzzz:';
            const rankB = b.ranks?.[0]?.rank || '0|zzzzzz:';
            return rankA.localeCompare(rankB);
        });

    return (
        <>
            <Header
                variant="page"
                showBack={true}
                backHref="/dashboard"
            >
                {/* Page-specific actions in header */}
                <div className="flex items-center gap-3 ml-auto">
                    {(matchingTags.length > 0 || requestedTagNames.length > 0) && (
                        <>
                            <ShareButton
                                type="SMART_LIST"
                                id={contextId || undefined}
                                title={listTitle}
                                tags={tagsParam || undefined}
                                className="px-6 py-2.5 text-white rounded-full transition-all font-semibold text-sm flex items-center gap-2 bg-[#374151] hover:bg-[#4b5563]"
                            />
                            <button
                                onClick={saveList}
                                disabled={saving}
                                className="px-6 py-2.5 text-white rounded-full transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
                                style={{ backgroundColor: '#000000', color: '#ffffff' }}
                            >
                                {saving ? (
                                    "Saving..."
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Save
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </Header>
            <div className="min-h-screen bg-white flex flex-col">
                {/* Large Title Header */}
                <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
                    <div className="flex flex-col gap-2 items-start">
                        <div className="flex items-center gap-2 flex-wrap text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif' }}>
                            <span style={{ color: '#9CA3AF', whiteSpace: 'nowrap' }}>Smart List Preview:&nbsp;</span>
                            <div className="flex items-center">
                                <input
                                    type="text"
                                    value={listTitle}
                                    onChange={(e) => setListTitle(e.target.value)}
                                    className="bg-transparent border-0 p-0 focus:ring-0 text-black placeholder-gray-300 font-bold text-inherit tracking-tight"
                                    style={{
                                        width: `${Math.max(listTitle.length || 1, 1) + 1}ch`,
                                        minWidth: '100px',
                                        fontSize: 'inherit',
                                        lineHeight: 'inherit'
                                    }}
                                />
                                <Pencil className="h-8 w-8 text-gray-300 ml-2" aria-hidden="true" />
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            Changes auto-saved to local session
                        </div>
                    </div>
                </div>


                {/* Content */}
                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
                    {/* Controls Bar */}
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--swiss-border)] pb-6">
                        {/* Left: Filters */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-sm font-bold uppercase tracking-wider text-[var(--swiss-text-muted)] mr-2">Filters:</span>
                            {matchingTags.map(tag => (
                                <span key={tag.id} className="bg-[var(--swiss-green-light)] text-[var(--swiss-green)] border border-[var(--swiss-green)]/30 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                    #{tag.name}
                                    <button
                                        onClick={() => removeTagFilter(tag.name)}
                                        className="hover:opacity-60 font-bold ml-1 w-4 h-4 flex items-center justify-center"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}

                            <form onSubmit={addTagFilter} className="relative">
                                <div className="flex items-center">
                                    <input
                                        type="text"
                                        placeholder="Add filter..."
                                        className="text-sm rounded-l-md bg-white border-[var(--swiss-border)] focus:border-[var(--swiss-black)] focus:ring-0 p-1.5 border w-32 text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)]"
                                        value={newTagInput}
                                        onChange={(e) => setNewTagInput(e.target.value)}
                                        onFocus={() => setShowDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                                    />
                                    <button
                                        type="submit"
                                        className="bg-[var(--swiss-black)] text-white px-3 py-1.5 rounded-r-md hover:bg-gray-800 text-sm border border-l-0 border-[var(--swiss-border)]"
                                    >
                                        +
                                    </button>
                                </div>

                                {showDropdown && (
                                    <div className="absolute top-full left-0 mt-1 w-48 max-h-48 overflow-y-auto bg-white border border-[var(--swiss-border)] rounded-md shadow-lg z-50">
                                        {allTags
                                            .filter(tag => {
                                                const currentTags = tagsParam ? tagsParam.split(",") : [];
                                                if (currentTags.includes(tag.name)) return false;
                                                if (newTagInput.trim()) return tag.name.toLowerCase().includes(newTagInput.toLowerCase());
                                                return true;
                                            })
                                            .map(tag => (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 text-sm text-[var(--swiss-text)] hover:bg-[var(--swiss-off-white)] transition"
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
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Right: View and Sort Controls */}
                        <div className="flex items-center gap-3">
                            {/* Add New Item Button */}
                            <Link
                                href={`/items/new?source=smart-list&tags=${encodeURIComponent(tagsParam || "")}`}
                                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--swiss-black)] !text-white rounded-lg hover:bg-[var(--swiss-accent-hover)] transition-all font-bold text-sm"
                            >
                                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-white hidden sm:inline">Add New Item</span>
                            </Link>

                            {/* View and Sort Controls - Grouped */}
                            <div className="flex items-center gap-3 border border-[var(--swiss-border)] rounded-lg p-1 bg-white">
                                {/* View Toggle */}
                                <div className="flex items-center gap-1 border-r border-[var(--swiss-border)] pr-3">
                                    <button
                                        onClick={() => setViewMode("grid")}
                                        className={`p-2 rounded transition-colors ${viewMode === "grid" ? "bg-[var(--swiss-black)] text-white" : "text-[var(--swiss-text-muted)] hover:bg-[var(--swiss-off-white)] hover:text-[var(--swiss-black)]"}`}
                                        title="Grid view"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-[var(--swiss-black)] text-white" : "text-[var(--swiss-text-muted)] hover:bg-[var(--swiss-off-white)] hover:text-[var(--swiss-black)]"}`}
                                        title="List view"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Sort Dropdown */}
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-[var(--swiss-text-muted)] font-medium">Sort:</span>
                                    <select
                                        className="border-0 focus:ring-0 text-sm font-medium text-[var(--swiss-black)] bg-transparent cursor-pointer pr-8"
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
                        <div className="text-center py-12 text-[var(--swiss-text-muted)]">Loading preview...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-[var(--swiss-text-muted)] bg-[var(--swiss-off-white)] rounded-lg p-8 border border-[var(--swiss-border)]">
                            <p className="text-lg mb-2">No items found.</p>
                            <p className="text-sm">Try using different search terms or filters.</p>
                        </div>
                    ) : viewMode === "grid" ? (
                        /* Grid View with Drag and Drop */
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext items={filteredItems.map(i => i.id)} strategy={rectSortingStrategy} disabled={sort !== "rank" || !!search.trim()}>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {filteredItems.map((item, index) => (
                                        <SortableItem key={item.id} id={item.id}>
                                            {(dragProps: any) => (
                                                <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-3 md:p-4 flex items-start gap-3 md:gap-6 group hover:border-[var(--swiss-black)] transition-all h-full">
                                                    {/* Rank & Grip Column */}
                                                    <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-0.5">
                                                        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-[var(--swiss-black)] text-white shadow-sm">
                                                            <span className="text-base font-bold">{String(index + 1).padStart(2, '0')}</span>
                                                        </div>
                                                        <div
                                                            {...dragProps}
                                                            className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-[var(--swiss-off-white)] text-[var(--swiss-text-muted)] hover:text-[var(--swiss-text)]"
                                                            title="Drag to reorder"
                                                        >
                                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                            </svg>
                                                        </div>
                                                    </div>

                                                    {/* Image */}
                                                    <Link href={`/items/${item.id}`} className="flex-shrink-0">
                                                        {item.imageUrl ? (
                                                            <div className="w-16 h-16 md:w-24 md:h-24 rounded-lg overflow-hidden border border-[var(--swiss-border)] relative">
                                                                <img
                                                                    src={item.imageUrl}
                                                                    alt={item.title || "Item"}
                                                                    className="w-full h-full object-cover"
                                                                    referrerPolicy="no-referrer"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-16 h-16 md:w-24 md:h-24 rounded-lg bg-[var(--swiss-off-white)] flex items-center justify-center text-[var(--swiss-text-muted)] text-xs border border-[var(--swiss-border)]">
                                                                No Img
                                                            </div>
                                                        )}
                                                    </Link>

                                                    {/* Content */}
                                                    <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
                                                        <div className="flex items-center gap-3">
                                                            <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                                <h3 className="font-bold text-xl text-[var(--swiss-black)] hover:text-[var(--swiss-text-secondary)] transition truncate">
                                                                    {item.title || "Untitled"}
                                                                </h3>
                                                            </Link>
                                                        </div>

                                                        <p className="text-[var(--swiss-text-secondary)] text-sm line-clamp-1">{item.content}</p>

                                                        {item.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                {item.tags.slice(0, 4).map(({ tag }) => (
                                                                    <button
                                                                        key={tag.id}
                                                                        onClick={() => openSmartList(tag.name)}
                                                                        className="inline-block px-3 py-1 bg-[var(--swiss-green-light)] text-[var(--swiss-green)] border border-[var(--swiss-green)]/30 rounded-full text-xs font-medium hover:bg-[var(--swiss-green)]/10 hover:border-[var(--swiss-green)] transition-all cursor-pointer"
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
                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                            <ShareButton
                                                                type="ITEM"
                                                                id={item.id}
                                                                title={item.title || "Item"}
                                                                className="bg-[var(--swiss-black)] text-white hover:bg-[var(--swiss-accent-hover)] px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors border-0"
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
                                                                className="p-1.5 rounded border border-[var(--swiss-red)] text-[var(--swiss-red)] hover:bg-[var(--swiss-red-light)] transition-colors"
                                                                title="Delete item"
                                                            >
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>

                                                            <span className="hidden sm:inline text-xs text-[var(--swiss-text-muted)]">{new Date(item.createdAt).toLocaleDateString()}</span>

                                                            {item.shares?.length > 0 && (
                                                                <div className="ml-auto text-[var(--swiss-text-secondary)] font-medium text-sm flex items-center gap-1">
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
                            </SortableContext>
                        </DndContext>
                    ) : (
                        /* List View with Drag and Drop */
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext items={filteredItems.map(i => i.id)} strategy={rectSortingStrategy} disabled={sort !== "rank" || !!search.trim()}>
                                <div className="space-y-2">
                                    {filteredItems.map((item, index) => (
                                        <SortableItem key={item.id} id={item.id}>
                                            {(dragProps: any) => (
                                                <div className="bg-white border border-[var(--swiss-border)] rounded-lg p-3 flex flex-col gap-2 group hover:border-[var(--swiss-black)] transition-all relative">
                                                    <div className="flex items-center gap-3">
                                                        {/* Rank & Grip Column */}
                                                        <div className="flex flex-col items-center gap-1 pr-3 border-r border-[var(--swiss-border)] flex-shrink-0">
                                                            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[var(--swiss-black)] text-white">
                                                                <span className="text-sm font-bold">{String(index + 1).padStart(2, '0')}</span>
                                                            </div>
                                                            <div
                                                                {...dragProps}
                                                                className="cursor-grab text-[var(--swiss-text-muted)] hover:text-[var(--swiss-text)] px-1"
                                                                title="Drag to reorder"
                                                            >
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                                </svg>
                                                            </div>
                                                        </div>

                                                        {/* Title */}
                                                        <Link href={`/items/${item.id}`} className="truncate flex-1 min-w-0">
                                                            <h3 className="font-bold text-[var(--swiss-black)] hover:text-[var(--swiss-text-secondary)] transition truncate text-sm">
                                                                {item.title || "Untitled"}
                                                            </h3>
                                                        </Link>

                                                        {/* Actions & Metadata */}
                                                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                                                            <span className="text-xs text-[var(--swiss-text-muted)] whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</span>

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
                                                                className="bg-[var(--swiss-black)] text-white hover:bg-[var(--swiss-accent-hover)] px-3 py-1 rounded-full text-xs font-medium transition-colors border-0"
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
                                                                className="p-1 rounded border border-[var(--swiss-red)] text-[var(--swiss-red)] hover:bg-[var(--swiss-red-light)] transition-colors"
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
                                                                    className="inline-block px-2 py-0.5 bg-[var(--swiss-green-light)] text-[var(--swiss-green)] border border-[var(--swiss-green)]/30 rounded-full text-[10px] font-medium hover:bg-[var(--swiss-green)]/10 hover:border-[var(--swiss-green)] transition-all cursor-pointer"
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
                            </SortableContext>
                        </DndContext>
                    )}

                    {/* Sticky Footer Save Button for better visibility */}
                    {(matchingTags.length > 0 || requestedTagNames.length > 0) && (
                        <div className="sticky bottom-6 mt-8 z-20">
                            <button
                                onClick={saveList}
                                disabled={saving}
                                className="w-full py-4 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 hover:-translate-y-1 active:translate-y-0"
                                style={{ backgroundColor: '#000000', color: '#ffffff' }}
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
                                        Saving List...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-6 w-6" />
                                        Save This Smart List
                                    </>
                                )}
                            </button>
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
