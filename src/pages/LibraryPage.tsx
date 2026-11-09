import React, { useState, useMemo } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { NoteType } from '../types';
import {
  BookOpen,
  Search,
  Plus,
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
} from 'lucide-react';

export const LibraryPage: React.FC = () => {
  const {
    notes,
    activeNotebookId,
    setActiveNotebookId,
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
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);

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

  return (
    <div
      className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-6 sm:px-10 lg:px-14 py-8"
      onClick={() => setActiveMenuNoteId(null)}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Row */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9A3412] dark:text-[#EA580C]">
              Archival Repository
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] mt-1">
              Knowledge Library
            </h1>
            <p className="text-sm text-[#6B635B] dark:text-[#A8A196] mt-1 max-w-xl">
              Central catalog of your personal knowledge: references, structured thoughts, and creative premises.
            </p>
          </div>

          <button
            onClick={handleCreateNew}
            className="px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-2 self-start sm:self-auto shrink-0"
          >
            <Plus size={15} />
            <span>New Note</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-4">
          {/* Search Box */}
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

          {/* Filter Ribbon: Note Type tabs, Status, Sort & Layout Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Note Type Segmented Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F5EFEB] dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
              {[
                { id: 'all', label: 'All Notes' },
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

            {/* Quick Status Toggles & Sorting */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Favorites toggle */}
              <button
                onClick={() => setShowFavoritesOnly((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                  showFavoritesOnly
                    ? 'border-[#B45309] bg-[#FED7AA]/30 text-[#B45309] dark:text-[#F59E0B]'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                <Star size={13} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
                <span>Favorites</span>
              </button>

              {/* Archive toggle */}
              <button
                onClick={() => setShowArchivedOnly((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                  showArchivedOnly
                    ? 'border-[#221F1D] bg-[#221F1D] text-white dark:border-[#EDE8E1] dark:bg-[#EDE8E1] dark:text-[#151413]'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                <Archive size={13} />
                <span>Archive</span>
              </button>

              {/* Sort Dropdown */}
              <div className="relative flex items-center bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl px-2.5 py-1 text-xs">
                <ArrowUpDown size={13} className="text-[#9C9388] mr-1.5 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-[#6B635B] dark:text-[#A8A196] focus:outline-none cursor-pointer pr-1"
                >
                  <option value="updated">Recently Updated</option>
                  <option value="created">Date Created</option>
                  <option value="alpha">Alphabetical (A–Z)</option>
                </select>
              </div>

              {/* Layout Toggle (Grid vs List) */}
              <div className="flex items-center p-1 bg-[#F5EFEB] dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
                <button
                  onClick={() => setViewLayout('grid')}
                  title="Grid View"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewLayout === 'grid'
                      ? 'bg-white dark:bg-[#272422] text-[#221F1D] dark:text-[#EDE8E1] shadow-xs'
                      : 'text-[#9C9388] hover:text-[#221F1D]'
                  }`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewLayout('list')}
                  title="List View"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewLayout === 'list'
                      ? 'bg-white dark:bg-[#272422] text-[#221F1D] dark:text-[#EDE8E1] shadow-xs'
                      : 'text-[#9C9388] hover:text-[#221F1D]'
                  }`}
                >
                  <ListIcon size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Tags Filter Row */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] shrink-0 mr-1">
                Tags:
              </span>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag((prev) => (prev === tag ? null : tag))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors shrink-0 ${
                    selectedTag === tag
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'bg-[#F5EFEB] dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(null)}
                  className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline shrink-0 ml-1 font-medium"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* Counter & Status Header */}
        <div className="flex items-center justify-between text-xs font-mono text-[#9C9388] dark:text-[#736C62]">
          <span>
            Showing {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
            {showArchivedOnly && ' (Archived)'}
          </span>
          {showArchivedOnly && (
            <button
              onClick={() => setShowArchivedOnly(false)}
              className="text-[#9A3412] dark:text-[#EA580C] hover:underline"
            >
              Exit Archive View
            </button>
          )}
        </div>

        {/* Notes Grid or List Layout */}
        {filteredNotes.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-[#E8E2D8] dark:border-[#2F2B28] rounded-2xl p-8">
            <BookOpen size={28} className="mx-auto text-[#9C9388] mb-2" />
            <p className="font-serif italic text-base text-[#6B635B] dark:text-[#A8A196]">
              No notes found in your library matching this filter.
            </p>
            <button
              onClick={handleCreateNew}
              className="mt-3 text-xs text-[#9A3412] dark:text-[#EA580C] font-medium hover:underline inline-flex items-center gap-1"
            >
              <Plus size={13} /> Compose a new note
            </button>
          </div>
        ) : viewLayout === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredNotes.map((note) => {
              const formattedDate = new Date(note.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });
              const isMenuOpen = activeMenuNoteId === note.id;

              return (
                <div
                  key={note.id}
                  onClick={() => handleOpenNote(note.id)}
                  className="p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all shadow-xs flex flex-col justify-between group relative"
                >
                  <div>
                    {/* Top Row: Type indicator & Date unboxed */}
                    <div className="flex items-center justify-between text-xs font-mono text-[#9C9388] dark:text-[#736C62] mb-2.5">
                      <span
                        className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded border ${getTypeStyle(
                          note.type || 'thought'
                        )}`}
                      >
                        {note.type || 'thought'}
                      </span>
                      <span>{formattedDate}</span>
                    </div>

                    {/* Note Title */}
                    <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] tracking-tight group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors line-clamp-2">
                      {note.title || 'Untitled Note'}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-3 mt-2 leading-relaxed">
                      {note.excerpt || 'No additional content'}
                    </p>

                    {/* Source / Provenance if present */}
                    {note.source && (
                      <p className="text-[11px] font-serif italic text-[#9C9388] dark:text-[#736C62] mt-2 truncate">
                        — {note.source}
                      </p>
                    )}
                  </div>

                  {/* Bottom Footer: Tags, Related Links & Action Menu */}
                  <div className="mt-5 pt-3 border-t border-[#E8E2D8]/70 dark:border-[#2F2B28]/70 flex items-center justify-between text-[11px] font-mono text-[#9C9388]">
                    <div className="flex items-center gap-1.5 truncate pr-2">
                      {note.relatedNoteIds && note.relatedNoteIds.length > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-[#9A3412] dark:text-[#EA580C]"
                          title={`${note.relatedNoteIds.length} related notes linked`}
                        >
                          <Link2 size={11} />
                          <span>{note.relatedNoteIds.length}</span>
                          <span className="text-[#9C9388]">·</span>
                        </span>
                      )}

                      {note.tags && note.tags.length > 0 ? (
                        note.tags.slice(0, 2).map((t, idx) => (
                          <span key={t}>
                            #{t}
                            {idx === 0 && note.tags.length > 1 ? ' · ' : ''}
                          </span>
                        ))
                      ) : (
                        <span>{note.wordCount} words</span>
                      )}
                    </div>

                    {/* Actions Menu */}
                    <div
                      className="flex items-center gap-1 shrink-0 relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => toggleFavoriteNote(note.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          note.favorite
                            ? 'text-[#B45309] dark:text-[#F59E0B]'
                            : 'text-[#9C9388] hover:text-[#221F1D]'
                        }`}
                        title="Toggle Favorite"
                      >
                        <Star size={14} fill={note.favorite ? 'currentColor' : 'none'} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuNoteId(isMenuOpen ? null : note.id);
                        }}
                        className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]"
                        title="Options"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 bottom-8 w-44 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xl py-1.5 z-30">
                          <button
                            onClick={() => {
                              toggleArchiveNote(note.id);
                              setActiveMenuNoteId(null);
                            }}
                            className="w-full px-3 py-1.5 text-xs flex items-center gap-2 text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                          >
                            <Archive size={13} />
                            <span>{note.archived ? 'Unarchive' : 'Archive Note'}</span>
                          </button>
                          <button
                            onClick={() => {
                              deleteNote(note.id);
                              setActiveMenuNoteId(null);
                            }}
                            className="w-full px-3 py-1.5 text-xs flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-left transition-colors border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60"
                          >
                            <Trash2 size={13} />
                            <span>Delete Note</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Layout */
          <div className="space-y-2.5">
            {filteredNotes.map((note) => {
              const formattedDate = new Date(note.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });
              const isMenuOpen = activeMenuNoteId === note.id;

              return (
                <div
                  key={note.id}
                  onClick={() => handleOpenNote(note.id)}
                  className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group relative"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono text-[#9C9388] mb-1">
                      <span
                        className={`text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded border ${getTypeStyle(
                          note.type || 'thought'
                        )}`}
                      >
                        {note.type || 'thought'}
                      </span>
                      <span>·</span>
                      <span>{formattedDate}</span>
                      {note.source && (
                        <>
                          <span>·</span>
                          <span className="italic truncate max-w-xs">{note.source}</span>
                        </>
                      )}
                    </div>

                    <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors truncate">
                      {note.title || 'Untitled Note'}
                    </h3>

                    <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-1 mt-0.5">
                      {note.excerpt || 'No content preview'}
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8E2D8]/60"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-mono text-[#9C9388]">
                      {note.relatedNoteIds && note.relatedNoteIds.length > 0 && (
                        <span className="text-[#9A3412] dark:text-[#EA580C] mr-1">
                          {note.relatedNoteIds.length} related
                        </span>
                      )}
                      <span>{note.wordCount} words</span>
                    </div>

                    <button
                      onClick={() => toggleFavoriteNote(note.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        note.favorite
                          ? 'text-[#B45309] dark:text-[#F59E0B]'
                          : 'text-[#9C9388] hover:text-[#221F1D]'
                      }`}
                    >
                      <Star size={14} fill={note.favorite ? 'currentColor' : 'none'} />
                    </button>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuNoteId(isMenuOpen ? null : note.id);
                        }}
                        className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D]"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 bottom-8 w-44 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xl py-1.5 z-30">
                          <button
                            onClick={() => {
                              toggleArchiveNote(note.id);
                              setActiveMenuNoteId(null);
                            }}
                            className="w-full px-3 py-1.5 text-xs flex items-center gap-2 text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                          >
                            <Archive size={13} />
                            <span>{note.archived ? 'Unarchive' : 'Archive Note'}</span>
                          </button>
                          <button
                            onClick={() => {
                              deleteNote(note.id);
                              setActiveMenuNoteId(null);
                            }}
                            className="w-full px-3 py-1.5 text-xs flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-left transition-colors border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60"
                          >
                            <Trash2 size={13} />
                            <span>Delete Note</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
