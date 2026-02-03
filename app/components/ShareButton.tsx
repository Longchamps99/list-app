import { useState } from "react";


interface ShareButtonProps {
    type: "ITEM" | "LIST";
    id: string;
    title: string; // For the native share sheet
    className?: string;
}

export function ShareButton({ type, id, title, className = "" }: ShareButtonProps) {
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);
        try {
            // 1. Generate Link
            const res = await fetch("/api/share/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, id }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to generate link");
            }

            const { url } = await res.json();

            // 2. Share
            if (navigator.share) {
                await navigator.share({
                    title: `Check out this ${type.toLowerCase()}`,
                    text: `I wanted to share "${title}" with you.`,
                    url,
                });
            } else {
                // Fallback to clipboard
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (e: any) {
            console.error("Share failed", e);
            alert(`Failed to share: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleShare}
            disabled={loading}
            className={className || "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--swiss-text-secondary)] bg-white border border-[var(--swiss-border)] rounded-full hover:bg-[var(--swiss-off-white)] hover:text-[var(--swiss-black)] hover:border-[var(--swiss-text-muted)] active:bg-[var(--swiss-cream)] transition-all disabled:opacity-50"}
        >
            {loading ? (
                <span className="animate-spin">⌛</span>
            ) : copied ? (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Copied
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    Share
                </>
            )}
        </button>
    );
}
