import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  ViewMode,
  ThemePreference,
  Note,
  Relic,
  Fragment,
  Project,
  RelicType,
  FragmentType,
  NoteType,
  StreamFilter,
  DiscoverSourceItem,
  ConnectionAnalysis,
  DiscoverConnectionRecord,
} from '../types';
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
  searchNotesSemantic,
  searchFragmentsSemantic,
  fetchDiscoverConnectionsFromSupabase,
  upsertDiscoverConnectionToSupabase,
  restoreDismissedDiscoverConnectionsInSupabase,
  unlinkDiscoverConnectionInSupabase,
} from '../lib/supabase';
import {
  isCloudflareAiConfigured,
  embedAndSyncNote,
  embedAndSyncFragment,
  generateBgeM3Embedding,
  cleanTextForEmbedding,
} from '../lib/cloudflareEmbedding';
import {
  makePairKey,
  noteToDiscoverItem,
  fragmentToDiscoverItem,
} from '../lib/discoverAi';

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

  // AI Semantic Search & Controls
  isSemanticSearch: boolean;
  setIsSemanticSearch: (active: boolean) => void;
  semanticSensitivity: 'broad' | 'standard' | 'strict';
  setSemanticSensitivity: (sensitivity: 'broad' | 'standard' | 'strict') => void;
  semanticThreshold: number;
  performSemanticNoteSearch: (query: string) => Promise<{ id: string; similarity: number }[] | null>;

  // Discover & Synthesis Foundation
  dismissedConnections: string[];
  approvedConnections: string[];
  connectionAnalyses: Record<string, ConnectionAnalysis>;
  dismissConnection: (itemA: DiscoverSourceItem, itemB: DiscoverSourceItem) => void;
  approveConnection: (itemA: DiscoverSourceItem, itemB: DiscoverSourceItem) => void;
  saveConnectionAnalysis: (
    itemA: DiscoverSourceItem,
    itemB: DiscoverSourceItem,
    analysis: ConnectionAnalysis
  ) => void;
  unlinkDiscoverConnection: (idA: string, idB: string) => void;
  promoteFragmentToNote: (fragmentId: string) => string | null;
  resetDismissedConnections: () => void;
  performUnifiedSemanticSearch: (query: string, customThreshold?: number) => Promise<DiscoverSourceItem[]>;
  saveSynthesizedNote: (params: {
    title: string;
    htmlContent: string;
    tags: string[];
    sourceItems: DiscoverSourceItem[];
    type?: NoteType;
  }) => string;
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

  // Debounce refs for auto-embedding notes and already-embedded fragments
  const embedTimersRef = useRef<{ [noteId: string]: NodeJS.Timeout }>({});
  const fragEmbedTimersRef = useRef<{ [fragmentId: string]: NodeJS.Timeout }>({});

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
    const applyDbDiscoverConnections = (dbConns: DiscoverConnectionRecord[], onlyIfNonEmpty = false) => {
      if (onlyIfNonEmpty && dbConns.length === 0) return;

      const dbApproved = dbConns.filter((c) => c.status === 'approved').map((c) => c.pairKey);
      const dbDismissed = dbConns.filter((c) => c.status === 'dismissed').map((c) => c.pairKey);
      setApprovedConnections(dbApproved);
      setDismissedConnections(dbDismissed);

      const dbAnalyses: Record<string, ConnectionAnalysis> = {};
      for (const row of dbConns) {
        if (row.analysis) {
          dbAnalyses[row.pairKey] = row.analysis;
        }
      }
      if (Object.keys(dbAnalyses).length > 0) {
        setConnectionAnalyses((prev) => ({ ...prev, ...dbAnalyses }));
      }
    };

    const initSupabaseSync = async () => {
      try {
        const [dbNotes, dbFragments, dbDiscoverConns] = await Promise.all([
          fetchNotesFromSupabase(),
          fetchFragmentsFromSupabase(),
          fetchDiscoverConnectionsFromSupabase(),
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

        if (dbDiscoverConns !== null && isMounted) {
          applyDbDiscoverConnections(dbDiscoverConns, true);
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
      },
      async () => {
        const latestConns = await fetchDiscoverConnectionsFromSupabase();
        if (latestConns !== null && isMounted) {
          applyDbDiscoverConnections(latestConns, false);
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
      updatedAt: new Date().toISOString(),
      starred: false,
    };
    setFragments((prev) => [newFragment, ...prev]);

    if (isSupabaseConfigured()) {
      upsertFragmentToSupabase(newFragment).catch(console.warn);
    }

    return id;
  };

  const updateFragment = (id: string, updates: Partial<Fragment>) => {
    const updatedAt = new Date().toISOString();
    let updatedFragObj: Fragment | undefined;
    setFragments((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updated = { ...f, ...updates, updatedAt };
          updatedFragObj = updated;
          return updated;
        }
        return f;
      })
    );

    if (isSupabaseConfigured() && updatedFragObj) {
      // Preserve existing vector embedding unless user explicitly removes it
      upsertFragmentToSupabase(updatedFragObj).catch(console.warn);

      // Only auto re-embed if the user already opted this Fragment into vector embedding
      if (updatedFragObj.embeddedAt) {
        const snapshot = updatedFragObj;
        if (fragEmbedTimersRef.current[id]) {
          clearTimeout(fragEmbedTimersRef.current[id]);
        }
        fragEmbedTimersRef.current[id] = setTimeout(async () => {
          const ok = await embedAndSyncFragment(snapshot);
          if (ok) {
            const nowIso = new Date().toISOString();
            setFragments((prev) =>
              prev.map((f) => (f.id === id ? { ...f, embeddedAt: nowIso } : f))
            );
          }
        }, 1500);
      }
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
      // Keep raw fragments un-embedded unless already embedded; never wipe existing vectors
      const ok = frag.embeddedAt
        ? await embedAndSyncFragment(frag)
        : await upsertFragmentToSupabase(frag);
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

  // AI Semantic Search State & Controls
  const [isSemanticSearch, setIsSemanticSearchState] = useState<boolean>(() => {
    return localStorage.getItem('noesis_semantic_search_default') === 'true';
  });

  const [semanticSensitivity, setSemanticSensitivityState] = useState<'broad' | 'standard' | 'strict'>(() => {
    return (localStorage.getItem('noesis_semantic_sensitivity') as any) || 'standard';
  });

  const setIsSemanticSearch = (active: boolean) => {
    setIsSemanticSearchState(active);
    localStorage.setItem('noesis_semantic_search_default', String(active));
  };

  const setSemanticSensitivity = (sensitivity: 'broad' | 'standard' | 'strict') => {
    setSemanticSensitivityState(sensitivity);
    localStorage.setItem('noesis_semantic_sensitivity', sensitivity);
  };

  const semanticThreshold = useMemo(() => {
    switch (semanticSensitivity) {
      case 'broad':
        return 0.35;
      case 'strict':
        return 0.60;
      case 'standard':
      default:
        return 0.45;
    }
  }, [semanticSensitivity]);

  const performSemanticNoteSearch = async (
    query: string
  ): Promise<{ id: string; similarity: number }[] | null> => {
    if (!query.trim() || !isSupabaseConfigured()) return null;
    try {
      const vector = await generateBgeM3Embedding(query);
      if (!vector) return null;
      const results = await searchNotesSemantic(vector, semanticThreshold, 20);
      if (!results) return null;
      return results.map((r) => ({ id: r.item.id, similarity: r.similarity }));
    } catch (err) {
      console.warn('performSemanticNoteSearch error:', err);
      return null;
    }
  };

  // Discover & Synthesis Foundation State (Offline-first + Supabase Sync)
  const [dismissedConnections, setDismissedConnections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('noesis_dismissed_connections');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [approvedConnections, setApprovedConnections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('noesis_approved_connections');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [connectionAnalyses, setConnectionAnalyses] = useState<
    Record<string, ConnectionAnalysis>
  >(() => {
    try {
      const saved = localStorage.getItem('noesis_discover_analyses');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('noesis_dismissed_connections', JSON.stringify(dismissedConnections));
  }, [dismissedConnections]);

  useEffect(() => {
    localStorage.setItem('noesis_approved_connections', JSON.stringify(approvedConnections));
  }, [approvedConnections]);

  useEffect(() => {
    localStorage.setItem('noesis_discover_analyses', JSON.stringify(connectionAnalyses));
  }, [connectionAnalyses]);

  const buildCanonicalPair = (itemA: DiscoverSourceItem, itemB: DiscoverSourceItem) => {
    const first = itemA.id < itemB.id ? itemA : itemB;
    const second = itemA.id < itemB.id ? itemB : itemA;
    return {
      pairKey: makePairKey(itemA.id, itemB.id),
      first,
      second,
    };
  };

  const dismissConnection = (itemA: DiscoverSourceItem, itemB: DiscoverSourceItem) => {
    const { pairKey, first, second } = buildCanonicalPair(itemA, itemB);
    setDismissedConnections((prev) => (prev.includes(pairKey) ? prev : [...prev, pairKey]));
    setApprovedConnections((prev) => prev.filter((k) => k !== pairKey));

    if (isSupabaseConfigured()) {
      upsertDiscoverConnectionToSupabase({
        pairKey,
        itemAId: first.id,
        itemAKind: first.kind,
        itemBId: second.id,
        itemBKind: second.kind,
        status: 'dismissed',
        analysis: connectionAnalyses[pairKey],
        updatedAt: new Date().toISOString(),
      }).catch(console.warn);
    }
  };

  const resetDismissedConnections = () => {
    setDismissedConnections([]);
    if (isSupabaseConfigured()) {
      restoreDismissedDiscoverConnectionsInSupabase().catch(console.warn);
    }
  };

  const approveConnection = (itemA: DiscoverSourceItem, itemB: DiscoverSourceItem) => {
    const { pairKey, first, second } = buildCanonicalPair(itemA, itemB);
    setApprovedConnections((prev) => (prev.includes(pairKey) ? prev : [...prev, pairKey]));
    setDismissedConnections((prev) => prev.filter((k) => k !== pairKey));

    if (itemA.kind === 'note' && itemB.kind === 'note') {
      linkRelatedNote(itemA.id, itemB.id);
    }

    if (isSupabaseConfigured()) {
      upsertDiscoverConnectionToSupabase({
        pairKey,
        itemAId: first.id,
        itemAKind: first.kind,
        itemBId: second.id,
        itemBKind: second.kind,
        status: 'approved',
        analysis: connectionAnalyses[pairKey],
        updatedAt: new Date().toISOString(),
      }).catch(console.warn);
    }
  };

  const saveConnectionAnalysis = (
    itemA: DiscoverSourceItem,
    itemB: DiscoverSourceItem,
    analysis: ConnectionAnalysis
  ) => {
    const { pairKey, first, second } = buildCanonicalPair(itemA, itemB);
    setConnectionAnalyses((prev) => ({
      ...prev,
      [pairKey]: analysis,
    }));

    if (isSupabaseConfigured()) {
      const currentStatus = approvedConnections.includes(pairKey)
        ? 'approved'
        : dismissedConnections.includes(pairKey)
        ? 'dismissed'
        : 'pending';

      upsertDiscoverConnectionToSupabase({
        pairKey,
        itemAId: first.id,
        itemAKind: first.kind,
        itemBId: second.id,
        itemBKind: second.kind,
        status: currentStatus,
        analysis,
        updatedAt: new Date().toISOString(),
      }).catch(console.warn);
    }
  };

  const unlinkDiscoverConnection = (idA: string, idB: string) => {
    const pairKey = makePairKey(idA, idB);
    setApprovedConnections((prev) => prev.filter((k) => k !== pairKey));
    if (isSupabaseConfigured()) {
      unlinkDiscoverConnectionInSupabase(pairKey).catch(console.warn);
    }
  };

  const promoteFragmentToNote = (fragmentId: string): string | null => {
    const frag = fragments.find((f) => f.id === fragmentId);
    if (!frag) return null;

    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const paragraphs = (frag.content || '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('');

    const htmlContent = paragraphs || '<p></p>';
    const plainText = cleanTextForEmbedding(htmlContent);
    const newId = `note-${Date.now()}`;
    const now = new Date().toISOString();

    const newNote: Note = {
      id: newId,
      title: frag.title || 'Untitled Note',
      content: htmlContent,
      excerpt: plainText.slice(0, 180),
      type: frag.type || 'thought',
      tags: frag.tags && frag.tags.length > 0 ? [...frag.tags] : ['fragment'],
      source: frag.source || `Dikembangkan dari Fragment: ${frag.title}`,
      favorite: Boolean(frag.starred),
      archived: false,
      relatedNoteIds: [],
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [newNote, ...prev]);

    if (isSupabaseConfigured()) {
      embedAndSyncNote(newNote).catch(() => {
        upsertNoteToSupabase(newNote).catch(console.warn);
      });
    }

    // Link the promoted Note back to the source Fragment without removing the Fragment
    approveConnection(noteToDiscoverItem(newNote), fragmentToDiscoverItem(frag));

    setActiveNoteId(newId);
    setActiveView('editor');
    closeFragmentDrawer();
    return newId;
  };

  const performUnifiedSemanticSearch = async (
    query: string,
    customThreshold?: number
  ): Promise<DiscoverSourceItem[]> => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const threshold = customThreshold ?? Math.min(semanticThreshold, 0.38);

    // Try vector semantic search across both Notes & Fragments if Supabase is connected
    if (isSupabaseConfigured()) {
      try {
        const vector = await generateBgeM3Embedding(trimmed);
        if (vector) {
          const [noteResults, fragmentResults] = await Promise.all([
            searchNotesSemantic(vector, threshold, 15),
            searchFragmentsSemantic(vector, threshold, 15),
          ]);

          const merged: DiscoverSourceItem[] = [];
          const activeNoteIds = new Set(notes.filter((n) => !n.archived).map((n) => n.id));

          if (noteResults) {
            for (const r of noteResults) {
              if (activeNoteIds.has(r.item.id) || notes.length === 0) {
                merged.push(noteToDiscoverItem(r.item, r.similarity));
              }
            }
          }

          if (fragmentResults) {
            for (const r of fragmentResults) {
              merged.push(fragmentToDiscoverItem(r.item, r.similarity));
            }
          }

          if (merged.length > 0) {
            merged.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
            return merged;
          }
        }
      } catch (err) {
        console.warn('performUnifiedSemanticSearch vector fallback:', err);
      }
    }

    // Local keyword/tag fallback (for offline or unembedded notes/fragments)
    const terms = trimmed.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
    const localItems: DiscoverSourceItem[] = [
      ...notes.filter((n) => !n.archived).map((n) => noteToDiscoverItem(n)),
      ...fragments.map((f) => fragmentToDiscoverItem(f)),
    ];

    const scored = localItems
      .map((item) => {
        const haystack = `${item.title} ${cleanTextForEmbedding(item.content)} ${(item.tags || []).join(' ')}`.toLowerCase();
        let hits = 0;
        for (const term of terms) {
          if (haystack.includes(term)) hits++;
        }
        const score = terms.length > 0 ? hits / terms.length : 0;
        return { ...item, similarity: score };
      })
      .filter((item) => (item.similarity || 0) > 0)
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    return scored.slice(0, 20);
  };

  const saveSynthesizedNote = ({
    title,
    htmlContent,
    tags,
    sourceItems,
    type = 'thought',
  }: {
    title: string;
    htmlContent: string;
    tags: string[];
    sourceItems: DiscoverSourceItem[];
    type?: NoteType;
  }): string => {
    const newId = `note-${Date.now()}`;
    const noteIds = Array.from(
      new Set(sourceItems.filter((item) => item.kind === 'note').map((item) => item.id))
    );
    const fragmentItems = sourceItems.filter((item) => item.kind === 'fragment');

    const sourceListHtml = sourceItems
      .map(
        (item) =>
          `<li>[${item.kind === 'fragment' ? 'Fragment' : 'Catatan'}] ${item.title || 'Tanpa Judul'}</li>`
      )
      .join('');

    const finalHtml = `${htmlContent}<hr><p><strong>Sumber Pengetahuan (${sourceItems.length}):</strong></p><ul>${sourceListHtml}</ul>`;
    const plainText = cleanTextForEmbedding(finalHtml);
    const excerpt = plainText.slice(0, 180);
    const now = new Date().toISOString();

    const cleanTags = Array.from(
      new Set(['synthesis', ...tags.map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean)])
    );

    const sourceLabel = `Disintesis dari ${noteIds.length} catatan${fragmentItems.length > 0 ? ` & ${fragmentItems.length} fragments` : ''}`;

    const newNote: Note = {
      id: newId,
      title: title.trim() || 'Dokumen Sintesis',
      content: finalHtml,
      excerpt,
      type,
      tags: cleanTags,
      source: sourceLabel,
      favorite: false,
      archived: false,
      relatedNoteIds: noteIds,
      createdAt: now,
      updatedAt: now,
    };

    // Save synthesized document to Library & link bidirectionally without modifying source contents
    setNotes((prev) => {
      const updatedExisting = prev.map((n) => {
        if (noteIds.includes(n.id) && !n.relatedNoteIds.includes(newId)) {
          const linked = { ...n, relatedNoteIds: [...n.relatedNoteIds, newId] };
          if (isSupabaseConfigured()) upsertNoteToSupabase(linked).catch(console.warn);
          return linked;
        }
        return n;
      });
      return [newNote, ...updatedExisting];
    });

    if (isSupabaseConfigured()) {
      embedAndSyncNote(newNote).catch(() => {
        upsertNoteToSupabase(newNote).catch(console.warn);
      });
    }

    return newId;
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
        isSemanticSearch,
        setIsSemanticSearch,
        semanticSensitivity,
        setSemanticSensitivity,
        semanticThreshold,
        performSemanticNoteSearch,
        dismissedConnections,
        approvedConnections,
        connectionAnalyses,
        dismissConnection,
        approveConnection,
        saveConnectionAnalysis,
        unlinkDiscoverConnection,
        promoteFragmentToNote,
        resetDismissedConnections,
        performUnifiedSemanticSearch,
        saveSynthesizedNote,
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
