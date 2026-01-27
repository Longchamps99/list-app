
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export interface ToastMessage {
    id: string;
    message: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    duration?: number;
}

interface ToastProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 w-full max-w-sm pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        className="bg-slate-900 border border-white/10 shadow-2xl shadow-black/50 text-white px-4 py-3 rounded-lg flex items-center justify-between gap-4 pointer-events-auto backdrop-blur-md w-full"
                    >
                        <span className="text-sm font-medium">{toast.message}</span>
                        <div className="flex items-center gap-3">
                            {toast.action && (
                                <button
                                    onClick={toast.action.onClick}
                                    className="text-indigo-400 hover:text-indigo-300 text-sm font-bold uppercase tracking-wide transition-colors"
                                >
                                    {toast.action.label}
                                </button>
                            )}
                            <button
                                onClick={() => onDismiss(toast.id)}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
