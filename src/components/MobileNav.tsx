import React, { useState, useEffect } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { useVirtualKeyboardOpen } from '../hooks/useVirtualKeyboardOpen';
import { useBackOverlay } from '../hooks/useBackOverlay';
import { ViewMode } from '../types';
import { Feather, BookOpen, FolderKanban, Sparkles, Edit3, X } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { activeView, setActiveView, selectTab, openFragmentDrawer, createNote, setActiveNoteId } = useNoesis();
  const isKeyboardOpen = useVirtualKeyboardOpen();
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  const showFab = activeView !== 'editor';

  useBackOverlay(isFabMenuOpen && showFab && !isKeyboardOpen, () => setIsFabMenuOpen(false), 'mobile-fab-menu');

  // Tutup speed dial saat virtual keyboard muncul atau halaman berganti
  useEffect(() => {
    if (isKeyboardOpen) {
      setIsFabMenuOpen(false);
    }
  }, [isKeyboardOpen]);

  useEffect(() => {
    setIsFabMenuOpen(false);
  }, [activeView]);

  const navItems: { view: ViewMode; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { view: 'library', label: 'Library', icon: BookOpen },
    { view: 'fragments', label: 'Fragments', icon: Feather },
    { view: 'discover', label: 'Discover', icon: Sparkles },
    { view: 'projects', label: 'Projects', icon: FolderKanban },
  ];

  const handleCreateNewNote = () => {
    setIsFabMenuOpen(false);
    const id = createNote('thought');
    setActiveNoteId(id);
    setActiveView('editor');
  };

  const handleCaptureFragment = () => {
    setIsFabMenuOpen(false);
    openFragmentDrawer(null);
  };

  // Saat keyboard terbuka, hilangkan navbar & floating FAB secara instan (tanpa animasi slide)
  // agar tidak berebut ruang atau animasi dengan toolbar editor dan keyboard OS.
  if (isKeyboardOpen) {
    return null;
  }

  return (
    <>
      {showFab && (
        <>
          {/* Dismiss Backdrop when Speed Dial is Open */}
          {isFabMenuOpen && (
            <div
              onClick={() => setIsFabMenuOpen(false)}
              aria-hidden="true"
              className="md:hidden fixed inset-0 z-30 bg-[#221F1D]/20 dark:bg-black/45"
            />
          )}

          {/* Dual-Action Speed Dial Menu (New Note & Capture) */}
          {isFabMenuOpen && (
            <div className="md:hidden fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={handleCreateNewNote}
                className="flex items-center gap-2.5 pl-3.5 pr-2 py-1.5 rounded-full bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] shadow-lg active:scale-95"
              >
                <span className="text-xs font-medium tracking-tight">New Note</span>
                <span className="w-8 h-8 rounded-full bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center">
                  <Edit3 size={15} />
                </span>
              </button>

              <button
                type="button"
                onClick={handleCaptureFragment}
                className="flex items-center gap-2.5 pl-3.5 pr-2 py-1.5 rounded-full bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] shadow-lg active:scale-95"
              >
                <span className="text-xs font-medium tracking-tight">Capture</span>
                <span className="w-8 h-8 rounded-full bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center">
                  <Feather size={15} />
                </span>
              </button>
            </div>
          )}

          {/* Floating Action Button for Quick Actions (Numen Style Quill Button) */}
          <button
            type="button"
            onClick={() => setIsFabMenuOpen((prev) => !prev)}
            aria-expanded={isFabMenuOpen}
            aria-label={isFabMenuOpen ? 'Close quick actions' : 'Quick actions: New Note or Capture'}
            className="md:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 w-12 h-12 rounded-full bg-[#9A3412] dark:bg-[#EA580C] text-white shadow-xl flex items-center justify-center active:scale-95"
          >
            {isFabMenuOpen ? <X size={20} /> : <Feather size={20} />}
          </button>
        </>
      )}

      {/* Mobile Bottom Navigation Bar (Static flex footer, zero layout jump) */}
      <nav className="md:hidden shrink-0 z-30 bg-[#FAF7F2] dark:bg-[#151413] border-t border-[#E8E2D8] dark:border-[#2F2B28] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          // When viewing or editing a note, highlight Library as the active section
          const isActive =
            activeView === item.view ||
            (item.view === 'fragments' && activeView === 'capture') ||
            (item.view === 'library' && activeView === 'editor');
          return (
            <button
              key={item.view}
              onClick={() => selectTab(item.view)}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'text-[#9A3412] dark:text-[#EA580C] font-medium'
                  : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
