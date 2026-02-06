// Reusable styled components for consistent Swiss Design UI elements

// 1. Add New Item Button (Primary Pill)
export const addNewItemButtonClass = "flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-full hover:bg-[var(--swiss-accent-hover)] hover:text-white hover:-translate-y-0.5 active:translate-y-0 active:bg-black active:text-white transition-all font-bold text-sm cursor-pointer";

// 2. Tag Pills (for item tags)
export const tagPillClass = "inline-flex items-center px-3 py-1 bg-[var(--swiss-green-light)] text-[var(--swiss-green)] border border-[var(--swiss-green)]/30 rounded-full text-xs font-medium hover:bg-[var(--swiss-green)]/20 hover:border-[var(--swiss-green)]/50 active:bg-[var(--swiss-green)]/30 transition-all cursor-pointer";

// 3. Share Button
export const shareButtonClass = "p-2 text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] hover:bg-[var(--swiss-off-white)] active:bg-[var(--swiss-border)] rounded-lg transition-colors border border-transparent hover:border-[var(--swiss-border)] cursor-pointer";

// 4. Ranking Number Circle
export const rankingCircleClass = "flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm leading-none";

// 5. Filter Tag Pills (for filter bar)
export const filterTagPillClass = "bg-[var(--swiss-green-light)] text-[var(--swiss-green)] border border-[var(--swiss-green)]/30 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-[var(--swiss-green)]/20 active:bg-[var(--swiss-green)]/30 transition-all cursor-pointer";

// 6. Primary Action Button (Pill style)
export const primaryButtonClass = "px-6 py-2.5 bg-black text-white rounded-full hover:bg-[var(--swiss-accent-hover)] hover:text-white hover:-translate-y-0.5 active:translate-y-0 active:bg-black active:text-white transition-all font-semibold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
export const primaryButtonStyle = { backgroundColor: '#191919' };

// 7. Secondary Button (Pill style)
export const secondaryButtonClass = "px-6 py-2.5 bg-white text-[var(--swiss-text-secondary)] border border-[var(--swiss-border)] rounded-full hover:bg-[var(--swiss-off-white)] hover:text-[#191919] hover:border-[var(--swiss-text-muted)] active:bg-[var(--swiss-cream)] active:border-[var(--swiss-black)] transition-all font-semibold text-sm cursor-pointer";

// 8. Danger Button (delete, etc)
export const dangerButtonClass = "px-4 py-2 bg-[var(--swiss-red-light)] text-[var(--swiss-red)] border border-[var(--swiss-red)]/30 rounded-lg hover:bg-[var(--swiss-red)]/10 hover:border-[var(--swiss-red)]/50 active:bg-[var(--swiss-red)]/20 active:border-[var(--swiss-red)] transition-all font-semibold text-sm cursor-pointer";

// 9. Icon Button
export const iconButtonClass = "p-2 text-[var(--swiss-text-muted)] hover:text-[var(--swiss-black)] hover:bg-[var(--swiss-off-white)] active:bg-[var(--swiss-border)] rounded-lg transition-colors border border-transparent hover:border-[var(--swiss-border)] cursor-pointer";

// 10. Card Container
export const cardClass = "bg-white rounded-lg shadow-sm p-4 border border-[var(--swiss-border)] hover:border-[var(--swiss-black)] hover:-translate-y-0.5 active:translate-y-0 transition-all";

// 11. Input Field
export const inputClass = "w-full px-4 py-2.5 bg-white border border-[var(--swiss-border)] rounded-lg focus:border-[var(--swiss-black)] focus:outline-none focus:ring-1 focus:ring-[var(--swiss-black)] transition-all text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)]";

// 12. Search Bar
export const searchBarClass = "w-full pl-10 pr-20 py-2.5 bg-white border border-[var(--swiss-border)] rounded-lg focus:border-[var(--swiss-black)] focus:outline-none focus:ring-1 focus:ring-[var(--swiss-black)] transition-all text-sm text-[var(--swiss-black)] placeholder-[var(--swiss-text-muted)]";

// 13. View Toggle Button (active)
export const viewToggleActiveClass = "p-2 rounded transition-colors bg-[var(--swiss-black)] text-white cursor-pointer";

// 14. View Toggle Button (inactive)
export const viewToggleInactiveClass = "p-2 rounded transition-colors text-[var(--swiss-text-muted)] hover:bg-[var(--swiss-off-white)] hover:text-[var(--swiss-black)] active:bg-[var(--swiss-border)] cursor-pointer";

// 15. Dropdown/Select
export const selectClass = "border-0 focus:ring-0 text-sm font-medium text-[var(--swiss-black)] bg-transparent cursor-pointer pr-8";

// 16. Ghost Button (minimal, text-like)
export const ghostButtonClass = "px-4 py-2 text-[var(--swiss-text-secondary)] rounded-lg hover:text-[var(--swiss-black)] hover:bg-[var(--swiss-off-white)] active:bg-[var(--swiss-border)] transition-all font-medium text-sm cursor-pointer";
