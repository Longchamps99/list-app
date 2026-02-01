"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ShareButton } from "../../components/ShareButton";

interface Tag {
    id: string;
    name: string;
    color: string;
}

interface ListSummary {
    id: string;
    title: string;
    ownerId: string;
    owner: { email: string; id: string };
}

interface Item {
    id: string;
    title?: string;
    content: string;
    imageUrl?: string;
    link?: string;
    location?: string;
    isChecked: boolean;
    status?: 'EXPERIENCED' | 'WANT_TO_EXPERIENCE' | null;
    tags: { tag: Tag }[];
}

export default function ItemDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const { data: session } = useSession();
    const currentUserId = (session?.user as any)?.id;

    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Edit form state
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editImageUrl, setEditImageUrl] = useState("");
    const [editLink, setEditLink] = useState("");
    const [editLocation, setEditLocation] = useState("");
    const [newTagName, setNewTagName] = useState("");

    // Status and Add to List state
    const [status, setStatus] = useState<'EXPERIENCED' | 'WANT_TO_EXPERIENCE' | null>(null);
    const [showAddToListModal, setShowAddToListModal] = useState(false);
    const [lists, setLists] = useState<ListSummary[]>([]);
    const [addingToList, setAddingToList] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (id) fetchItem();
    }, [id]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [editDescription]);

    const fetchItem = async () => {
        try {
            const res = await fetch(`/api/items/${id}`);
            if (!res.ok) {
                if (res.status === 404) router.push("/dashboard");
                return;
            }
            const data = await res.json();
            setItem(data);

            // Initialize edit form
            setEditTitle(data.title || "");
            setEditDescription(data.content || "");
            setEditImageUrl(data.imageUrl || "");
            setEditLink(data.link || "");
            setEditLocation(data.location || "");
            setStatus(data.status || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLists = async () => {
        try {
            const res = await fetch('/api/lists');
            if (res.ok) {
                const data = await res.json();
                setLists(data);
            }
        } catch (e) {
            console.error('Failed to fetch lists', e);
        }
    };

    const handleStatusChange = async (newStatus: 'EXPERIENCED' | 'WANT_TO_EXPERIENCE') => {
        const updatedStatus = status === newStatus ? null : newStatus;
        setStatus(updatedStatus);

        try {
            await fetch(`/api/items/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: updatedStatus })
            });
        } catch (e) {
            console.error('Failed to update status', e);
        }
    };

    const handleAddToList = async (listId: string) => {
        setAddingToList(true);
        try {
            const res = await fetch(`/api/lists/${listId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: id })
            });

            if (res.ok) {
                const data = await res.json();
                setShowAddToListModal(false);
                // Refresh item to show updated tags
                fetchItem();
            }
        } catch (e) {
            console.error('Failed to add to list', e);
        } finally {
            setAddingToList(false);
        }
    };

    const handleSave = async () => {
        if (!item) return;

        try {
            const res = await fetch(`/api/items/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editTitle,
                    content: editDescription,
                    imageUrl: editImageUrl,
                    link: editLink,
                    location: editLocation,
                }),
            });

            if (res.ok) {
                const updated = await res.json();
                setItem(updated);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Auto-save on blur
    const handleBlur = async () => {
        setSaving(true);
        await handleSave();
        setTimeout(() => setSaving(false), 1000);
    };

    const handleDelete = async () => {
        try {
            const res = await fetch(`/api/items/${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                router.push("/dashboard");
            } else {
                alert("Failed to delete item");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting");
        }
    };

    const addTag = async () => {
        if (!newTagName.trim() || !item) return;

        try {
            const res = await fetch(`/api/items/${id}/tags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tagName: newTagName.trim() })
            });

            if (res.ok) {
                setNewTagName("");
                fetchItem();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const removeTag = async (tagId: string) => {
        try {
            const res = await fetch(`/api/items/${id}/tags/${tagId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                fetchItem();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const openSmartList = (tagName: string) => {
        router.push(`/smart-lists?tags=${encodeURIComponent(tagName)}`);
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!item) return <div className="p-8">Item not found</div>;

    return (
        <div className="min-h-screen p-8" style={{ background: 'var(--color-gray-50)' }}>
            <div className="max-w-4xl mx-auto card overflow-hidden">
                <header className="p-6 border-b flex justify-between items-center">
                    <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800">&larr; Back to Dashboard</Link>
                    <div className="flex gap-2 items-center">
                        {saving && <span className="text-sm text-green-600 font-medium">Saved ✓</span>}
                        <button
                            onClick={() => {
                                fetchLists();
                                setShowAddToListModal(true);
                            }}
                            className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add to List
                        </button>
                        <ShareButton type="ITEM" id={item.id} title={item.title || "Item"} />
                        <button
                            onClick={handleDelete}
                            className="p-2 hover:bg-red-50 rounded-full transition-colors"
                            title="Delete item"
                        >
                            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Display image if URL exists */}
                {editImageUrl && (
                    <div className="w-full h-96 bg-gray-200 relative">
                        <img
                            src={editImageUrl}
                            alt={editTitle || "Item Image"}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                {/* Image URL Input - Below Image */}
                <div className="p-6 bg-gray-50 border-b">
                    <input
                        type="url"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                        value={editImageUrl}
                        onChange={(e) => setEditImageUrl(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="Image URL: https://example.com/image.jpg"
                    />
                </div>

                <div className="p-8 space-y-6">
                    {/* Title - No Label */}
                    <input
                        type="text"
                        className="w-full text-3xl font-bold px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="Untitled Item"
                    />

                    {/* Status Toggle */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-medium">Status:</span>
                        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                            <button
                                onClick={() => handleStatusChange('EXPERIENCED')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${status === 'EXPERIENCED'
                                    ? 'bg-green-600 text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                ✓ Experienced
                            </button>
                            <button
                                onClick={() => handleStatusChange('WANT_TO_EXPERIENCE')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${status === 'WANT_TO_EXPERIENCE'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                ★ Want to Go
                            </button>
                        </div>
                    </div>

                    {/* Tags - Green Pills */}
                    <div>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {item.tags.map(({ tag }) => (
                                <button
                                    key={tag.id}
                                    onClick={() => openSmartList(tag.name)}
                                    className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium hover:bg-green-200 transition-colors cursor-pointer"
                                >
                                    #{tag.name}
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeTag(tag.id);
                                        }}
                                        className="hover:text-green-900 font-bold"
                                    >
                                        ×
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Add tag..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                            />
                            <button onClick={addTag} className="btn-primary">
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Description - No Label, Auto-resize, Full Width */}
                    <textarea
                        ref={textareaRef}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none overflow-hidden"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="Add a description..."
                        style={{ minHeight: '120px' }}
                    />

                    {/* Web Link - Full Width */}
                    <div className="space-y-3">
                        <input
                            type="url"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={editLink}
                            onChange={(e) => setEditLink(e.target.value)}
                            onBlur={handleBlur}
                            placeholder="Web link: https://example.com"
                        />

                        {/* Location - Below Web Link */}
                        <input
                            type="text"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            onBlur={handleBlur}
                            placeholder="Location: New York, NY"
                        />
                    </div>
                </div>
            </div>

            {/* Add to List Modal */}
            {showAddToListModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-bold">Add to List</h2>
                            <button
                                onClick={() => setShowAddToListModal(false)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 max-h-80 overflow-y-auto">
                            {lists.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No lists available</p>
                            ) : (
                                <>
                                    {/* My Lists (Personal) */}
                                    <div className="mb-4">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">My Lists</h3>
                                        <div className="space-y-1">
                                            {lists.filter(l => l.ownerId === currentUserId).length === 0 ? (
                                                <p className="text-sm text-gray-400 italic">No personal lists</p>
                                            ) : (
                                                lists.filter(l => l.ownerId === currentUserId).map(list => (
                                                    <button
                                                        key={list.id}
                                                        onClick={() => handleAddToList(list.id)}
                                                        disabled={addingToList}
                                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                                                    >
                                                        {list.title}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Collaborative Lists (Shared with me where I have write access) */}
                                    {lists.filter(l => l.ownerId !== currentUserId).length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                Collaborative Lists
                                                <svg className="h-3 w-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            </h3>
                                            <div className="space-y-1">
                                                {lists.filter(l => l.ownerId !== currentUserId).map(list => (
                                                    <button
                                                        key={list.id}
                                                        onClick={() => handleAddToList(list.id)}
                                                        disabled={addingToList}
                                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 flex items-center justify-between"
                                                    >
                                                        <span>{list.title}</span>
                                                        <span className="text-[10px] text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded-full">Collab</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
