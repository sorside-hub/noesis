import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { ViewMode, ThemePreference, Note, Notebook, Relic, Fragment, Project, RelicType, FragmentType, NoteType } from '../types';
import { INITIAL_NOTES, INITIAL_NOTEBOOKS, INITIAL_FRAGMENTS, INITIAL_RELICS, INITIAL_PROJECTS } from '../data/mockData';
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
  createNote: (notebookId?: string, type?: NoteType) => string;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  discardNoteIfEmpty: (id: string) => boolean;
  toggleFavoriteNote: (id: string) => void;
  toggleArchiveNote: (id: string) => void;
  linkRelatedNote: (noteId: string, targetNoteId: string) => void;
  unlinkRelatedNote: (noteId: string, targetNoteId: string) => void;

  // Notebooks
  notebooks: Notebook[];
  createNotebook: (name: string, description?: string) => void;

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

  // Apply theme to HTML root
  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('noesis_theme', theme);

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }

    const mediaListener = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        root.classList.toggle('dark', e.matches);
      }
    };

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', mediaListener);
    return () => media.removeEventListener('change', mediaListener);
  }, [theme]);

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme);
  };

  // Views & Filter state
  const [activeView, setActiveView] = useState<ViewMode>('editor');
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState<boolean>(false);
  const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);
  const [isFragmentDrawerOpen, setIsFragmentDrawerOpen] = useState<boolean>(false);

  // Migration: clear out previously cached sample notes and fragments so user starts completely clean
  useEffect(() => {
    const hasCleanedSamples = localStorage.getItem('noesis_clean_empty_v2');
    if (!hasCleanedSamples) {
      localStorage.removeItem('noesis_notes');
      localStorage.removeItem('noesis_fragments');
      localStorage.removeItem('noesis_relics');
      localStorage.setItem('noesis_clean_empty_v2', 'true');
    }
  }, []);

  // Entities state with localStorage caching (Offline-First)
  const [notes, setNotes] = useState<Note[]>(() => {
    if (!localStorage.getItem('noesis_clean_empty_v2')) {
      return [];
    }
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
    return [];
  });

  const [notebooks, setNotebooks] = useState<Notebook[]>(() => {
    const saved = localStorage.getItem('noesis_notebooks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_NOTEBOOKS;
      }
    }
    return INITIAL_NOTEBOOKS;
  });

  const [fragments, setFragments] = useState<Fragment[]>(() => {
    if (!localStorage.getItem('noesis_clean_empty_v2')) {
      return [];
    }
    const saved = localStorage.getItem('noesis_fragments') || localStorage.getItem('noesis_relics');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed)
          ? parsed.map((f: any) => ({
              ...f,
              type: (f.type === 'thought' || f.type === 'reference' || f.type === 'idea') ? f.type : 'thought',
            }))
          : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const relics = fragments; // alias

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

  // Save changes locally (Offline-First storage)
  useEffect(() => {
    localStorage.setItem('noesis_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('noesis_notebooks', JSON.stringify(notebooks));
  }, [notebooks]);

  useEffect(() => {
    localStorage.setItem('noesis_fragments', JSON.stringify(fragments));
    localStorage.setItem('noesis_relics', JSON.stringify(fragments));
  }, [fragments]);

  // Supabase & Cloudflare AI status
  const isSupabaseConnected = isSupabaseConfigured();
  const isCloudflareConnected = isCloudflareAiConfigured();
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>(() => {
    return isSupabaseConfigured() ? 'syncing' : 'offline';
  });
  const embedTimersRef = useRef<Record<string, any>>({});

  // Multi-Device Synchronization: Supabase as authoritative source of truth
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSyncStatus('offline');
      return;
    }

    let isMounted = true;
    setSyncStatus('syncing');

    const initSupabase = async () => {
      try {
        const [dbNotes, dbFragments] = await Promise.all([
          fetchNotesFromSupabase(),
          fetchFragmentsFromSupabase(),
        ]);

        if (!isMounted) return;

        // When Supabase responds with data, it is authoritative across all devices
        if (dbNotes !== null) {
          setNotes(dbNotes);
          localStorage.setItem('noesis_notes', JSON.stringify(dbNotes));
          if (dbNotes.length > 0) {
            setActiveNoteId((prev) => (dbNotes.some((n) => n.id === prev) ? prev : dbNotes[0].id));
          } else {
            setActiveNoteId('');
          }
        }

        if (dbFragments !== null) {
          setFragments(dbFragments);
          localStorage.setItem('noesis_fragments', JSON.stringify(dbFragments));
        }

        setSyncStatus('synced');
      } catch (err) {
        console.warn('Initial Supabase fetch error:', err);
        if (isMounted) setSyncStatus('offline');
      }
    };

    initSupabase();

    // Subscribe to realtime database changes from other devices/tabs
    const unsubscribe = subscribeToRealtimeChanges(
      async () => {
        const latestNotes = await fetchNotesFromSupabase();
        if (latestNotes !== null && isMounted) {
          setNotes(latestNotes);
          localStorage.setItem('noesis_notes', JSON.stringify(latestNotes));
          if (latestNotes.length > 0) {
            setActiveNoteId((prev) => (latestNotes.some((n) => n.id === prev) ? prev : latestNotes[0].id));
          } else {
            setActiveNoteId('');
          }
        }
      },
      async () => {
        const latestFragments = await fetchFragmentsFromSupabase();
        if (latestFragments !== null && isMounted) {
          setFragments(latestFragments);
          localStorage.setItem('noesis_fragments', JSON.stringify(latestFragments));
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

  const createNote = (notebookId?: string, type?: NoteType): string => {
    const targetNotebook = notebookId || activeNotebookId || 'personal';
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: '',
      content: '<p></p>',
      excerpt: 'Begin writing your reflections...',
      type: type || 'thought',
      notebookId: targetNotebook,
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

    // Update notebook count
    setNotebooks((prev) =>
      prev.map((nb) => (nb.id === targetNotebook ? { ...nb, count: nb.count + 1 } : nb))
    );

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
    // Strip HTML tags and whitespace
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
      setNotebooks((prev) =>
        prev.map((nb) => (nb.id === target.notebookId ? { ...nb, count: Math.max(0, nb.count - 1) } : nb))
      );

      if (isSupabaseConfigured()) {
        deleteNoteFromSupabase(id).catch(console.warn);
      }
      return true;
    }
    return false;
  };

  const deleteNote = (id: string) => {
    const target = notes.find((n) => n.id === id);
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (remaining.length > 0) {
      setActiveNoteId(remaining[0].id);
    }
    if (target) {
      setNotebooks((prev) =>
        prev.map((nb) => (nb.id === target.notebookId ? { ...nb, count: Math.max(0, nb.count - 1) } : nb))
      );
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

  const createNotebook = (name: string, description?: string) => {
    const newNb: Notebook = {
      id: `nb-${Date.now()}`,
      name,
      count: 0,
      description,
    };
    setNotebooks((prev) => [...prev, newNb]);
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
      embedAndSyncFragment(newFragment).catch(console.warn);
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
      if (embedTimersRef.current[id]) {
        clearTimeout(embedTimersRef.current[id]);
      }
      embedTimersRef.current[id] = setTimeout(() => {
        if (updatedFragObj) {
          embedAndSyncFragment(updatedFragObj).catch(console.warn);
        }
      }, 1500);
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
          if (isSupabaseConfigured()) upsertFragmentToSupabase(updated).catch(console.warn);
          return updated;
        }
        return f;
      })
    );
  };

  // Backwards compatibility wrappers
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
        if (p.id !== projectId) return p;
        const updatedMilestones = p.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completed: !m.completed } : m
        );
        const completedCount = updatedMilestones.filter((m) => m.completed).length;
        const newProgress = Math.round((completedCount / updatedMilestones.length) * 100);
        return {
          ...p,
          milestones: updatedMilestones,
          progress: newProgress,
          status: newProgress === 100 ? 'completed' : p.status,
        };
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
      const ok = await embedAndSyncFragment(frag);
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
        notebooks,
        createNotebook,
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
