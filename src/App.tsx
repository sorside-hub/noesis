import React from 'react';
import { NoesisProvider, useNoesis } from './context/NoesisContext';
import { Sidebar } from './components/Sidebar';
import { StreamColumn } from './components/StreamColumn';
import { TiptapEditor } from './components/TiptapEditor';
import { MobileNav } from './components/MobileNav';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { HomePage } from './pages/HomePage';
import { CapturePage } from './pages/CapturePage';
import { LibraryPage } from './pages/LibraryPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Menu, Feather, ChevronLeft } from 'lucide-react';

const WorkspaceShell: React.FC = () => {
  const {
    activeView,
    setActiveView,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    setIsQuickCaptureOpen,
  } = useNoesis();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1]">
      {/* Desktop & Tablet Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative z-10 w-72 bg-[#F5EFEB] dark:bg-[#1A1817] h-full shadow-2xl flex flex-col">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative pb-16 md:pb-0">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2]/95 dark:bg-[#151413]/95 backdrop-blur-sm z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-1.5 rounded-lg text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
            <span
              onClick={() => setActiveView('home')}
              className="font-serif text-xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] cursor-pointer"
            >
              Noesis
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsQuickCaptureOpen(true)}
              className="p-1.5 rounded-lg text-[#9A3412] dark:text-[#EA580C] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]"
              aria-label="Capture relic"
            >
              <Feather size={18} />
            </button>
          </div>
        </header>

        {/* View Layout Switcher */}
        <div className="flex-1 flex h-full overflow-hidden">
          {activeView === 'editor' ? (
            // 3-Column Layout: Sidebar (already rendered) + StreamColumn (middle) + TiptapEditor (right)
            <div className="flex-1 flex h-full overflow-hidden">
              <div className="hidden lg:flex h-full">
                <StreamColumn />
              </div>
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <TiptapEditor />
              </div>
            </div>
          ) : activeView === 'home' ? (
            <HomePage />
          ) : activeView === 'capture' ? (
            <CapturePage />
          ) : activeView === 'library' ? (
            <LibraryPage />
          ) : activeView === 'discover' ? (
            <DiscoverPage />
          ) : activeView === 'projects' ? (
            <ProjectsPage />
          ) : activeView === 'settings' ? (
            <SettingsPage />
          ) : (
            <HomePage />
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileNav />

        {/* Quick Capture Modal (Triggered from anywhere) */}
        <QuickCaptureModal />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <NoesisProvider>
      <WorkspaceShell />
    </NoesisProvider>
  );
}
