import React from 'react';
import { useNoesis } from '../context/NoesisContext';
import { ViewMode } from '../types';
import { Compass, Feather, BookOpen, FolderKanban, Sparkles } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { activeView, setActiveView, openFragmentDrawer } = useNoesis();

  const navItems: { view: ViewMode; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { view: 'home', label: 'Home', icon: Compass },
    { view: 'library', label: 'Library', icon: BookOpen },
    { view: 'fragments', label: 'Fragments', icon: Feather },
    { view: 'discover', label: 'Discover', icon: Sparkles },
    { view: 'projects', label: 'Projects', icon: FolderKanban },
  ];

  return (
    <>
      {/* Floating Action Button for Quick Capture (Numen Style Quill Button) */}
      <button
        onClick={() => openFragmentDrawer(null)}
        aria-label="Capture new fragment"
        className="md:hidden fixed bottom-20 right-5 z-40 w-13 h-13 rounded-full bg-[#9A3412] dark:bg-[#EA580C] text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Feather size={22} />
      </button>

      {/* Mobile Bottom Navigation Bar - Always visible across all views including Editor */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F2]/95 dark:bg-[#151413]/95 backdrop-blur-md border-t border-[#E8E2D8] dark:border-[#2F2B28] px-2 py-2 flex items-center justify-around select-none">
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
              onClick={() => setActiveView(item.view)}
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
