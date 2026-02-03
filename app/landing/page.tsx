"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, ChevronRight, Star, GripVertical, Heart, MessageCircle, Shuffle } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePostHog } from "posthog-js/react";
import { useSession } from "next-auth/react";

// --- Sortable Item Component (Dashboard Tile Style) ---
function SortableMovieItem({
    id,
    index,
    value,
    focused,
    onChange,
    onFocus,
    onBlur
}: {
    id: string;
    index: number;
    value: string;
    focused: boolean;
    onChange: (val: string) => void;
    onFocus: () => void;
    onBlur: () => void;
}) {
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
        zIndex: isDragging ? 50 : "auto",
        position: isDragging ? "relative" as const : "static" as const,
    };

    return (
        <div ref={setNodeRef} style={style} className="group">
            <div className={`flex items-center gap-4 bg-white border border-[var(--swiss-border)] rounded-lg p-3 transition-all ${isDragging ? 'shadow-xl border-[var(--swiss-black)] scale-[1.02]' : 'hover:border-[var(--swiss-text-muted)]'}`}>
                {/* Rank Number - Large and Prominent */}
                <div
                    {...attributes}
                    {...listeners}
                    className="flex-shrink-0 w-12 h-12 bg-[var(--swiss-black)] text-white flex items-center justify-center cursor-grab active:cursor-grabbing rounded-md"
                >
                    <span className="text-xl font-bold">{String(index + 1).padStart(2, '0')}</span>
                </div>

                {/* Thumbnail Placeholder */}
                <div className="w-12 h-12 bg-[var(--swiss-off-white)] rounded flex-shrink-0 flex items-center justify-center">
                    {value ? (
                        <span className="text-xs text-[var(--swiss-text-muted)]">🎬</span>
                    ) : (
                        <span className="text-[10px] text-[var(--swiss-text-muted)]">IMG</span>
                    )}
                </div>

                {/* Input */}
                <div className="flex-1 min-w-0">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        placeholder={`Movie #${index + 1}...`}
                        className="w-full bg-transparent border-0 ring-0 p-0 text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)] focus:outline-none focus:ring-0 text-base font-semibold"
                    />
                    <p className="text-xs text-[var(--swiss-text-muted)] truncate mt-0.5">
                        {value ? "Tap to edit • Drag to reorder" : "Type to add..."}
                    </p>
                </div>

                {/* Tag Placeholder */}
                {value && (
                    <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 bg-[var(--swiss-green-light)] text-[var(--swiss-green)] rounded-full border border-[var(--swiss-green)]/30 font-medium">
                        #movie
                    </span>
                )}
            </div>
        </div>
    );
}

// --- Example List Card Component ---
function ExampleListCard({
    title,
    items,
    likes,
    comments
}: {
    title: string;
    items: string[];
    likes?: number;
    comments?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white border border-[var(--swiss-border)] rounded-xl p-6 hover:border-[var(--swiss-black)] transition-all"
        >
            <h4 className="text-lg font-bold mb-4 text-[var(--swiss-black)]">{title}</h4>
            <div className="space-y-2 mb-4">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[var(--swiss-text-muted)] w-6">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-sm font-medium text-[var(--swiss-black)]">{item}</span>
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-4 pt-3 border-t border-[var(--swiss-border)]">
                {likes !== undefined && (
                    <button className="flex items-center gap-1 text-xs text-[var(--swiss-text-muted)] hover:text-[var(--swiss-red)] transition-colors">
                        <Heart className="h-3.5 w-3.5" />
                        <span>{likes}</span>
                    </button>
                )}
                {comments !== undefined && (
                    <button className="flex items-center gap-1 text-xs text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] transition-colors">
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>{comments}</span>
                    </button>
                )}
                <button className="flex items-center gap-1 text-xs text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] transition-colors ml-auto">
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>Re-Rank</span>
                </button>
            </div>
        </motion.div>
    );
}

export default function LandingPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const posthog = usePostHog();
    const [movies, setMovies] = useState<{ id: string; value: string }[]>(
        Array(5).fill(null).map((_, i) => ({ id: `item-${i}`, value: "" }))
    );
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sensors for DnD
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Load/Save Logic
    useEffect(() => {
        const saved = localStorage.getItem("tempTop5");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    if (typeof parsed[0] === 'string') {
                        setMovies(parsed.map((v: string, i: number) => ({ id: `saved-${i}`, value: v })));
                    } else {
                        setMovies(parsed);
                    }
                }
            } catch (e) {
                console.error("Failed to parse", e);
            }
        } else {
            // Pre-fill with examples
            setMovies([
                { id: 'item-0', value: 'The Godfather' },
                { id: 'item-1', value: 'Pulp Fiction' },
                { id: 'item-2', value: '' },
                { id: 'item-3', value: '' },
                { id: 'item-4', value: '' },
            ]);
        }
    }, []);

    useEffect(() => {
        const simpleList = movies.map(m => m.value);
        localStorage.setItem("tempTop5", JSON.stringify(simpleList));
    }, [movies]);

    // Handlers
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setMovies((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleChange = (id: string, newValue: string) => {
        setMovies(items => items.map(item =>
            item.id === id ? { ...item, value: newValue } : item
        ));
    };

    const handleSaveAndRegister = () => {
        posthog.capture("landing_page_conversion_clicked", {
            movie_count: movies.filter(m => m.value.trim() !== "").length
        });

        const simpleList = movies.map(m => m.value);
        localStorage.setItem("tempTop5", JSON.stringify(simpleList));

        if (session) {
            router.push("/dashboard");
        } else {
            router.push("/register");
        }
    };

    return (
        <div className="min-h-screen bg-white text-[var(--swiss-black)] overflow-x-hidden flex flex-col">
            {/* Navigation */}
            <nav className="relative z-10 border-b border-[var(--swiss-border)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-2">
                            <img
                                src="https://lh3.googleusercontent.com/P68YSdtz6nrkq0jDrxhsyWrFc4awbJnZUArw4n8A0SjPrmk_1mL033AuAynVSIOVUtf_"
                                alt="Vaulted Logo"
                                className="h-8 w-8 object-contain rounded-md"
                            />
                            <span className="text-2xl font-bold text-[var(--swiss-black)]" style={{ letterSpacing: '-0.03em' }}>
                                Vaulted
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link
                                href="/login"
                                className="px-4 py-2 text-sm font-medium text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] transition-colors"
                            >
                                Log In
                            </Link>
                            <Link
                                href="/register"
                                className="px-6 py-2 rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5"
                                style={{ backgroundColor: '#000000', color: '#ffffff' }}
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* SECTION 01 — HERO */}
            <section className="relative z-10 py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-[var(--swiss-border)]">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
                        {/* Left Column - Copy */}
                        <div>
                            <h1
                                className="font-bold leading-[0.6] mb-8"
                                style={{
                                    fontSize: 'clamp(5rem, 10vw, 20rem)',
                                    letterSpacing: '-0.06em',
                                    textIndent: '-0.02em'
                                }}
                            >
                                Your Taste.<br />
                                <span className="text-[var(--swiss-text-muted)]">Cataloged.</span>
                            </h1>
                            <p className="text-xl lg:text-3xl text-[var(--swiss-text-secondary)] mb-10 leading-relaxed max-w-2xl" style={{ letterSpacing: '-0.01em' }}>
                                The definitive platform to create, share, and discover personalized ranked lists. From obscure cinema to Michelin cuisine.
                            </p>

                            <ul className="space-y-3 mb-10 text-[var(--swiss-text-secondary)]">
                                <li className="flex items-start gap-3">
                                    <span className="text-[var(--swiss-green)] font-bold">→</span>
                                    <span>Build definitive top 10s for any category.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-[var(--swiss-green)] font-bold">→</span>
                                    <span>Compare taste profiles with friends.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-[var(--swiss-green)] font-bold">→</span>
                                    <span>Export your lists as beautiful image assets.</span>
                                </li>
                            </ul>

                            <button
                                onClick={handleSaveAndRegister}
                                className="group px-8 py-4 bg-[var(--swiss-black)] hover:bg-[var(--swiss-accent-hover)] text-white rounded-lg text-lg font-semibold transition-all hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                Create List (Top 5 Movies)
                                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <p className="text-xs text-[var(--swiss-text-muted)] mt-4">
                                No credit card required • Free forever
                            </p>
                        </div>

                        {/* Right Column - Interactive Top 5 Form */}
                        <div>
                            {mounted && (
                                <div className="bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] rounded-xl p-6">
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="text-xl font-bold text-[var(--swiss-black)] flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
                                            <Star className="h-5 w-5 text-[var(--swiss-yellow)] fill-[var(--swiss-yellow)]" />
                                            My Top 5 Movies
                                        </h3>
                                        <span className="text-[10px] font-bold px-2 py-1 bg-white text-[var(--swiss-text-muted)] border border-[var(--swiss-border)] rounded uppercase tracking-widest">
                                            Draft
                                        </span>
                                    </div>

                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={movies.map(m => m.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-2">
                                                {movies.map((movie, index) => (
                                                    <SortableMovieItem
                                                        key={movie.id}
                                                        id={movie.id}
                                                        index={index}
                                                        value={movie.value}
                                                        focused={focusedId === movie.id}
                                                        onChange={(val) => handleChange(movie.id, val)}
                                                        onFocus={() => setFocusedId(movie.id)}
                                                        onBlur={() => setFocusedId(null)}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>

                                    <div className="mt-5 p-3 bg-white border border-[var(--swiss-border)] rounded-lg text-center">
                                        <p className="text-xs text-[var(--swiss-text-muted)] flex items-center justify-center gap-2">
                                            <GripVertical className="h-3 w-3" />
                                            Drag to reorder • Start typing to add
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleSaveAndRegister}
                                        className="mt-4 w-full py-4 rounded-lg text-base font-semibold transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                        style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                    >
                                        Save your list and start sharing
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </div>
                            )}
                            {!mounted && (
                                <div className="bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] rounded-xl p-6 h-[400px] animate-pulse" />
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 02 — SOCIAL PROOF */}
            <section className="relative z-10 py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[var(--swiss-off-white)] border-b border-[var(--swiss-border)]">
                <div className="max-w-7xl mx-auto">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--swiss-text-muted)] mb-10 block">
                        02 — SOCIAL PROOF
                    </span>
                    <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                        <motion.blockquote
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="border-l-4 border-[var(--swiss-black)] pl-6"
                        >
                            <p className="text-xl lg:text-2xl font-medium text-[var(--swiss-black)] mb-4 leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
                                "Vaulted feels like the architectural digest of list-making. It forces you to be intentional about what you love."
                            </p>
                            <footer className="text-sm text-[var(--swiss-text-muted)] font-medium">
                                — Sarah Jenkins
                            </footer>
                        </motion.blockquote>
                        <motion.blockquote
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="border-l-4 border-[var(--swiss-black)] pl-6"
                        >
                            <p className="text-xl lg:text-2xl font-medium text-[var(--swiss-black)] mb-4 leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
                                "Finally, a place where my obsession with 70s sci-fi rankings isn't just noise, but a structured archive."
                            </p>
                            <footer className="text-sm text-[var(--swiss-text-muted)] font-medium">
                                — Marcus Chen
                            </footer>
                        </motion.blockquote>
                    </div>
                </div>
            </section>

            {/* SECTION 03 — FEATURES */}
            <section className="relative z-10 py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-[var(--swiss-border)]">
                <div className="max-w-7xl mx-auto">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--swiss-text-muted)] mb-10 block">
                        03 — FEATURES
                    </span>
                    <h2 className="text-4xl sm:text-5xl font-bold mb-12 text-[var(--swiss-black)]" style={{ letterSpacing: '-0.03em' }}>
                        Rank Everything.<br />Share Everywhere.
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Sparkles,
                                title: "Smart & Instant",
                                description: "Search for any movie, book, or place, and we'll auto-fill covers, years, and data instantly.",
                                color: "var(--swiss-green)"
                            },
                            {
                                icon: Users,
                                title: "Share & Debate",
                                description: "Perfect for book clubs and group chats. Share your curated lists with a single link.",
                                color: "var(--swiss-black)"
                            },
                            {
                                icon: Star,
                                title: "Real Human Taste",
                                description: "Discover recommendations from people you trust—not engagement algorithms.",
                                color: "var(--swiss-yellow)"
                            }
                        ].map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="group relative bg-white border border-[var(--swiss-border)] rounded-xl p-8 hover:border-[var(--swiss-black)] transition-all"
                            >
                                <div
                                    className="inline-flex p-3 rounded-lg mb-4"
                                    style={{ backgroundColor: feature.color === 'var(--swiss-yellow)' ? 'var(--swiss-yellow)' : feature.color === 'var(--swiss-green)' ? 'var(--swiss-green-light)' : 'var(--swiss-black)' }}
                                >
                                    <feature.icon className="h-6 w-6" style={{ color: feature.color === 'var(--swiss-black)' ? 'white' : feature.color === 'var(--swiss-yellow)' ? 'var(--swiss-black)' : 'var(--swiss-green)' }} />
                                </div>
                                <h3 className="text-xl font-bold mb-2 text-[var(--swiss-black)]" style={{ letterSpacing: '-0.02em' }}>{feature.title}</h3>
                                <p className="text-[var(--swiss-text-secondary)] leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 04 — DISCOVER */}
            <section className="relative z-10 py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[var(--swiss-off-white)] border-b border-[var(--swiss-border)]">
                <div className="max-w-7xl mx-auto">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--swiss-text-muted)] mb-10 block">
                        04 — DISCOVER
                    </span>
                    <h2 className="text-4xl sm:text-5xl font-bold mb-12 text-[var(--swiss-black)]" style={{ letterSpacing: '-0.03em' }}>
                        Explore Community Lists
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <ExampleListCard
                            title="God-Tier A24 Horror"
                            items={["Hereditary", "The Witch", "Midsommar"]}
                            likes={442}
                            comments={28}
                        />
                        <ExampleListCard
                            title="Best Coffee In Berlin Mitte"
                            items={["Bonanza Coffee", "Father Carpenter", "Distrikt Coffee", "Five Elephant"]}
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[var(--swiss-black)]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="max-w-4xl mx-auto text-center"
                >
                    <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white" style={{ letterSpacing: '-0.03em' }}>
                        Ready to Start Ranking?
                    </h2>
                    <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
                        Join thousands of curators building their ultimate collections.
                    </p>
                    <button
                        onClick={handleSaveAndRegister}
                        className="group px-10 py-5 bg-white hover:bg-[var(--swiss-off-white)] text-[var(--swiss-black)] rounded-xl text-xl font-bold transition-all hover:-translate-y-1 inline-flex items-center gap-3"
                    >
                        Get Started Free
                        <ChevronRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-[var(--swiss-border)] py-8 px-4 sm:px-6 lg:px-8 bg-white">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[var(--swiss-text-muted)] text-sm">
                    <p>© 2026 Vaulted. Curate your legacy.</p>
                    <div className="flex gap-6">
                        <Link href="/privacy" className="hover:text-[var(--swiss-black)] transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-[var(--swiss-black)] transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
