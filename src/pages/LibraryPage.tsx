import React, { useState, useMemo } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { NoteType } from '../types';
import {
  BookOpen,
  Search,
  Plus,
  Feather,
  Star,
  Clock,
  Archive,
  LayoutGrid,
  List as ListIcon,
  X,
  Trash2,
  SlidersHorizontal,
  ArrowUpDown,
  MoreVertical,
  ExternalLink,
  Tag as TagIcon,
  Link2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

export const LibraryPage: React.FC = () => {
  const {
    notes,
    activeNotebookId,
    setActiveNoteId,
    setActiveView,
    createNote,
    deleteNote,
    toggleFavoriteNote,
    toggleArchiveNote,
  } = useNoesis();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'alpha'>('updated');
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    return Array.from(new Set(notes.flatMap((n) => n.tags || [])));
  }, [notes]);

  // Filter & Sort notes
  const filteredNotes = useMemo(() => {
    let result = notes.filter((n) => {
      // Archive filter
      if (showArchivedOnly) {
        if (!n.archived) return false;
      } else {
        if (n.archived) return false;
      }

      // Favorites filter
      if (showFavoritesOnly && !n.favorite) {
        return false;
      }

      // Note Type filter
      if (selectedType !== 'all' && n.type !== selectedType) {
        return false;
      }

      // Tag filter
      if (selectedTag && !n.tags?.includes(selectedTag)) {
        return false;
      }

      // Search query (title, content, tags, source)
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = n.title?.toLowerCase().includes(q);
        const matchContent = n.content?.toLowerCase().includes(q);
        const matchExcerpt = n.excerpt?.toLowerCase().includes(q);
        const matchSource = n.source?.toLowerCase().includes(q);
        const matchTags = n.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchContent && !matchExcerpt && !matchSource && !matchTags) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'alpha') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // default: updated
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [notes, showArchivedOnly, showFavoritesOnly, selectedType, selectedTag, search, sortBy]);

  const handleOpenNote = (id: string) => {
    setActiveNoteId(id);
    setActiveView('editor');
  };

  const handleCreateNew = () => {
    const newId = createNote(activeNotebookId || undefined, (selectedType !== 'all' ? selectedType : 'thought') as NoteType);
    setActiveNoteId(newId);
    setActiveView('editor');
  };

  const getTypeStyle = (type: NoteType) => {
    switch (type) {
      case 'reference':
        return 'text-[#1E3A8A] dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50';
      case 'thought':
        return 'text-[#9A3412] dark:text-[#EA580C] bg-[#FED7AA]/30 dark:bg-[#431407]/40 border-[#FED7AA] dark:border-[#431407]';
      case 'idea':
        return 'text-[#B45309] dark:text-[#F59E0B] bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50';
      default:
        return 'text-[#6B635B] dark:text-[#A8A196] bg-stone-100 dark:bg-stone-800 border-stone-200';
    }
  };

  // Format date helper: "09/11/2026" (DD/MM/YYYY)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getFilterSortLabel = () => {
    const sortLabels: Record<string, string> = {
      updated: 'Updated',
      created: 'Created',
      alpha: 'Alphabetical (A–Z)',
    };
    if (showFavoritesOnly) return `Favorites · ${sortLabels[sortBy]}`;
    if (showArchivedOnly) return `Archive · ${sortLabels[sortBy]}`;
    return sortLabels[sortBy];
  };

  return (
    <div
      className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-3.5 sm:px-8 lg:px-14 py-5 sm:py-8"
      onClick={() => {
        setIsFilterDropdownOpen(false);
      }}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Row */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
              Library
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#9C9388] dark:text-[#736C62]">
              {filteredNotes.length}
            </span>
          </div>

          <button
            onClick={handleCreateNew}
            className="px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-2 shrink-0"
          >
            <Feather size={15} />
            <span>New Note</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-4">
          {/* Desktop Search & Filter Bar (md and up) */}
          <div className="hidden md:block space-y-4">
            {/* Desktop Search Box */}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-3.5 text-[#9C9388]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search across titles, bodies, tags, or citations..."
                className="w-full text-sm pl-11 pr-10 py-3 rounded-2xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-3.5 text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Desktop Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F5EFEB] dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'thought', label: 'Thoughts' },
                  { id: 'reference', label: 'References' },
                  { id: 'idea', label: 'Ideas' },
                ].map((tab) => {
                  const isSelected = selectedType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedType(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                          : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center h-[36px] p-1 bg-white dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] shadow-2xs">
                  <button
                    onClick={() => setViewLayout('grid')}
                    title="Grid View"
                    className={`px-2.5 h-full rounded-lg transition-colors flex items-center justify-center ${
                      viewLayout === 'grid'
                        ? 'bg-[#F5EFEB] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C]'
                        : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                    }`}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    onClick={() => setViewLayout('list')}
                    title="List View"
                    className={`px-2.5 h-full rounded-lg transition-colors flex items-center justify-center ${
                      viewLayout === 'list'
                        ? 'bg-[#F5EFEB] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C]'
                        : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                    }`}
                  >
                    <ListIcon size={15} />
                  </button>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFilterDropdownOpen((prev) => !prev);
                    }}
                    className={`flex items-center gap-2 px-3 h-[36px] rounded-xl border text-xs font-medium transition-colors shadow-2xs select-none ${
                      showFavoritesOnly || showArchivedOnly || isFilterDropdownOpen
                        ? 'border-[#9A3412] dark:border-[#EA580C] bg-white dark:bg-[#1E1C1A] text-[#9A3412] dark:text-[#EA580C]'
                        : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422]'
                    }`}
                  >
                    <ArrowUpDown size={13} className="shrink-0 text-[#9C9388]" />
                    <span className="flex items-center gap-1.5">
                      {showFavoritesOnly && <Star size={12} fill="currentColor" className="text-[#B45309] dark:text-[#F59E0B]" />}
                      {showArchivedOnly && <Archive size={12} />}
                      <span>{getFilterSortLabel()}</span>
                    </span>
                    <ChevronDown
                      size={13}
                      className={`text-[#9C9388] transition-transform duration-200 ${
                        isFilterDropdownOpen ? 'rotate-180 text-[#9A3412] dark:text-[#EA580C]' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Search & Controls Layout (md:hidden) */}
          <div className="md:hidden space-y-2.5">
            {/* Row 1: Compact Search Button + Category Tabs OR Full Expandable Search Bar */}
            {isMobileSearchOpen || search ? (
              <div className="relative flex items-center">
                <Search size={15} className="absolute left-3.5 text-[#9C9388]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes..."
                  autoFocus
                  className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#9A3412] dark:border-[#EA580C] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none"
                />
                <button
                  onClick={() => {
                    setSearch('');
                    setIsMobileSearchOpen(false);
                  }}
                  className="absolute right-3 text-[#9C9388] hover:text-[#221F1D]"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {/* Search Icon Button */}
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="p-2 rounded-xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#9C9388] hover:text-[#9A3412] shrink-0"
                  title="Search"
                >
                  <Search size={15} />
                </button>

                {/* Category Tabs */}
                <div className="flex-1 flex items-center justify-between p-1 bg-[#F5EFEB] dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'thought', label: 'Thoughts' },
                    { id: 'reference', label: 'References' },
                    { id: 'idea', label: 'Ideas' },
                  ].map((tab) => {
                    const isSelected = selectedType === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedType(tab.id)}
                        className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                            : 'text-[#6B635B] dark:text-[#A8A196]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Row 2: Right-Aligned Controls (Grid/List Switcher & Filter/Sort Dropdown) */}
            <div className="flex items-center justify-end gap-2">
              <div className="flex items-center h-[36px] p-1 bg-white dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] shadow-2xs">
                <button
                  onClick={() => setViewLayout('grid')}
                  title="Grid View"
                  className={`px-2.5 h-full rounded-lg transition-colors flex items-center justify-center ${
                    viewLayout === 'grid'
                      ? 'bg-[#F5EFEB] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C]'
                      : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                  }`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewLayout('list')}
                  title="List View"
                  className={`px-2.5 h-full rounded-lg transition-colors flex items-center justify-center ${
                    viewLayout === 'list'
                      ? 'bg-[#F5EFEB] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C]'
                      : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                  }`}
                >
                  <ListIcon size={15} />
                </button>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterDropdownOpen((prev) => !prev);
                  }}
                  className={`flex items-center gap-1.5 px-3 h-[36px] rounded-xl border text-xs font-medium transition-colors shadow-2xs select-none ${
                    showFavoritesOnly || showArchivedOnly || isFilterDropdownOpen
                      ? 'border-[#9A3412] dark:border-[#EA580C] bg-white dark:bg-[#1E1C1A] text-[#9A3412] dark:text-[#EA580C]'
                      : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422]'
                  }`}
                >
                  <ArrowUpDown size={13} className="shrink-0 text-[#9C9388]" />
                  <span className="flex items-center gap-1.5">
                    <span>{getFilterSortLabel()}</span>
                  </span>
                  <ChevronDown
                    size={13}
                    className={`text-[#9C9388] transition-transform duration-200 ${
                      isFilterDropdownOpen ? 'rotate-180 text-[#9A3412] dark:text-[#EA580C]' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Shared Custom Filter/Sort Popover Content */}
          {isFilterDropdownOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-3.5 sm:right-8 lg:right-14 mt-1 w-56 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xl py-2 z-40 animate-in fade-in zoom-in-95 duration-150"
            >
                    {/* Filter Status Group */}
                    <div className="px-3.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
                      Filter Notes
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowFavoritesOnly(false);
                        setShowArchivedOnly(false);
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-1.5 text-xs flex items-center justify-between hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                    >
                      <span className={!showFavoritesOnly && !showArchivedOnly ? 'font-medium text-[#9A3412] dark:text-[#EA580C]' : 'text-[#6B635B] dark:text-[#A8A196]'}>
                        All
                      </span>
                      {!showFavoritesOnly && !showArchivedOnly && (
                        <Check size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowFavoritesOnly(true);
                        setShowArchivedOnly(false);
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-1.5 text-xs flex items-center justify-between hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                    >
                      <span className={showFavoritesOnly ? 'font-medium text-[#B45309] dark:text-[#F59E0B]' : 'text-[#6B635B] dark:text-[#A8A196]'}>
                        Favorites
                      </span>
                      {showFavoritesOnly && (
                        <Check size={13} className="text-[#B45309] dark:text-[#F59E0B]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowArchivedOnly(true);
                        setShowFavoritesOnly(false);
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-1.5 text-xs flex items-center justify-between hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                    >
                      <span className={showArchivedOnly ? 'font-medium text-[#221F1D] dark:text-[#EDE8E1]' : 'text-[#6B635B] dark:text-[#A8A196]'}>
                        Archived
                      </span>
                      {showArchivedOnly && (
                        <Check size={13} className="text-[#221F1D] dark:text-[#EDE8E1]" />
                      )}
                    </button>

                    <div className="h-px bg-[#E8E2D8]/70 dark:bg-[#2F2B28]/70 my-1.5" />

                    {/* Sort Order Group */}
                    <div className="px-3.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
                      Sort Order
                    </div>

                    {[
                      { id: 'updated', label: 'Updated' },
                      { id: 'created', label: 'Created' },
                      { id: 'alpha', label: 'Alphabetical (A–Z)' },
                    ].map((item) => {
                      const isCurrentSort = sortBy === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSortBy(item.id as any);
                            setIsFilterDropdownOpen(false);
                          }}
                          className="w-full px-3.5 py-1.5 text-xs flex items-center justify-between hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                        >
                          <span className={isCurrentSort ? 'font-medium text-[#9A3412] dark:text-[#EA580C]' : 'text-[#6B635B] dark:text-[#A8A196]'}>
                            {item.label}
                          </span>
                          {isCurrentSort && (
                            <Check size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
        </div>

        {/* Notes Grid or List Layout */}
        {filteredNotes.length === 0 ? (
          <div className="py-20 px-6 text-center border border-dashed border-[#E8E2D8] dark:border-[#2F2B28] rounded-3xl p-8 bg-white/40 dark:bg-[#1E1C1A]/40 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mb-3.5">
              <BookOpen size={24} />
            </div>

            {notes.length === 0 ? (
              <>
                <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Perpustakaan Masih Kosong
                </h3>
                <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-1.5 max-w-md leading-relaxed font-normal">
                  Mulai tuangkan pemikiran, kutipan buku, atau rancangan ide barumu ke dalam perpustakaan pribadi.
                </p>
                <button
                  onClick={handleCreateNew}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-2"
                >
                  <Feather size={14} />
                  <span>Tulis Catatan Pertama</span>
                </button>
              </>
            ) : (
              <>
                <h3 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Tidak Ada Catatan yang Cocok
                </h3>
                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 max-w-sm">
                  Tidak ditemukan catatan dengan filter atau pencarian saat ini.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => {
                      setSearch('');
                      setSelectedType('all');
                      setShowFavoritesOnly(false);
                      setShowArchivedOnly(false);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] transition-colors"
                  >
                    Reset Filter
                  </button>
                  <button
                    onClick={handleCreateNew}
                    className="px-4 py-1.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] transition-colors flex items-center gap-1.5"
                  >
                    <Feather size={13} />
                    <span>Tulis Baru</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : viewLayout === 'grid' ? (
          /* Grid Mode: 2 columns on mobile, 3 columns on tablet/desktop (Identical to CapturePage) */
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4 lg:gap-5">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => handleOpenNote(note.id)}
                className="p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer flex flex-col justify-between transition-all shadow-xs group"
              >
                <div>
                  {/* Card Header (Category & Date unboxed) */}
                  <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-[#9C9388] dark:text-[#736C62] mb-1.5 sm:mb-2.5 gap-1">
                    <span
                      className={`uppercase tracking-wider font-semibold text-[10px] sm:text-[11px] shrink-0 ${
                        note.type === 'reference'
                          ? 'text-[#1E3A8A] dark:text-[#60A5FA]'
                          : note.type === 'idea'
                          ? 'text-[#B45309] dark:text-[#F59E0B]'
                          : 'text-[#9A3412] dark:text-[#EA580C]'
                      }`}
                    >
                      {note.type || 'thought'}
                    </span>
                    <span className="truncate">{formatDate(note.updatedAt)}</span>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-sm sm:text-base md:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] tracking-tight group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors line-clamp-2 leading-snug">
                    {note.title || 'Untitled Note'}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-[11px] sm:text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 sm:mt-2 leading-relaxed line-clamp-3 sm:line-clamp-4">
                    {note.excerpt || 'No additional content'}
                  </p>
                </div>

                {/* Footer (Tags & Actions) */}
                <div className="mt-3 sm:mt-5 pt-2 sm:pt-3 border-t border-[#E8E2D8]/70 dark:border-[#2F2B28]/70 flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-[#9C9388]">
                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[#9C9388] font-mono truncate pr-1">
                    {note.tags && note.tags.length > 0 && (
                      <>
                        <span className="sm:hidden truncate">#{note.tags[0]}</span>
                        <span className="hidden sm:inline-flex items-center gap-1 truncate">
                          {note.tags.map((t, idx) => (
                            <span key={t} className="truncate">
                              #{t}
                              {idx < note.tags.length - 1 ? ' · ' : ''}
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-0.5 sm:gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => toggleFavoriteNote(note.id)}
                      className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                        note.favorite
                          ? 'text-[#B45309] dark:text-[#F59E0B]'
                          : 'text-[#9C9388] hover:text-[#221F1D]'
                      }`}
                      title={note.favorite ? 'Favorited' : 'Add to Favorites'}
                    >
                      <Star
                        size={13}
                        className="sm:w-3.5 sm:h-3.5"
                        fill={note.favorite ? 'currentColor' : 'none'}
                      />
                    </button>
                    <button
                      onClick={() => setNoteIdToDelete(note.id)}
                      className="p-1 sm:p-1.5 rounded-lg text-[#9C9388] hover:text-red-600 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      title="Delete Note"
                    >
                      <Trash2 size={13} className="sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List Mode */
          <div className="space-y-2.5 sm:space-y-3">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => handleOpenNote(note.id)}
                className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer group transition-all shadow-xs"
              >
                {/* Top Row: Category Type on left, Date + Actions on top-right */}
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span
                    className={`uppercase tracking-wider font-semibold text-[10px] sm:text-[11px] font-mono ${
                      note.type === 'reference'
                        ? 'text-[#1E3A8A] dark:text-[#60A5FA]'
                        : note.type === 'idea'
                        ? 'text-[#B45309] dark:text-[#F59E0B]'
                        : 'text-[#9A3412] dark:text-[#EA580C]'
                    }`}
                  >
                    {note.type || 'thought'}
                  </span>

                  <div
                    className="flex items-center gap-1.5 text-xs font-mono text-[#9C9388] dark:text-[#736C62] shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{formatDate(note.updatedAt)}</span>
                    <button
                      onClick={() => toggleFavoriteNote(note.id)}
                      className={`p-1 rounded-lg transition-colors ${
                        note.favorite
                          ? 'text-[#B45309] dark:text-[#F59E0B]'
                          : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                      }`}
                      title={note.favorite ? 'Favorited' : 'Add to Favorites'}
                    >
                      <Star size={14} fill={note.favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => setNoteIdToDelete(note.id)}
                      className="p-1 rounded-lg text-[#9C9388] hover:text-red-600 transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                      title="Delete Note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Title & Full-width Preview */}
                <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] tracking-tight group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors leading-snug">
                  {note.title || 'Untitled Note'}
                </h3>

                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed line-clamp-2">
                  {note.excerpt || 'No content preview'}
                </p>

                {/* Bottom Row: Tags Only */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#9C9388] dark:text-[#736C62] font-mono mt-2.5 pt-2 border-t border-[#E8E2D8]/50 dark:border-[#2F2B28]/50">
                    {note.tags.map((t, idx) => (
                      <span key={t}>
                        #{t}
                        {idx < note.tags.length - 1 ? ' ·' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(noteIdToDelete)}
        onClose={() => setNoteIdToDelete(null)}
        onConfirm={() => {
          if (noteIdToDelete) {
            deleteNote(noteIdToDelete);
            setNoteIdToDelete(null);
          }
        }}
        itemType="note"
      />
    </div>
  );
};
