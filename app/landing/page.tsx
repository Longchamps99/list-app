"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Film, Users, Sparkles, ChevronRight, Star, GripVertical, Plus } from "lucide-react";
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

// --- Sortable Item Component ---
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
            <div className={`flex items-center gap-3 bg-slate-800/50 rounded-lg p-1 transition-all ${isDragging ? 'shadow-2xl ring-2 ring-indigo-500 scale-105 bg-slate-800' : ''}`}>
                {/* Drag Handle & Rank */}
                <div
                    {...attributes}
                    {...listeners}
                    className="flex-shrink-0 w-10 h-10 rounded-md bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 flex items-center justify-center cursor-grab active:cursor-grabbing group-hover:shadow-inner transition-colors"
                >
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-indigo-400">#{index + 1}</span>
                        {/* Only show grip on hover to keep interface clean */}
                        <GripVertical className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity absolute mt-4" />
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
                    className={`flex-1 bg-transparent border-0 ring-0 px-2 py-2 text-white placeholder-gray-600 focus:outline-none focus:ring-0 text-base font-medium`}
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

import { usePostHog } from "posthog-js/react";

export default function LandingPage() {
    const router = useRouter();
    const posthog = usePostHog();
    // We store objects with IDs to help DnD tracking
    const [movies, setMovies] = useState<{ id: string; value: string }[]>(
        Array(10).fill(null).map((_, i) => ({ id: `item-${i}`, value: "" }))
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
        const saved = localStorage.getItem("tempTop10");
        if (saved) {
            try {
                // Determine format (array of strings vs objects)
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Check if it's old format (strings) or new (objects)
                    if (typeof parsed[0] === 'string') {
                        setMovies(parsed.map((v: string, i: number) => ({ id: `saved-${i}`, value: v })));
                        // If saved data exists, skip animation
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
        // Save as just string array to maintain compatibility for now, 
        // or update Register page to handle objects. Register page expects string[].
        // Let's save as string[] for compatibility with existing register flow.
        const simpleList = movies.map(m => m.value);
        localStorage.setItem("tempTop10", JSON.stringify(simpleList));
    }, [movies]);


    // Typewriter Effect
    useEffect(() => {
        if (animationComplete) return;

        const currentWord = TYPEWRITER_WORDS[wordIndex];
        const typeSpeed = isDeleting ? 50 : 100; // Type slower, delete faster

        const timer = setTimeout(() => {
            if (!isDeleting) {
                // Typing
                setDisplayText(currentWord.substring(0, displayText.length + 1));

                // Finished typing word
                if (displayText.length === currentWord.length) {
                    // If it's the last word ("Anything"), STOP.
                    if (wordIndex === TYPEWRITER_WORDS.length - 1) {
                        setAnimationComplete(true);
                        setTimeout(() => setShowForm(true), 500); // Slight delay before form appears

                        // Populate if empty
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

                    // Not last word, wait then delete
                    setTimeout(() => setIsDeleting(true), 1200);
                }
            } else {
                // Deleting
                setDisplayText(currentWord.substring(0, displayText.length - 1));

                // Finished deleting
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
        // Track conversion event
        posthog.capture("landing_page_conversion_clicked", {
            movie_count: movies.filter(m => m.value.trim() !== "").length
        });

        const simpleList = movies.map(m => m.value);
        localStorage.setItem("tempTop10", JSON.stringify(simpleList));
        router.push("/register");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white overflow-hidden flex flex-col">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
            </div>

            {/* Navigation */}
            <nav className="relative z-10 border-b border-white/10 backdrop-blur-sm bg-slate-950/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-2">
                            <Star className="h-8 w-8 text-indigo-400 fill-indigo-400/20" />
                            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                Vaulted
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link
                                href="/login"
                                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                            >
                                Log In
                            </Link>
                            <Link
                                href="/register"
                                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/50 hover:shadow-indigo-500/70 hover:-translate-y-0.5"
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
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6"
                                >
                                    <Sparkles className="h-4 w-4 text-indigo-400" />
                                    <span className="text-sm text-indigo-300">Curate Your Legacy</span>
                                </motion.div>

                                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 leading-tight min-h-[160px] lg:min-h-[220px]">
                                    My Top 10
                                    <span className="block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-relaxed pb-2">
                                        {displayText}
                                        <motion.span
                                            animate={{ opacity: [1, 0] }}
                                            transition={{ repeat: Infinity, duration: 0.8 }}
                                            className="text-indigo-400 inline-block ml-1"
                                        >|</motion.span>
                                    </span>
                                </h1>

                                <p className="text-xl text-gray-300 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                                    Create, share, and discover personalized Top 10 lists for anything. Track your favorites,
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
                                            className="group px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg text-lg font-semibold transition-all shadow-2xl shadow-indigo-500/50 hover:shadow-indigo-500/70 hover:-translate-y-1 flex items-center justify-center gap-2"
                                        >
                                            Save My List & Create Account
                                            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </motion.div>
                                )}

                                <p className="text-sm text-gray-400 mt-6">
                                    No credit card required • Free forever
                                </p>
                            </div>

                            {/* Right Column - Interactive Form (Delayed) */}
                            <div className="relative min-h-[600px] flex items-center justify-center">
                                <AnimatePresence>
                                    {showForm && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 50, scale: 0.95 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            transition={{ duration: 0.8, type: "spring" }}
                                            className="w-full max-w-lg"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur-3xl -z-10"></div>
                                            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-2xl font-bold flex items-center gap-2 text-white">
                                                        <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                                                        My Top 10 Movies
                                                    </h3>
                                                    <span className="text-xs font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded uppercase tracking-wider">Draft</span>
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

                                                <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                                                    <p className="text-sm text-indigo-300 text-center flex items-center justify-center gap-2">
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
            <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 border-t border-white/10">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
                            Rank Everything. Share Everywhere.
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            The one place for all your lists. Stop juggling Goodreads, Letterboxd, and notes. Curate everything in one beautiful vault.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Sparkles,
                                title: "Smart & Instant",
                                description: "Stop manually typing details. Search for any movie, book, or place, and we'll auto-fill covers, years, and data instantly.",
                                gradient: "from-indigo-500 to-blue-500"
                            },
                            {
                                icon: Users,
                                title: "Share & Debate",
                                description: "Perfect for book clubs and group chats. Share your curated lists with a single link and see where your tastes overlap.",
                                gradient: "from-purple-500 to-pink-500"
                            },
                            {
                                icon: Star,
                                title: "Real Human Taste",
                                description: "Discover recommendations from people you trust—not engagement algorithms. Find your next obsession, unfiltered.",
                                gradient: "from-yellow-500 to-orange-500"
                            }
                        ].map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.2 }}
                                whileHover={{ y: -5 }}
                                className="group relative bg-slate-900/50 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all"
                            >
                                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 shadow-lg`}>
                                    <feature.icon className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="max-w-4xl mx-auto text-center bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-3xl p-12"
                >
                    <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                        Ready to Start Ranking?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                        Join thousands of curators building their ultimate collections.
                    </p>
                    <button
                        onClick={handleSaveAndRegister}
                        className="group px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-xl font-bold transition-all shadow-2xl shadow-indigo-500/50 hover:shadow-indigo-500/70 hover:-translate-y-1 inline-flex items-center gap-3"
                    >
                        Get Started Free
                        <ChevronRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/10 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
                    <p>© 2026 Vaulted. Curate your legacy.</p>
                </div>
            </footer>
        </div>
    );
}
