import React, { useState } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { RelicType } from '../types';
import {
  Feather,
  Search,
  LayoutGrid,
  List as ListIcon,
  Star,
  Plus,
  Trash2,
  X,
  Filter,
} from 'lucide-react';

export const CapturePage: React.FC = () => {
  const {
    relics,
    deleteRelic,
    toggleStarRelic,
    setIsQuickCaptureOpen,
  } = useNoesis();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredRelics = relics.filter((r) => {
    if (onlyStarred && !r.starred) return false;
    if (selectedType !== 'all' && r.type !== selectedType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchContent = r.content.toLowerCase().includes(q);
      const matchTags = r.tags.some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchContent || matchTags;
    }
    return true;
  });

  const categories = [
    { id: 'all', label: 'All Genres' },
    { id: 'memory', label: 'Memories' },
    { id: 'quote', label: 'Quotes' },
    { id: 'lesson', label: 'Lessons' },
    { id: 'object', label: 'Objects' },
    { id: 'idea', label: 'Ideas' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-6 sm:px-10 lg:px-14 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Numen-Inspired Header & Wordmark */}
        <div className="text-center sm:text-left border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
              Relics & Captures
            </h1>
            <p className="font-serif italic text-base sm:text-lg text-[#6B635B] dark:text-[#A8A196] mt-1">
              Collect. Reflect. Remember.
            </p>
          </div>

          <button
            onClick={() => setIsQuickCaptureOpen(true)}
            className="self-center sm:self-auto px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-2"
          >
            <Feather size={15} />
            <span>Capture New Relic</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-3.5 text-[#9C9388]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your relics, quotes, and memories..."
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

          {/* Controls Ribbon (Genre tabs, Star toggle, List/Grid toggle) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Genre Filter Tabs */}
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

            {/* View Mode & Star Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOnlyStarred((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                  onlyStarred
                    ? 'border-[#B45309] bg-[#FED7AA]/30 text-[#B45309] dark:text-[#F59E0B]'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                <Star size={13} fill={onlyStarred ? 'currentColor' : 'none'} />
                <span>Starred</span>
              </button>

              <div className="flex items-center p-1 bg-[#F5EFEB] dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid layout"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-[#272422] text-[#221F1D] dark:text-[#EDE8E1] shadow-xs'
                      : 'text-[#9C9388] hover:text-[#221F1D]'
                  }`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  title="List layout"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-[#272422] text-[#221F1D] dark:text-[#EDE8E1] shadow-xs'
                      : 'text-[#9C9388] hover:text-[#221F1D]'
                  }`}
                >
                  <ListIcon size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2 text-xs font-mono text-[#9C9388] dark:text-[#736C62]">
          <Feather size={14} className="text-[#9A3412]" />
          <span>
            {filteredRelics.length} {filteredRelics.length === 1 ? 'Relic' : 'Relics'} in your collection
          </span>
        </div>

        {/* Relics Cards Showcase */}
        {filteredRelics.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-[#E8E2D8] dark:border-[#2F2B28] rounded-2xl p-8">
            <Feather size={28} className="mx-auto text-[#9C9388] mb-2" />
            <p className="font-serif italic text-base text-[#6B635B] dark:text-[#A8A196]">
              No relics found matching this query.
            </p>
            <button
              onClick={() => setIsQuickCaptureOpen(true)}
              className="mt-3 text-xs text-[#9A3412] dark:text-[#EA580C] font-medium hover:underline inline-flex items-center gap-1"
            >
              <Plus size={13} /> Capture a new relic
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRelics.map((relic) => (
              <div
                key={relic.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] flex flex-col justify-between transition-all shadow-xs group"
              >
                <div>
                  {/* Card Header (Category & Date unboxed) */}
                  <div className="flex items-center justify-between text-xs font-mono text-[#9C9388] dark:text-[#736C62] mb-2.5">
                    <span className="uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C] font-semibold text-[11px]">
                      {relic.type}
                    </span>
                    <span>{relic.date}</span>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] tracking-tight group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors">
                    {relic.title}
                  </h3>

                  {/* Body Content */}
                  <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-2 leading-relaxed">
                    {relic.content}
                  </p>

                  {/* Optional Origin/Source */}
                  {relic.source && (
                    <p className="text-[11px] font-serif italic text-[#9C9388] dark:text-[#736C62] mt-2">
                      — {relic.source}
                    </p>
                  )}
                </div>

                {/* Footer (Tags & Actions) */}
                <div className="mt-5 pt-3 border-t border-[#E8E2D8]/70 dark:border-[#2F2B28]/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#9C9388] font-mono truncate">
                    {relic.tags.map((t, idx) => (
                      <span key={t}>
                        #{t}
                        {idx < relic.tags.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleStarRelic(relic.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        relic.starred
                          ? 'text-[#B45309] dark:text-[#F59E0B]'
                          : 'text-[#9C9388] hover:text-[#221F1D]'
                      }`}
                    >
                      <Star size={14} fill={relic.starred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => deleteRelic(relic.id)}
                      className="p-1.5 rounded-lg text-[#9C9388] hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRelics.map((relic) => (
              <div
                key={relic.id}
                className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-start justify-between gap-4 group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#9C9388] mb-1">
                    <span className="uppercase tracking-wider text-[#9A3412] font-semibold text-[11px]">
                      {relic.type}
                    </span>
                    <span>·</span>
                    <span>{relic.date}</span>
                    {relic.source && (
                      <>
                        <span>·</span>
                        <span className="italic">{relic.source}</span>
                      </>
                    )}
                  </div>

                  <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                    {relic.title}
                  </h3>

                  <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed">
                    {relic.content}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-[#9C9388] font-mono mt-2">
                    {relic.tags.map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleStarRelic(relic.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      relic.starred
                        ? 'text-[#B45309] dark:text-[#F59E0B]'
                        : 'text-[#9C9388] hover:text-[#221F1D]'
                    }`}
                  >
                    <Star size={15} fill={relic.starred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => deleteRelic(relic.id)}
                    className="p-1.5 rounded-lg text-[#9C9388] hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
