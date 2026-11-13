import React, { useState, useEffect, useMemo } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { Search, Feather, Star, X, Sparkles } from 'lucide-react';

export const StreamColumn: React.FC = () => {
  const {
    notes,
    activeNoteId,
    setActiveNoteId,
    activeStreamFilter,
    searchQuery,
    setSearchQuery,
    createNote,
    setActiveView,
    discardNoteIfEmpty,
    isSemanticSearch,
    setIsSemanticSearch,
    semanticThreshold,
    performSemanticNoteSearch,
  } = useNoesis();

  // Semantic matches map: noteId -> similarity
  const [semanticMatches, setSemanticMatches] = useState<Map<string, number>>(new Map());
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);

  // Debounced semantic search for Stream
  useEffect(() => {
    if (!isSemanticSearch || !searchQuery.trim()) {
      setSemanticMatches(new Map());
      setIsSearchingSemantic(false);
      return;
    }

    let isMounted = true;
    setIsSearchingSemantic(true);
    const timer = setTimeout(async () => {
      try {
        const results = await performSemanticNoteSearch(searchQuery);
        if (isMounted) {
          if (results && results.length > 0) {
            const map = new Map<string, number>();
            results.forEach((r) => map.set(r.id, r.similarity));
            setSemanticMatches(map);
          } else {
            setSemanticMatches(new Map());
          }
        }
      } catch (err) {
        console.warn('Semantic search error in StreamColumn:', err);
      } finally {
        if (isMounted) setIsSearchingSemantic(false);
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, isSemanticSearch, semanticThreshold]);

  // Filter notes based on active stream & search query
  const filteredNotes = useMemo(() => {
    const isSemanticActive = isSemanticSearch && searchQuery.trim().length > 0;

    let result = notes.filter((note) => {
      // Stream filtering
      if (activeStreamFilter === 'favorites') {
        if (!note.favorite) return false;
      } else if (activeStreamFilter === 'archived') {
        if (!note.archived) return false;
      } else {
        if (note.archived) return false;
      }

      // Semantic Search Match
      if (isSemanticActive) {
        return semanticMatches.has(note.id);
      }

      // Keyword query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = note.title.toLowerCase().includes(q);
        const matchExcerpt = note.excerpt.toLowerCase().includes(q);
        const matchTags = note.tags.some((t) => t.toLowerCase().includes(q));
        return matchTitle || matchExcerpt || matchTags;
      }

      return true;
    });

    if (isSemanticActive) {
      result.sort((a, b) => {
        const simA = semanticMatches.get(a.id) || 0;
        const simB = semanticMatches.get(b.id) || 0;
        return simB - simA;
      });
    }

    return result;
  }, [notes, activeStreamFilter, searchQuery, isSemanticSearch, semanticMatches]);

  const getStreamTitle = () => {
    if (activeStreamFilter === 'favorites') return 'Favorites';
    if (activeStreamFilter === 'archived') return 'Archived Notes';
    return 'All Notes';
  };

  const formatCardDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-80 lg:w-88 border-r border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB]/60 dark:bg-[#1A1817]/60 flex flex-col h-full shrink-0 select-none">
      {/* Stream Header */}
      <div className="p-4 border-b border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
            {getStreamTitle()}
          </h2>
          <p className="text-[11px] font-mono tabular-nums text-[#9C9388] dark:text-[#736C62] mt-0.5">
            {filteredNotes.length} {filteredNotes.length === 1 ? 'record' : 'records'}
          </p>
        </div>

        <button
          onClick={() => {
            if (activeNoteId) {
              discardNoteIfEmpty(activeNoteId);
            }
            const newId = createNote();
            setActiveNoteId(newId);
            setActiveView('editor');
          }}
          title="Compose New Note"
          className="p-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#9A3412] dark:text-[#EA580C] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] transition-colors shadow-xs"
        >
          <Feather size={16} />
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="p-3 border-b border-[#E8E2D8]/70 dark:border-[#2F2B28]/70 shrink-0">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-[#9C9388] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isSemanticSearch ? "Cari makna catatan..." : "Search notes and tags..."}
            className="w-full text-xs pl-8 pr-16 py-2 rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] transition-colors shadow-2xs"
          />
          <div className="absolute right-1.5 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSemanticSearch(!isSemanticSearch)}
              title={
                isSemanticSearch
                  ? "AI Semantic Search Aktif"
                  : "Aktifkan AI Semantic Search"
              }
              className={`px-1.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-0.5 transition-all select-none ${
                isSemanticSearch
                  ? 'bg-[#9A3412] dark:bg-[#EA580C] text-white font-medium shadow-2xs'
                  : 'bg-[#E8E2D8]/60 dark:bg-[#2A2624] text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D]'
              }`}
            >
              <Sparkles size={10} className={isSearchingSemantic ? 'animate-spin' : ''} />
              <span>AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notes Stream List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredNotes.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="font-serif italic text-sm text-[#9C9388] dark:text-[#736C62]">
              {isSemanticSearch && searchQuery.trim()
                ? 'Tidak ada catatan yang cocok dengan makna pencarian.'
                : 'No notes match your filter.'}
            </p>
            <button
              onClick={() => {
                if (activeNoteId) {
                  discardNoteIfEmpty(activeNoteId);
                }
                createNote();
              }}
              className="mt-3 text-xs text-[#9A3412] dark:text-[#EA580C] font-medium hover:underline inline-flex items-center gap-1"
            >
              <Feather size={12} /> Create a new note
            </button>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isSelected = note.id === activeNoteId;
            return (
              <div
                key={note.id}
                onClick={() => {
                  if (activeNoteId && activeNoteId !== note.id) {
                    discardNoteIfEmpty(activeNoteId);
                  }
                  setActiveNoteId(note.id);
                  setActiveView('editor');
                }}
                className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-white dark:bg-[#221F1E] border-[#D6CEBE] dark:border-[#443E3A] shadow-xs'
                    : 'bg-transparent hover:bg-white/60 dark:hover:bg-[#221F1E]/60 border-transparent hover:border-[#E8E2D8] dark:hover:border-[#2F2B28]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`font-serif text-sm font-medium tracking-tight line-clamp-1 ${
                      isSelected
                        ? 'text-[#221F1D] dark:text-[#EDE8E1]'
                        : 'text-[#221F1D]/90 dark:text-[#EDE8E1]/90'
                    }`}
                  >
                    {note.title || 'Untitled Note'}
                  </h3>
                  {note.favorite && (
                    <Star
                      size={12}
                      className="text-[#B45309] dark:text-[#F59E0B] fill-current shrink-0 mt-0.5"
                    />
                  )}
                </div>

                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-2 mt-1 leading-relaxed">
                  {note.excerpt || 'No additional text'}
                </p>

                {/* Unboxed Metadata with Typographic Separator */}
                <div className="flex items-center gap-1.5 text-[11px] text-[#9C9388] dark:text-[#736C62] mt-2 font-mono flex-wrap">
                  <span className="uppercase text-[10px] text-[#9A3412] dark:text-[#EA580C] font-semibold">{note.type || 'thought'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatCardDate(note.updatedAt || note.createdAt)}</span>
                  {isSemanticSearch && searchQuery.trim() && semanticMatches.has(note.id) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#9A3412] dark:text-[#EA580C] font-semibold flex items-center gap-0.5">
                        <Sparkles size={9} />
                        {Math.round((semanticMatches.get(note.id) || 0) * 100)}% match
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
