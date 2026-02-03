"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, ChevronRight, Star, GripVertical } from "lucide-react";
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

// --- Sortable Item Component (Swiss Design) ---
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
        <div ref={setNodeRef} style={style} className="group relative mb-3">
            <div className={`flex items-center gap-3 bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] rounded-lg p-1 transition-all ${isDragging ? 'shadow-lg border-[var(--swiss-black)] scale-[1.02]' : 'hover:border-[var(--swiss-text-muted)]'}`}>
                {/* Drag Handle & Rank */}
                <div
                    {...attributes}
                    {...listeners}
                    className="flex-shrink-0 w-10 h-10 rounded-md bg-[var(--swiss-black)] flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors"
                >
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-white">#{index + 1}</span>
                        <GripVertical className="h-3 w-3 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity absolute mt-4" />
                    </div>
                </div>

                {/* Input */}
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder={`Item #${index + 1}...`}
                    className="flex-1 bg-transparent border-0 ring-0 px-2 py-2 text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)] focus:outline-none focus:ring-0 text-base font-medium"
                />
            </div>
        </div>
    );
}

const TYPEWRITER_WORDS = [
    "Movies",
    "Books",
    "Hotels",
    "Songs",
    "Places",
    "Anything"
];

export default function LandingPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const posthog = usePostHog();
    const [movies, setMovies] = useState<{ id: string; value: string }[]>(
        Array(5).fill(null).map((_, i) => ({ id: `item-${i}`, value: "" }))
    );
    const [focusedId, setFocusedId] = useState<string | null>(null);

    // Animation State
    const [displayText, setDisplayText] = useState("");
    const [wordIndex, setWordIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [animationComplete, setAnimationComplete] = useState(false);

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
                        if (parsed.some((s: string) => s.trim() !== "")) {
                            setAnimationComplete(true);
                            setDisplayText("Anything");
                            setShowForm(true);
                        }
                    } else {
                        setMovies(parsed);
                        if (parsed.some((m: any) => m.value.trim() !== "")) {
                            setAnimationComplete(true);
                            setDisplayText("Anything");
                            setShowForm(true);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to parse", e);
            }
        }
    }, []);

    useEffect(() => {
        const simpleList = movies.map(m => m.value);
        localStorage.setItem("tempTop5", JSON.stringify(simpleList));
    }, [movies]);

    // Typewriter Effect
    useEffect(() => {
        if (animationComplete) return;

        const currentWord = TYPEWRITER_WORDS[wordIndex];
        const typeSpeed = isDeleting ? 50 : 100;

        const timer = setTimeout(() => {
            if (!isDeleting) {
                setDisplayText(currentWord.substring(0, displayText.length + 1));

                if (displayText.length === currentWord.length) {
                    if (wordIndex === TYPEWRITER_WORDS.length - 1) {
                        setAnimationComplete(true);
                        setTimeout(() => setShowForm(true), 500);

                        setMovies(prev => {
                            const hasContent = prev.some(m => m.value.trim() !== "");
                            if (!hasContent) {
                                const newMovies = [...prev];
                                newMovies[0].value = "The Godfather";
                                newMovies[1].value = "The Shawshank Redemption";
                                return newMovies;
                            }
                            return prev;
                        });
                        return;
                    }

                    setTimeout(() => setIsDeleting(true), 1200);
                }
            } else {
                setDisplayText(currentWord.substring(0, displayText.length - 1));

                if (displayText.length === 0) {
                    setIsDeleting(false);
                    setWordIndex(prev => prev + 1);
                }
            }
        }, typeSpeed);

        return () => clearTimeout(timer);
    }, [displayText, isDeleting, wordIndex, animationComplete]);

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
        <div className="min-h-screen bg-white text-[var(--swiss-black)] overflow-hidden flex flex-col">
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
                            <span className="text-2xl font-bold text-[var(--swiss-black)]">
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
                                className="px-6 py-2 bg-[var(--swiss-black)] hover:bg-[var(--swiss-accent-hover)] text-white rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5"
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="flex-1 flex flex-col justify-center relative z-10">
                <section className="px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                            {/* Left Column - Copy */}
                            <div className="text-center lg:text-left">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--swiss-green-light)] border border-[var(--swiss-green)]/30 rounded-full mb-6"
                                >
                                    <Sparkles className="h-4 w-4 text-[var(--swiss-green)]" />
                                    <span className="text-sm text-[var(--swiss-green)] font-medium">Curate Your Legacy</span>
                                </motion.div>

                                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 leading-tight min-h-[160px] lg:min-h-[220px]">
                                    My Top 5
                                    <span className="block text-[var(--swiss-green)] leading-relaxed pb-2">
                                        {displayText}
                                        <motion.span
                                            animate={{ opacity: [1, 0] }}
                                            transition={{ repeat: Infinity, duration: 0.8 }}
                                            className="text-[var(--swiss-green)] inline-block ml-1"
                                        >|</motion.span>
                                    </span>
                                </h1>

                                <p className="text-xl text-[var(--swiss-text-secondary)] mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                                    Create, share, and discover personalized ranked lists for anything. Track your favorites,
                                    connect with friends, and build your ultimate vault.
                                </p>

                                {showForm && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6 }}
                                        className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                                    >
                                        <button
                                            onClick={handleSaveAndRegister}
                                            className="group px-8 py-4 bg-[var(--swiss-black)] hover:bg-[var(--swiss-accent-hover)] text-white rounded-lg text-lg font-semibold transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                        >
                                            Save My List & Create Account
                                            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </motion.div>
                                )}

                                <p className="text-sm text-[var(--swiss-text-muted)] mt-6">
                                    No credit card required • Free forever
                                </p>
                            </div>

                            {/* Right Column - Interactive Form */}
                            <div className="relative min-h-[600px] flex items-center justify-center">
                                <AnimatePresence>
                                    {showForm && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 50, scale: 0.95 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            transition={{ duration: 0.8, type: "spring" }}
                                            className="w-full max-w-lg"
                                        >
                                            <div className="bg-white border border-[var(--swiss-border)] rounded-xl p-6 sm:p-8 shadow-sm">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-2xl font-bold flex items-center gap-2 text-[var(--swiss-black)]">
                                                        <Star className="h-6 w-6 text-[var(--swiss-yellow)] fill-[var(--swiss-yellow)]" />
                                                        My Top 5 Movies
                                                    </h3>
                                                    <span className="text-[10px] font-bold px-2 py-1 bg-[var(--swiss-off-white)] text-[var(--swiss-text-muted)] border border-[var(--swiss-border)] rounded uppercase tracking-widest">Draft</span>
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
                                                        <div className="space-y-1">
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

                                                <div className="mt-6 p-4 bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] rounded-lg">
                                                    <p className="text-sm text-[var(--swiss-text-muted)] text-center flex items-center justify-center gap-2">
                                                        <Sparkles className="h-4 w-4" />
                                                        Drag to reorder • Start typing to create
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                        </div>
                    </div>
                </section>
            </div>

            {/* Features Section */}
            <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 border-t border-[var(--swiss-border)] bg-[var(--swiss-off-white)]">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-[var(--swiss-black)]">
                            Rank Everything. Share Everywhere.
                        </h2>
                        <p className="text-xl text-[var(--swiss-text-secondary)] max-w-2xl mx-auto">
                            The one place for all your lists. Stop juggling Goodreads, Letterboxd, and notes. Curate everything in one beautiful vault.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Sparkles,
                                title: "Smart & Instant",
                                description: "Stop manually typing details. Search for any movie, book, or place, and we'll auto-fill covers, years, and data instantly.",
                                color: "var(--swiss-green)"
                            },
                            {
                                icon: Users,
                                title: "Share & Debate",
                                description: "Perfect for book clubs and group chats. Share your curated lists with a single link and see where your tastes overlap.",
                                color: "var(--swiss-black)"
                            },
                            {
                                icon: Star,
                                title: "Real Human Taste",
                                description: "Discover recommendations from people you trust—not engagement algorithms. Find your next obsession, unfiltered.",
                                color: "var(--swiss-yellow)"
                            }
                        ].map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.2 }}
                                whileHover={{ y: -5 }}
                                className="group relative bg-white border border-[var(--swiss-border)] rounded-xl p-8 hover:border-[var(--swiss-black)] transition-all"
                            >
                                <div
                                    className="inline-flex p-3 rounded-lg mb-4"
                                    style={{ backgroundColor: feature.color === 'var(--swiss-yellow)' ? 'var(--swiss-yellow)' : feature.color === 'var(--swiss-green)' ? 'var(--swiss-green-light)' : 'var(--swiss-black)' }}
                                >
                                    <feature.icon className="h-6 w-6" style={{ color: feature.color === 'var(--swiss-black)' ? 'white' : feature.color === 'var(--swiss-yellow)' ? 'var(--swiss-black)' : 'var(--swiss-green)' }} />
                                </div>
                                <h3 className="text-2xl font-bold mb-3 text-[var(--swiss-black)]">{feature.title}</h3>
                                <p className="text-[var(--swiss-text-secondary)] leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-[var(--swiss-black)]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="max-w-4xl mx-auto text-center"
                >
                    <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white">
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
