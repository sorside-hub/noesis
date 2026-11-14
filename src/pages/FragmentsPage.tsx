import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { FragmentType } from '../types';
import {
  Feather,
  Search,
  LayoutGrid,
  List as ListIcon,
  Star,
  Plus,
  Trash2,
  X,
  ArrowUpDown,
  ChevronDown,
  Check,
} from 'lucide-react';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { useBackOverlay } from '../hooks/useBackOverlay';
import { useScrollRestoration } from '../hooks/useScrollRestoration';

export const FragmentsPage: React.FC = () => {
  const scrollRef = useScrollRestoration<HTMLDivElement>('fragments');
  const {
    fragments,
    deleteFragment,
    toggleStarFragment,
    openFragmentDrawer,
    fragmentsViewPrefs,
    setFragmentsViewPrefs,
  } = useNoesis();

  const {
    search,
    selectedType,
    showFavoritesOnly,
    sortBy,
    viewMode,
  } = fragmentsViewPrefs;

  const setSearch = (val: string) =>
    setFragmentsViewPrefs((prev) => ({ ...prev, search: val }));
  const setSelectedType = (val: string) =>
    setFragmentsViewPrefs((prev) => ({ ...prev, selectedType: val }));
  const setShowFavoritesOnly = (val: React.SetStateAction<boolean>) =>
    setFragmentsViewPrefs((prev) => ({
      ...prev,
      showFavoritesOnly: typeof val === 'function' ? val(prev.showFavoritesOnly) : val,
    }));
  const setSortBy = (val: 'recent' | 'alpha') =>
    setFragmentsViewPrefs((prev) => ({ ...prev, sortBy: val }));
  const setViewMode = (val: 'grid' | 'list') =>
    setFragmentsViewPrefs((prev) => ({ ...prev, viewMode: val }));

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [fragmentIdToDelete, setFragmentIdToDelete] = useState<string | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  useBackOverlay(Boolean(fragmentIdToDelete), () => setFragmentIdToDelete(null), 'fragments-delete-modal');
  useBackOverlay(isFilterDropdownOpen, () => setIsFilterDropdownOpen(false), 'fragments-filter-dropdown');
  useBackOverlay(
    isMobileSearchOpen,
    () => {
      setSearch('');
      setIsMobileSearchOpen(false);
    },
    'fragments-mobile-search'
  );

  useEffect(() => {
    if (isMobileSearchOpen) {
      mobileSearchInputRef.current?.focus();
    }
  }, [isMobileSearchOpen]);

  // Close mobile search box when input is empty and user clicks outside
  useEffect(() => {
    if (!isMobileSearchOpen || search.length > 0) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        setIsMobileSearchOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isMobileSearchOpen, search]);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'thought', label: 'Thoughts' },
    { id: 'reference', label: 'References' },
    { id: 'idea', label: 'Ideas' },
  ];

  const filteredFragments = useMemo(() => {
    let result = fragments.filter((f) => {
      if (showFavoritesOnly && !f.starred) return false;
      if (selectedType !== 'all' && f.type !== selectedType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = f.title.toLowerCase().includes(q);
        const matchContent = f.content.toLowerCase().includes(q);
        const matchTags = f.tags.some((t) => t.toLowerCase().includes(q));
        const matchSource = f.source?.toLowerCase().includes(q);
        return matchTitle || matchContent || matchTags || matchSource;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'alpha') {
        return a.title.localeCompare(b.title);
      }
      // Parse DD/MM/YYYY or standard date strings
      const parseCustomDate = (dateStr: string) => {
        if (!dateStr) return 0;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts.map(Number);
          return new Date(year, month - 1, day).getTime();
        }
        const parsed = new Date(dateStr).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };

      const dateA = parseCustomDate(a.date);
      const dateB = parseCustomDate(b.date);
      return dateB - dateA;
    });

    return result;
  }, [fragments, showFavoritesOnly, selectedType, search, sortBy]);

  // Format date helper: "09/11/2026" (DD/MM/YYYY)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getFilterSortLabel = () => {
    const sortLabels: Record<string, string> = {
      recent: 'Added',
      alpha: 'Alphabetical (A–Z)',
    };
    if (showFavoritesOnly) return `Favorites · ${sortLabels[sortBy]}`;
    return sortLabels[sortBy];
  };

  const getMobileSortLabel = () => {
    const sortLabels: Record<string, string> = {
      recent: 'Added',
      alpha: 'A–Z',
    };
    return sortLabels[sortBy];
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-3 sm:px-8 lg:px-14 py-3 sm:py-8"
      onClick={() => setIsFilterDropdownOpen(false)}
    >
      <div className="max-w-5xl mx-auto space-y-3 sm:space-y-8">
        {/* Header: Title Fragments + Button Capture */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-3 sm:pb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h1 className="font-serif text-2xl sm:text-4xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
              Fragments
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#9C9388] dark:text-[#736C62]">
              {filteredFragments.length}
            </span>
          </div>

          <button
            onClick={() => openFragmentDrawer(null)}
            className="hidden md:flex px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs items-center gap-2 shrink-0"
          >
            <Feather size={15} />
            <span>Capture</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-2 sm:space-y-4">
          {/* Desktop Search & Filter Bar (md and up) */}
          <div className="hidden md:block space-y-4">
            {/* Desktop Search Box */}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-3.5 text-[#9C9388]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search thoughts, references, and ideas..."
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
                {categories.map((cat) => {
                  const isSelected = selectedType === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedType(cat.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                          : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center h-[36px] p-1 bg-white dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] shadow-2xs">
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid layout"
                    className={`px-2.5 h-full rounded-lg transition-colors flex items-center justify-center ${
                      viewMode === 'grid'
                        ? 'bg-[#F5EFEB] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C]'
                        : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                    }`}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="List layout"
                    className={`px-2.5 h-full rounded-lg transition-colors flex items-center justify-center ${
                      viewMode === 'list'
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
                      showFavoritesOnly || isFilterDropdownOpen
                        ? 'border-[#9A3412] dark:border-[#EA580C] bg-white dark:bg-[#1E1C1A] text-[#9A3412] dark:text-[#EA580C]'
                        : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422]'
                    }`}
                  >
                    <ArrowUpDown size={13} className="shrink-0 text-[#9C9388]" />
                    <span className="flex items-center gap-1.5">
                      {showFavoritesOnly && (
                        <Star size={12} fill="currentColor" className="text-[#B45309] dark:text-[#F59E0B]" />
                      )}
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
          <div className="md:hidden space-y-2">
            {/* Row 1: Centered Category Tabs Full-Width */}
            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="w-max min-w-full flex items-center justify-center">
                <div className="inline-flex items-center gap-0.5 p-1 bg-[#F5EFEB] dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
                  {categories.map((cat) => {
                    const isSelected = selectedType === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedType(cat.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                            : 'text-[#6B635B] dark:text-[#A8A196]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 2: Full-Width Search Input (when open) OR [Search Trigger] + [Grid|List] + [Fixed Filter/Sort] */}
            {isMobileSearchOpen || search ? (
              <div ref={mobileSearchRef} className="relative flex items-center">
                <Search size={15} className="absolute left-3.5 text-[#9C9388] pointer-events-none" />
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search fragments..."
                  className="w-full h-[36px] text-xs pl-9 pr-10 rounded-xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#9A3412] dark:border-[#EA580C] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setIsMobileSearchOpen(false);
                  }}
                  title="Close search"
                  className="absolute right-3 p-1 text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                {/* Search Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="flex-1 min-w-0 h-[36px] px-3 rounded-xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196] hover:text-[#9A3412] dark:hover:text-[#EA580C] text-xs font-medium flex items-center justify-start gap-2 transition-colors"
                  title="Search fragments"
                >
                  <Search size={13} className="shrink-0 text-[#9C9388]" />
                  <span className="truncate">Search</span>
                </button>

                {/* Grid/List Switcher + Fixed-Width Filter/Sort Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center h-[36px] p-1 bg-white dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] shadow-2xs">
                    <button
                      onClick={() => setViewMode('grid')}
                      title="Grid layout"
                      className={`px-2.5 h-full rounded-lg transition-colors flex items-center justify-center ${
                        viewMode === 'grid'
                          ? 'bg-[#F5EFEB] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C]'
                          : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                      }`}
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      title="List layout"
                      className={`px-2.5 h-full rounded-lg transition-colors flex items-center justify-center ${
                        viewMode === 'list'
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
                      className={`w-[126px] h-[36px] px-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-1.5 transition-colors shadow-2xs select-none ${
                        showFavoritesOnly || isFilterDropdownOpen
                          ? 'border-[#9A3412] dark:border-[#EA580C] bg-white dark:bg-[#1E1C1A] text-[#9A3412] dark:text-[#EA580C]'
                          : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        {showFavoritesOnly ? (
                          <Star size={12} fill="currentColor" className="shrink-0 text-[#B45309] dark:text-[#F59E0B]" />
                        ) : (
                          <ArrowUpDown size={13} className="shrink-0 text-[#9C9388]" />
                        )}
                        <span className="truncate">{getMobileSortLabel()}</span>
                      </span>
                      <ChevronDown
                        size={13}
                        className={`shrink-0 text-[#9C9388] transition-transform duration-200 ${
                          isFilterDropdownOpen ? 'rotate-180 text-[#9A3412] dark:text-[#EA580C]' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Shared Custom Filter/Sort Popover Content */}
          {isFilterDropdownOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-3 sm:right-8 lg:right-14 mt-1 w-56 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xl py-2 z-40 animate-in fade-in zoom-in-95 duration-150"
            >
                    {/* Filter Group */}
                    <div className="px-3.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
                      Filter Fragments
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowFavoritesOnly(false);
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-1.5 text-xs flex items-center justify-between hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                    >
                      <span className={!showFavoritesOnly ? 'font-medium text-[#9A3412] dark:text-[#EA580C]' : 'text-[#6B635B] dark:text-[#A8A196]'}>
                        All
                      </span>
                      {!showFavoritesOnly && (
                        <Check size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowFavoritesOnly(true);
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

                    <div className="h-px bg-[#E8E2D8]/70 dark:bg-[#2F2B28]/70 my-1.5" />

                    {/* Sort Order Group */}
                    <div className="px-3.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
                      Sort Order
                    </div>

                    {[
                      { id: 'recent', label: 'Added' },
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

        {/* Fragments Cards Showcase */}
        {filteredFragments.length === 0 ? (
          <div className="py-12 sm:py-20 px-4 sm:px-6 text-center border border-dashed border-[#E8E2D8] dark:border-[#2F2B28] rounded-3xl p-6 sm:p-8 bg-white/40 dark:bg-[#1E1C1A]/40 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mb-3.5">
              <Feather size={24} />
            </div>

            {fragments.length === 0 ? (
              <>
                <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Belum Ada Fragment Tersimpan
                </h3>
                <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-1.5 max-w-md leading-relaxed font-normal">
                  Tangkap kutipan buku, pengamatan singkat, atau inspirasi kilat dalam sekejap kapan saja.
                </p>
                <button
                  onClick={() => openFragmentDrawer(null)}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-2"
                >
                  <Feather size={14} />
                  <span>Capture Fragment Pertama</span>
                </button>
              </>
            ) : (
              <>
                <h3 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Tidak Ada Fragment yang Cocok
                </h3>
                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 max-w-sm">
                  Tidak ditemukan fragment dengan filter atau pencarian saat ini.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => {
                      setSearch('');
                      setSelectedType('all');
                      setShowFavoritesOnly(false);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] transition-colors"
                  >
                    Reset Filter
                  </button>
                  <button
                    onClick={() => openFragmentDrawer(null)}
                    className="px-4 py-1.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] transition-colors flex items-center gap-1.5"
                  >
                    <Feather size={13} />
                    <span>Capture Baru</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid Mode: 2 columns on mobile, 3 columns on tablet/desktop */
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
            {filteredFragments.map((fragment) => (
              <div
                key={fragment.id}
                onClick={() => openFragmentDrawer(fragment.id)}
                className="p-2.5 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] flex flex-col justify-between transition-all shadow-xs group cursor-pointer"
              >
                <div>
                  {/* Card Header (Category & Date unboxed) */}
                  <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-[#9C9388] dark:text-[#736C62] mb-1.5 sm:mb-2.5 gap-1">
                    <span className="uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C] font-semibold text-[10px] sm:text-[11px] shrink-0">
                      {fragment.type}
                    </span>
                    <span className="truncate">{formatDate(fragment.date)}</span>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-sm sm:text-base md:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] tracking-tight group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors line-clamp-2 leading-snug">
                    {fragment.title}
                  </h3>

                  {/* Body Content */}
                  <p className="text-[11px] sm:text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 sm:mt-2 leading-relaxed line-clamp-3 sm:line-clamp-4">
                    {fragment.content}
                  </p>
                </div>

                {/* Footer (Tags & Actions) */}
                <div className="mt-2.5 sm:mt-5 pt-1.5 sm:pt-3 border-t border-[#E8E2D8]/70 dark:border-[#2F2B28]/70 flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-[#9C9388]">
                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[#9C9388] font-mono truncate pr-1">
                    {fragment.tags && fragment.tags.length > 0 && (
                      <>
                        <span className="sm:hidden truncate">#{fragment.tags[0]}</span>
                        <span className="hidden sm:inline-flex items-center gap-1 truncate">
                          {fragment.tags.map((t, idx) => (
                            <span key={t} className="truncate">
                              #{t}
                              {idx < fragment.tags.length - 1 ? ' · ' : ''}
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleStarFragment(fragment.id)}
                      className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                        fragment.starred
                          ? 'text-[#B45309] dark:text-[#F59E0B]'
                          : 'text-[#9C9388] hover:text-[#221F1D]'
                      }`}
                      title={fragment.starred ? 'Favorited' : 'Add to Favorites'}
                    >
                      <Star size={13} className="sm:w-3.5 sm:h-3.5" fill={fragment.starred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => setFragmentIdToDelete(fragment.id)}
                      className="p-1 sm:p-1.5 rounded-lg text-[#9C9388] hover:text-red-600 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      title="Delete Fragment"
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
          <div className="space-y-2 sm:space-y-3">
            {filteredFragments.map((fragment) => (
              <div
                key={fragment.id}
                onClick={() => openFragmentDrawer(fragment.id)}
                className="p-3 sm:p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer group transition-all shadow-xs"
              >
                {/* Top Row: Category Type on left, Date + Actions on top-right */}
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span
                    className={`uppercase tracking-wider font-semibold text-[10px] sm:text-[11px] font-mono ${
                      fragment.type === 'reference'
                        ? 'text-[#1E3A8A] dark:text-[#60A5FA]'
                        : fragment.type === 'idea'
                        ? 'text-[#B45309] dark:text-[#F59E0B]'
                        : 'text-[#9A3412] dark:text-[#EA580C]'
                    }`}
                  >
                    {fragment.type || 'thought'}
                  </span>

                  <div
                    className="flex items-center gap-1.5 text-xs font-mono text-[#9C9388] dark:text-[#736C62] shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{formatDate(fragment.date)}</span>
                    <button
                      onClick={() => toggleStarFragment(fragment.id)}
                      className={`p-1 rounded-lg transition-colors ${
                        fragment.starred
                          ? 'text-[#B45309] dark:text-[#F59E0B]'
                          : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                      }`}
                      title={fragment.starred ? 'Favorited' : 'Add to Favorites'}
                    >
                      <Star size={14} fill={fragment.starred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => setFragmentIdToDelete(fragment.id)}
                      className="p-1 rounded-lg text-[#9C9388] hover:text-red-600 transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                      title="Delete Fragment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Title & Full-width Preview */}
                <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] tracking-tight group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors leading-snug">
                  {fragment.title || 'Untitled Fragment'}
                </h3>

                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed line-clamp-2">
                  {fragment.content || 'No content preview'}
                </p>

                {/* Bottom Row: Tags Only */}
                {fragment.tags && fragment.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#9C9388] dark:text-[#736C62] font-mono mt-2.5 pt-2 border-t border-[#E8E2D8]/50 dark:border-[#2F2B28]/50">
                    {fragment.tags.map((t, idx) => (
                      <span key={t}>
                        #{t}
                        {idx < fragment.tags.length - 1 ? ' ·' : ''}
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
        isOpen={Boolean(fragmentIdToDelete)}
        onClose={() => setFragmentIdToDelete(null)}
        onConfirm={() => {
          if (fragmentIdToDelete) {
            deleteFragment(fragmentIdToDelete);
            setFragmentIdToDelete(null);
          }
        }}
        itemType="fragment"
      />
    </div>
  );
};
