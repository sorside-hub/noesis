import React from 'react';
import { useNoesis } from '../context/NoesisContext';
import { PWAInstallButton } from './PWAInstallButton';
import { ViewMode } from '../types';
import {
  Compass,
  Feather,
  BookOpen,
  Sparkles,
  FolderKanban,
  Settings,
  Plus,
  Star,
  Archive,
  BookMarked,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LogIn,
  Trash2,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    selectTab,
    activeNotebookId,
    setActiveNotebookId,
    notes,
    createNote,
    theme,
    setTheme,
    isSidebarCollapsed,
    toggleSidebar,
    openFragmentDrawer,
    authUser,
    exitOfflineMode,
    requestSignOut,
    requestWipeLocalExit,
  } = useNoesis();

  const userEmail = authUser?.email || 'Mode Lokal (Offline)';
  const userInitial = (authUser?.email?.[0] || 'N').toUpperCase();

  const totalNotes = notes.length;
  const favoriteCount = notes.filter((n) => n.favorite).length;
  const archiveCount = notes.filter((n) => n.archived).length;

  const navItems: { view: ViewMode; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { view: 'home', label: 'Overview', icon: Compass },
    { view: 'library', label: 'Library', icon: BookOpen },
    { view: 'fragments', label: 'Fragments', icon: Feather },
    { view: 'discover', label: 'Discover', icon: Sparkles },
    { view: 'projects', label: 'Projects', icon: FolderKanban },
    { view: 'settings', label: 'Settings', icon: Settings },
  ];

  if (isSidebarCollapsed) {
    return (
      <aside className="w-16 border-r border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB] dark:bg-[#1A1817] flex flex-col items-center py-4 justify-between h-full shrink-0 select-none transition-all">
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            onClick={() => selectTab('home')}
            className="w-10 h-10 rounded-xl bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#332F2C] flex items-center justify-center font-serif text-lg font-bold text-[#9A3412] dark:text-[#EA580C]"
            title="Noesis"
          >
            N
          </button>

          <button
            onClick={() => createNote()}
            title="Create Note"
            className="w-10 h-10 rounded-xl bg-[#9A3412] text-white hover:bg-[#78280E] flex items-center justify-center shadow-xs transition-colors"
          >
            <Feather size={18} />
          </button>
 
          <nav className="flex flex-col items-center gap-1.5 mt-2 w-full px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                activeView === item.view ||
                (item.view === 'fragments' && activeView === 'capture') ||
                (item.view === 'library' && activeView === 'editor');
              return (
                <button
                  key={item.view}
                  onClick={() => selectTab(item.view)}
                  title={item.label}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
                  }`}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-2">
          {authUser ? (
            <button
              onClick={requestSignOut}
              title={`Keluar (${userEmail})`}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B635B] dark:text-[#A8A196] hover:text-red-600 dark:hover:text-red-400 hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
              aria-label="Keluar dari Akun"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <>
              <button
                onClick={exitOfflineMode}
                title="Masuk ke Akun (Simpan Data Lokal)"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9A3412] dark:text-[#EA580C] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
                aria-label="Masuk ke Akun"
              >
                <LogIn size={16} />
              </button>
              <button
                onClick={requestWipeLocalExit}
                title="Hapus Data Lokal & Keluar"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B635B] dark:text-[#A8A196] hover:text-red-600 dark:hover:text-red-400 hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
                aria-label="Hapus Data Lokal & Keluar"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
          <button
            onClick={toggleSidebar}
            title="Expand Sidebar"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-r border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB] dark:bg-[#1A1817] flex flex-col justify-between h-full shrink-0 select-none transition-all overflow-y-auto">
      <div className="p-4 flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div
            onClick={() => selectTab('home')}
            className="cursor-pointer group"
          >
            <h1 className="font-serif text-2xl tracking-tight font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors">
              Noesis
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-[#9C9388] dark:text-[#736C62] font-mono mt-0.5">
              Intellectual Sanctuary
            </p>
          </div>

          <button
            onClick={toggleSidebar}
            title="Collapse Sidebar"
            className="p-1 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => createNote()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] shadow-xs transition-colors"
          >
            <Feather size={14} />
            <span>New Note</span>
          </button>
          <button
            onClick={() => openFragmentDrawer(null)}
            title="Quick Capture Fragment"
            className="p-2 rounded-lg border border-[#E8E2D8] dark:border-[#332F2C] bg-white dark:bg-[#221F1E] text-[#9A3412] dark:text-[#EA580C] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] transition-colors shadow-xs"
          >
            <Feather size={15} />
          </button>
        </div>

        {/* Primary Views Navigation */}
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] px-2 mb-1">
            Workspace
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeView === item.view ||
              (item.view === 'fragments' && activeView === 'capture') ||
              (item.view === 'library' && activeView === 'editor');
            return (
              <button
                key={item.view}
                onClick={() => selectTab(item.view)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-[#272422] text-[#221F1D] dark:text-[#EDE8E1] shadow-xs'
                    : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    size={16}
                    className={isActive ? 'text-[#9A3412] dark:text-[#EA580C]' : 'text-[#9C9388]'}
                  />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Streams Filters (All Notes, Favorites, Archive) */}
        <div className="flex flex-col gap-1 pt-2 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] px-2 mb-1">
            Streams
          </p>

          <button
            onClick={() => {
              setActiveView('library');
              setActiveNotebookId(null);
            }}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
              activeNotebookId === null && activeView === 'library'
                ? 'bg-white dark:bg-[#272422] font-medium text-[#221F1D] dark:text-[#EDE8E1] shadow-xs'
                : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookMarked size={14} className="text-[#9C9388]" />
              <span>All Notes</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-[#9C9388]">{totalNotes}</span>
          </button>

          <button
            onClick={() => {
              setActiveView('library');
              setActiveNotebookId('favorites');
            }}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
              activeNotebookId === 'favorites'
                ? 'bg-white dark:bg-[#272422] font-medium text-[#221F1D] dark:text-[#EDE8E1] shadow-xs'
                : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Star size={14} className="text-[#9C9388]" />
              <span>Favorites</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-[#9C9388]">{favoriteCount}</span>
          </button>

          <button
            onClick={() => {
              setActiveView('library');
              setActiveNotebookId('archived');
            }}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
              activeNotebookId === 'archived'
                ? 'bg-white dark:bg-[#272422] font-medium text-[#221F1D] dark:text-[#EDE8E1] shadow-xs'
                : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Archive size={14} className="text-[#9C9388]" />
              <span>Archive</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-[#9C9388]">{archiveCount}</span>
          </button>
        </div>
      </div>

      {/* Footer & Theme Switcher */}
      <div className="p-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] flex flex-col gap-3">
        {/* PWA Install Button */}
        <PWAInstallButton variant="sidebar" />

        {/* Theme Segmented Control (Light, Dark, System) */}
        <div className="flex items-center justify-between bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] p-1 rounded-xl">
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              theme === 'light'
                ? 'bg-[#FAF7F2] text-[#9A3412] shadow-xs'
                : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D]'
            }`}
            title="Light Theme (Warm Parchment)"
          >
            <Sun size={12} />
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-[#272422] text-[#EA580C] shadow-xs'
                : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D]'
            }`}
            title="Dark Theme (Antique Charcoal)"
          >
            <Moon size={12} />
            <span>Dark</span>
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              theme === 'system'
                ? 'bg-[#FAF7F2] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D]'
            }`}
            title="System Preference"
          >
            <Monitor size={12} />
            <span>Auto</span>
          </button>
        </div>

        {/* User Workspace Info & Auth Action */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#E8E2D8] dark:bg-[#2F2B28] flex items-center justify-center font-serif text-xs font-semibold text-[#6B635B] dark:text-[#EDE8E1] shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] truncate">
                {authUser ? 'Personal Vault' : 'Local Workspace'}
              </p>
              <p className="text-[10px] text-[#9C9388] dark:text-[#736C62] truncate" title={userEmail}>
                {userEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {authUser ? (
              <button
                type="button"
                onClick={requestSignOut}
                title="Keluar dari Akun"
                className="p-1.5 rounded-lg text-[#9C9388] hover:text-red-600 dark:hover:text-red-400 hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
                aria-label="Keluar"
              >
                <LogOut size={14} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={exitOfflineMode}
                  title="Masuk ke Akun (Data lokal otomatis disinkronkan)"
                  className="p-1.5 rounded-lg text-[#9A3412] dark:text-[#EA580C] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
                  aria-label="Masuk ke Akun"
                >
                  <LogIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={requestWipeLocalExit}
                  title="Hapus Data Lokal & Keluar"
                  className="p-1.5 rounded-lg text-[#9C9388] hover:text-red-600 dark:hover:text-red-400 hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
                  aria-label="Hapus Data Lokal & Keluar"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
