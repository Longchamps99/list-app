import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareModal } from "./ShareModal";

interface ShareButtonProps {
    type: "ITEM" | "LIST" | "SMART_LIST";
    id?: string;
    title: string;
    className?: string;
    tags?: string; // For smart lists
    children?: React.ReactNode;
}

export function ShareButton({ type, id, title, className = "", tags, children }: ShareButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleShareClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsModalOpen(true);
    };

    return (
        <>
            <button
                onClick={handleShareClick}
                className={className || "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--swiss-text-secondary)] bg-white border border-[var(--swiss-border)] rounded-full hover:bg-[var(--swiss-off-white)] hover:text-[var(--swiss-black)] hover:border-[var(--swiss-text-muted)] active:bg-[var(--swiss-cream)] transition-all"}
            >
                <Share2 className="w-4 h-4 flex-shrink-0" />
                {children || "Share"}
            </button>

            <ShareModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type={type}
                id={id}
                title={title}
                tags={tags}
            />
        </>
    );
}
