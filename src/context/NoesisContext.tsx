import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { ViewMode, ThemePreference, Note, Relic, Fragment, Project, RelicType, FragmentType, NoteType, StreamFilter } from '../types';
import { INITIAL_NOTES, INITIAL_FRAGMENTS, INITIAL_RELICS, INITIAL_PROJECTS } from '../data/mockData';
import {
  isSupabaseConfigured,
  fetchNotesFromSupabase,
  upsertNoteToSupabase,
  deleteNoteFromSupabase,
  fetchFragmentsFromSupabase,
  upsertFragmentToSupabase,
  deleteFragmentFromSupabase,
  subscribeToRealtimeChanges,
} from '../lib/supabase';
import {
  isCloudflareAiConfigured,
  embedAndSyncNote,
  embedAndSyncFragment,
} from '../lib/cloudflareEmbedding';

interface NoesisContextType {
  // Theme
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  // Navigation
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  activeStreamFilter: StreamFilter;
  setActiveStreamFilter: (filter: StreamFilter) => void;
  // Backward compatibility alias for stream filter
  activeNotebookId: string | null;
  setActiveNotebookId: (id: string | null) => void;

  activeNoteId: string;
  setActiveNoteId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (open: boolean) => void;
  isQuickCaptureOpen: boolean;
  setIsQuickCaptureOpen: (open: boolean) => void;

  // Notes
  notes: Note[];
  activeNote: Note | undefined;
  createNote: (type?: NoteType) => string;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  discardNoteIfEmpty: (id: string) => boolean;
  toggleFavoriteNote: (id: string) => void;
  toggleArchiveNote: (id: string) => void;
  linkRelatedNote: (noteId: string, targetNoteId: string) => void;
  unlinkRelatedNote: (noteId: string, targetNoteId: string) => void;

  // Fragments (Micro-notes & Captures)
  fragments: Fragment[];
  relics: Fragment[]; // alias for backward-compatibility
  activeFragmentId: string | null;
  setActiveFragmentId: (id: string | null) => void;
  isFragmentDrawerOpen: boolean;
  openFragmentDrawer: (fragmentId?: string | null) => void;
  closeFragmentDrawer: () => void;
  createFragment: (data: { type: FragmentType; title: string; content: string; tags: string[]; source?: string }) => string;
  updateFragment: (id: string, updates: Partial<Fragment>) => void;
  deleteFragment: (id: string) => void;
  toggleStarFragment: (id: string) => void;
  createRelic: (data: { type: RelicType; title: string; content: string; tags: string[]; source?: string }) => void;
  deleteRelic: (id: string) => void;
  toggleStarRelic: (id: string) => void;

  // Projects
  projects: Project[];
  toggleProjectMilestone: (projectId: string, milestoneId: string) => void;

  // Supabase & Embedding Integration
  isSupabaseConnected: boolean;
  isCloudflareConnected: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  syncAllToSupabase: () => Promise<{ success: boolean; notesCount: number; fragmentsCount: number }>;
  manualEmbedNote: (noteId: string) => Promise<boolean>;
  manualRemoveEmbedNote: (noteId: string) => Promise<boolean>;
  manualEmbedFragment: (fragmentId: string) => Promise<boolean>;
  manualRemoveEmbedFragment: (fragmentId: string) => Promise<boolean>;
}

const NoesisContext = createContext<NoesisContextType | undefined>(undefined);

export const NoesisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('noesis_theme');
    return (saved as ThemePreference) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('noesis_theme', theme);
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && mediaQuery.matches);

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Dynamic browser & mobile status bar color (#FAF7F2 for light, #151413 for dark)
      const themeColor = isDark ? '#151413' : '#FAF7F2';
      const metaThemeElements = document.querySelectorAll('meta[name="theme-color"]');
      metaThemeElements.forEach((el) => {
        el.setAttribute('content', themeColor);
      });
      if (metaThemeElements.length === 0) {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = themeColor;
        document.head.appendChild(meta);
      }
    };

    applyTheme();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme);
  };

  // Views & Filter state
  const [activeView, setActiveView] = useState<ViewMode>('editor');
  const [activeStreamFilter, setActiveStreamFilter] = useState<StreamFilter>('all');
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState<boolean>(false);
  const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);
  const [isFragmentDrawerOpen, setIsFragmentDrawerOpen] = useState<boolean>(false);

  // Backward compatibility alias for activeNotebookId
  const activeNotebookId = activeStreamFilter === 'all' ? null : activeStreamFilter;
  const setActiveNotebookId = (id: string | null) => {
    if (id === 'favorites') setActiveStreamFilter('favorites');
    else if (id === 'archived') setActiveStreamFilter('archived');
    else setActiveStreamFilter('all');
  };

  // Entities state with localStorage caching (Offline-First)
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('noesis_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed)
          ? parsed.filter((n: any) => {
              const hasTitle = Boolean(n.title && n.title.trim().length > 0);
              const plainContent = (n.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
              return hasTitle || plainContent.length > 0;
            }).map((n: any) => ({
              ...n,
              type: n.type || 'thought',
              relatedNoteIds: Array.isArray(n.relatedNoteIds) ? n.relatedNoteIds : [],
            }))
          : [];
      } catch {
        return [];
      }
    }
    return INITIAL_NOTES;
  });

  const [fragments, setFragments] = useState<Fragment[]>(() => {
    const saved = localStorage.getItem('noesis_fragments') || localStorage.getItem('noesis_relics');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return INITIAL_FRAGMENTS;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('noesis_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_PROJECTS;
      }
    }
    return INITIAL_PROJECTS;
  });

  // Sync statuses
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(isSupabaseConfigured());
  const [isCloudflareConnected, setIsCloudflareConnected] = useState<boolean>(isCloudflareAiConfigured());
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');

  // Debounce ref for auto-embedding notes
  const embedTimersRef = useRef<{ [noteId: string]: NodeJS.Timeout }>({});

  // Sync entities to localStorage on state changes
  useEffect(() => {
    localStorage.setItem('noesis_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('noesis_fragments', JSON.stringify(fragments));
    localStorage.setItem('noesis_relics', JSON.stringify(fragments));
  }, [fragments]);

  useEffect(() => {
    localStorage.setItem('noesis_projects', JSON.stringify(projects));
  }, [projects]);

  // Initial Supabase Sync & Realtime Listeners
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let isMounted = true;
    const initSupabaseSync = async () => {
      try {
        const [dbNotes, dbFragments] = await Promise.all([
          fetchNotesFromSupabase(),
          fetchFragmentsFromSupabase(),
        ]);

        if (dbNotes !== null && isMounted) {
          setNotes(dbNotes);
          if (dbNotes.length > 0 && !activeNoteId) {
            setActiveNoteId(dbNotes[0].id);
          }
        }

        if (dbFragments !== null && isMounted) {
          setFragments(dbFragments);
        }

        setIsSupabaseConnected(true);
      } catch (err) {
        console.warn('Initial Supabase sync failed, using offline cache:', err);
      }
    };

    initSupabaseSync();

    // Subscribe to realtime changes
    const unsubscribe = subscribeToRealtimeChanges(
      async () => {
        const latestNotes = await fetchNotesFromSupabase();
        if (latestNotes !== null && isMounted) {
          setNotes(latestNotes);
        }
      },
      async () => {
        const latestFragments = await fetchFragmentsFromSupabase();
        if (latestFragments !== null && isMounted) {
          setFragments(latestFragments);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || notes[0];
  }, [notes, activeNoteId]);

  // Handlers
  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  const createNote = (type?: NoteType): string => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: '',
      content: '<p></p>',
      excerpt: 'Begin writing your reflections...',
      type: type || 'thought',
      tags: ['reflection'],
      favorite: false,
      archived: false,
      relatedNoteIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wordCount: 0,
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setActiveView('editor');

    if (isSupabaseConfigured()) {
      upsertNoteToSupabase(newNote).catch(console.warn);
    }

    return newNote.id;
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    const updatedAt = new Date().toISOString();
    let updatedObj: Note | undefined;

    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, ...updates, updatedAt };
          updatedObj = updated;
          return updated;
        }
        return n;
      })
    );

    if (isSupabaseConfigured() && updatedObj) {
      if (embedTimersRef.current[id]) {
        clearTimeout(embedTimersRef.current[id]);
      }
      embedTimersRef.current[id] = setTimeout(() => {
        if (updatedObj) {
          embedAndSyncNote(updatedObj).catch(console.warn);
        }
      }, 1500);
    }
  };

  const linkRelatedNote = (noteId: string, targetNoteId: string) => {
    if (noteId === targetNoteId) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === noteId && !n.relatedNoteIds.includes(targetNoteId)) {
          const updated = { ...n, relatedNoteIds: [...n.relatedNoteIds, targetNoteId] };
          if (isSupabaseConfigured()) upsertNoteToSupabase(updated).catch(console.warn);
          return updated;
        }
        if (n.id === targetNoteId && !n.relatedNoteIds.includes(noteId)) {
          const updated = { ...n, relatedNoteIds: [...n.relatedNoteIds, noteId] };
          if (isSupabaseConfigured()) upsertNoteToSupabase(updated).catch(console.warn);
          return updated;
        }
        return n;
      })
    );
  };

  const unlinkRelatedNote = (noteId: string, targetNoteId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === noteId) {
          const updated = { ...n, relatedNoteIds: n.relatedNoteIds.filter((id) => id !== targetNoteId) };
          if (isSupabaseConfigured()) upsertNoteToSupabase(updated).catch(console.warn);
          return updated;
        }
        if (n.id === targetNoteId) {
          const updated = { ...n, relatedNoteIds: n.relatedNoteIds.filter((id) => id !== noteId) };
          if (isSupabaseConfigured()) upsertNoteToSupabase(updated).catch(console.warn);
          return updated;
        }
        return n;
      })
    );
  };

  const isNoteEffectivelyEmpty = (note: Note): boolean => {
    const hasTitle = Boolean(note.title && note.title.trim().length > 0);
    const plainText = (note.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return !hasTitle && plainText.length === 0;
  };

  const discardNoteIfEmpty = (id: string): boolean => {
    const target = notes.find((n) => n.id === id);
    if (!target) return false;
    if (isNoteEffectivelyEmpty(target)) {
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      if (activeNoteId === id && remaining.length > 0) {
        setActiveNoteId(remaining[0].id);
      }

      if (isSupabaseConfigured()) {
        deleteNoteFromSupabase(id).catch(console.warn);
      }
      return true;
    }
    return false;
  };

  const deleteNote = (id: string) => {
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (remaining.length > 0) {
      setActiveNoteId(remaining[0].id);
    }

    if (isSupabaseConfigured()) {
      deleteNoteFromSupabase(id).catch(console.warn);
    }
  };

  const toggleFavoriteNote = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, favorite: !n.favorite };
          if (isSupabaseConfigured()) upsertNoteToSupabase(updated).catch(console.warn);
          return updated;
        }
        return n;
      })
    );
  };

  const toggleArchiveNote = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, archived: !n.archived };
          if (isSupabaseConfigured()) upsertNoteToSupabase(updated).catch(console.warn);
          return updated;
        }
        return n;
      })
    );
  };

  const openFragmentDrawer = (fragmentId?: string | null) => {
    setActiveFragmentId(fragmentId ?? null);
    setIsFragmentDrawerOpen(true);
    setIsQuickCaptureOpen(true);
  };

  const closeFragmentDrawer = () => {
    setIsFragmentDrawerOpen(false);
    setActiveFragmentId(null);
    setIsQuickCaptureOpen(false);
  };

  const formatDateDDMMYYYY = (d: Date = new Date()) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const createFragment = (data: { type: FragmentType; title: string; content: string; tags: string[]; source?: string }): string => {
    const id = `fragment-${Date.now()}`;
    const newFragment: Fragment = {
      id,
      type: data.type,
      title: data.title || 'Untitled Fragment',
      content: data.content,
      tags: data.tags,
      source: data.source,
      date: formatDateDDMMYYYY(),
      starred: false,
    };
    setFragments((prev) => [newFragment, ...prev]);

    if (isSupabaseConfigured()) {
      upsertFragmentToSupabase(newFragment, null).catch(console.warn);
    }

    return id;
  };

  const updateFragment = (id: string, updates: Partial<Fragment>) => {
    let updatedFragObj: Fragment | undefined;
    setFragments((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updated = { ...f, ...updates };
          updatedFragObj = updated;
          return updated;
        }
        return f;
      })
    );

    if (isSupabaseConfigured() && updatedFragObj) {
      upsertFragmentToSupabase(updatedFragObj, null).catch(console.warn);
    }
  };

  const deleteFragment = (id: string) => {
    setFragments((prev) => prev.filter((f) => f.id !== id));
    if (activeFragmentId === id) {
      closeFragmentDrawer();
    }
    if (isSupabaseConfigured()) {
      deleteFragmentFromSupabase(id).catch(console.warn);
    }
  };

  const toggleStarFragment = (id: string) => {
    setFragments((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updated = { ...f, starred: !f.starred };
          if (isSupabaseConfigured()) upsertFragmentToSupabase(updated, null).catch(console.warn);
          return updated;
        }
        return f;
      })
    );
  };

  const createRelic = (data: { type: RelicType; title: string; content: string; tags: string[]; source?: string }) => {
    createFragment(data);
  };

  const deleteRelic = (id: string) => {
    deleteFragment(id);
  };

  const toggleStarRelic = (id: string) => {
    toggleStarFragment(id);
  };

  const toggleProjectMilestone = (projectId: string, milestoneId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const updatedMilestones = p.milestones.map((m) =>
            m.id === milestoneId ? { ...m, completed: !m.completed } : m
          );
          const completedCount = updatedMilestones.filter((m) => m.completed).length;
          const progress = Math.round((completedCount / updatedMilestones.length) * 100);
          return { ...p, milestones: updatedMilestones, progress };
        }
        return p;
      })
    );
  };

  // Push all existing local notes & fragments to Supabase
  const syncAllToSupabase = async () => {
    if (!isSupabaseConfigured()) {
      return { success: false, notesCount: 0, fragmentsCount: 0 };
    }
    setSyncStatus('syncing');
    let notesCount = 0;
    let fragmentsCount = 0;

    for (const note of notes) {
      const ok = await embedAndSyncNote(note);
      if (ok) notesCount++;
    }

    for (const frag of fragments) {
      const ok = await upsertFragmentToSupabase(frag, null);
      if (ok) fragmentsCount++;
    }

    setSyncStatus('synced');
    return { success: true, notesCount, fragmentsCount };
  };

  // Manual embed single note
  const manualEmbedNote = async (noteId: string): Promise<boolean> => {
    const target = notes.find((n) => n.id === noteId);
    if (!target) return false;
    const ok = await embedAndSyncNote(target);
    if (ok) {
      const nowIso = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, embeddedAt: nowIso } : n))
      );
    }
    return ok;
  };

  // Manual remove embed for note
  const manualRemoveEmbedNote = async (noteId: string): Promise<boolean> => {
    const target = notes.find((n) => n.id === noteId);
    if (!target) return false;
    if (isSupabaseConfigured()) {
      const ok = await upsertNoteToSupabase({ ...target, embeddedAt: undefined }, null);
      if (ok) {
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, embeddedAt: undefined } : n))
        );
      }
      return ok;
    }
    return true;
  };

  // Manual embed single fragment
  const manualEmbedFragment = async (fragmentId: string): Promise<boolean> => {
    const target = fragments.find((f) => f.id === fragmentId);
    if (!target) return false;
    const ok = await embedAndSyncFragment(target);
    if (ok) {
      const nowIso = new Date().toISOString();
      setFragments((prev) =>
        prev.map((f) => (f.id === fragmentId ? { ...f, embeddedAt: nowIso } : f))
      );
    }
    return ok;
  };

  // Manual remove embed for fragment
  const manualRemoveEmbedFragment = async (fragmentId: string): Promise<boolean> => {
    const target = fragments.find((f) => f.id === fragmentId);
    if (!target) return false;
    if (isSupabaseConfigured()) {
      const ok = await upsertFragmentToSupabase({ ...target, embeddedAt: undefined }, null);
      if (ok) {
        setFragments((prev) =>
          prev.map((f) => (f.id === fragmentId ? { ...f, embeddedAt: undefined } : f))
        );
      }
      return ok;
    }
    return true;
  };

  return (
    <NoesisContext.Provider
      value={{
        theme,
        setTheme,
        activeView,
        setActiveView,
        activeStreamFilter,
        setActiveStreamFilter,
        activeNotebookId,
        setActiveNotebookId,
        activeNoteId,
        setActiveNoteId,
        searchQuery,
        setSearchQuery,
        selectedTag,
        setSelectedTag,
        isSidebarCollapsed,
        toggleSidebar,
        isMobileDrawerOpen,
        setIsMobileDrawerOpen,
        isQuickCaptureOpen,
        setIsQuickCaptureOpen,
        activeFragmentId,
        setActiveFragmentId,
        isFragmentDrawerOpen,
        openFragmentDrawer,
        closeFragmentDrawer,
        notes,
        activeNote,
        createNote,
        updateNote,
        deleteNote,
        discardNoteIfEmpty,
        toggleFavoriteNote,
        toggleArchiveNote,
        linkRelatedNote,
        unlinkRelatedNote,
        fragments,
        relics: fragments,
        createFragment,
        updateFragment,
        deleteFragment,
        toggleStarFragment,
        createRelic,
        deleteRelic,
        toggleStarRelic,
        projects,
        toggleProjectMilestone,
        isSupabaseConnected,
        isCloudflareConnected,
        syncStatus,
        syncAllToSupabase,
        manualEmbedNote,
        manualRemoveEmbedNote,
        manualEmbedFragment,
        manualRemoveEmbedFragment,
      }}
    >
      {children}
    </NoesisContext.Provider>
  );
};

export const useNoesis = () => {
  const context = useContext(NoesisContext);
  if (!context) {
    throw new Error('useNoesis must be used within a NoesisProvider');
  }
  return context;
};
