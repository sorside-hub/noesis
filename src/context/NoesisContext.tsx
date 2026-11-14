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
  ManualNoteType,
  NoteType,
  StreamFilter,
  DiscoverSourceItem,
  ConnectionAnalysis,
  DiscoverConnectionRecord,
} from '../types';
import { INITIAL_NOTES, INITIAL_FRAGMENTS, INITIAL_RELICS, INITIAL_PROJECTS } from '../data/mockData';
import type { User } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  getSupabaseSession,
  onSupabaseAuthStateChange,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signOutFromSupabase,
  updateSupabasePassword,
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
  fetchFragmentEmbeddingById,
  deleteDiscoverConnectionsForItem,
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
  stripSynthesisSourcesFooter,
} from '../lib/discoverAi';
import {
  loadPendingSyncQueue,
  clearPendingSyncQueue,
  hasPendingSyncItems,
  enqueueUpsertNote,
  dequeueUpsertNote,
  enqueueDeleteNote,
  dequeueDeleteNote,
  enqueueUpsertFragment,
  dequeueUpsertFragment,
  enqueueDeleteFragment,
  dequeueDeleteFragment,
  enqueueUpsertConnection,
  dequeueUpsertConnection,
  enqueueDeleteConnection,
  dequeueDeleteConnection,
} from '../lib/offlineSyncQueue';
import { scrollToTop } from '../hooks/useScrollRestoration';

export type DiscoverTab = 'synthesis' | 'connections' | 'clusters';

export interface LibraryViewPrefs {
  search: string;
  selectedType: string;
  selectedTag: string | null;
  viewLayout: 'grid' | 'list';
  sortBy: 'updated' | 'created' | 'alpha';
  showArchivedOnly: boolean;
  showFavoritesOnly: boolean;
}

export interface FragmentsViewPrefs {
  search: string;
  selectedType: string;
  showFavoritesOnly: boolean;
  sortBy: 'recent' | 'alpha';
  viewMode: 'grid' | 'list';
}

interface NoesisHistoryEntry {
  __noesis: true;
  idx: number;
  view: ViewMode;
  noteId: string;
  fragmentDrawerOpen: boolean;
  fragmentId: string | null;
  overlayId: string | null;
}

interface NoesisContextType {
  // Theme
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  // Navigation & PWA History
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  selectTab: (tab: ViewMode) => void;
  activeStreamFilter: StreamFilter;
  setActiveStreamFilter: (filter: StreamFilter) => void;
  // Backward compatibility alias for stream filter
  activeNotebookId: string | null;
  setActiveNotebookId: (id: string | null) => void;

  activeNoteId: string;
  setActiveNoteId: (id: string) => void;
  navigateBack: () => void;
  backTargetLabel: string;
  openNoteFromFragment: (noteId: string) => void;
  exitDeletedNote: (noteId: string) => void;
  exitDeletedFragment: (fragmentId: string) => void;
  registerOverlay: (id: string, onClose: () => void) => void;
  unregisterOverlay: (id: string) => void;

  // Persistent View Tab & Filter Preferences
  discoverTab: DiscoverTab;
  setDiscoverTab: React.Dispatch<React.SetStateAction<DiscoverTab>>;
  libraryViewPrefs: LibraryViewPrefs;
  setLibraryViewPrefs: React.Dispatch<React.SetStateAction<LibraryViewPrefs>>;
  fragmentsViewPrefs: FragmentsViewPrefs;
  setFragmentsViewPrefs: React.Dispatch<React.SetStateAction<FragmentsViewPrefs>>;

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
  createNote: (type?: ManualNoteType) => string;
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

  // Auth & Security
  authUser: User | null;
  authLoading: boolean;
  offlineBypass: boolean;
  enterOfflineMode: () => void;
  exitOfflineMode: () => void;
  safetyModalAction: 'offline-logout' | 'wipe-local-exit' | 'reset-workspace' | null;
  closeSafetyModal: () => void;
  confirmSafetyAction: () => Promise<void>;
  requestSignOut: () => void;
  requestWipeLocalExit: () => void;
  requestResetWorkspace: () => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; needsConfirmation?: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;

  // Supabase & Embedding Integration
  isSupabaseConnected: boolean;
  isCloudflareConnected: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  autoSyncNotice: string | null;
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
  promoteFragmentToNote: (
    fragmentId: string
  ) => Promise<{ ok: boolean; noteId?: string; error?: string }>;
  resetDismissedConnections: () => void;
  performUnifiedSemanticSearch: (query: string, customThreshold?: number) => Promise<DiscoverSourceItem[]>;
  synthesisTargetNoteId: string | null;
  startUpdateSynthesis: (noteId: string) => void;
  clearSynthesisTarget: () => void;
  saveSynthesizedNote: (params: {
    title: string;
    htmlContent: string;
    tags: string[];
    sourceItems: DiscoverSourceItem[];
  }) => string;
  updateSynthesizedNote: (params: {
    targetNoteId: string;
    title: string;
    htmlContent: string;
    tags: string[];
    newSourceItems: DiscoverSourceItem[];
    allResolvedSourceItems: DiscoverSourceItem[];
  }) => boolean;
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
  const [activeView, setActiveViewState] = useState<ViewMode>('home');
  const [activeStreamFilter, setActiveStreamFilter] = useState<StreamFilter>('all');
  const [activeNoteId, setActiveNoteIdState] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState<boolean>(false);
  const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);
  const [isFragmentDrawerOpen, setIsFragmentDrawerOpen] = useState<boolean>(false);
  const [synthesisTargetNoteId, setSynthesisTargetNoteId] = useState<string | null>(null);

  // Persistent Tab & Filter Preferences (kept across navigation & Back)
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>('synthesis');
  const [libraryViewPrefs, setLibraryViewPrefs] = useState<LibraryViewPrefs>({
    search: '',
    selectedType: 'all',
    selectedTag: null,
    viewLayout: 'grid',
    sortBy: 'updated',
    showArchivedOnly: false,
    showFavoritesOnly: false,
  });
  const [fragmentsViewPrefs, setFragmentsViewPrefs] = useState<FragmentsViewPrefs>({
    search: '',
    selectedType: 'all',
    showFavoritesOnly: false,
    sortBy: 'recent',
    viewMode: 'grid',
  });

  // =========================================================================
  // CENTRALIZED PWA NAVIGATION HISTORY & LIFO OVERLAY CONTROLLER
  // =========================================================================
  const TOP_LEVEL_VIEWS = useMemo(
    () => new Set<ViewMode>(['home', 'library', 'fragments', 'capture', 'discover', 'projects']),
    []
  );

  const initialHistoryEntry: NoesisHistoryEntry = {
    __noesis: true,
    idx: 0,
    view: 'home',
    noteId: '',
    fragmentDrawerOpen: false,
    fragmentId: null,
    overlayId: null,
  };

  const historyStackRef = useRef<NoesisHistoryEntry[]>([initialHistoryEntry]);
  const historyCursorRef = useRef<number>(0);
  const overlaysRef = useRef<Map<string, () => void>>(new Map());
  const closingOverlayIdsRef = useRef<Set<string>>(new Set());
  const closingMicrotaskScheduledRef = useRef<boolean>(false);
  const expectedPopIdxRef = useRef<number | null>(null);
  const pendingNavAfterGoRef = useRef<(() => void) | null>(null);

  const activeViewRef = useRef<ViewMode>('home');
  const activeNoteIdRef = useRef<string>('');
  const isFragmentDrawerOpenRef = useRef<boolean>(false);
  const activeFragmentIdRef = useRef<string | null>(null);
  const lastLibraryNoteIdRef = useRef<string | null>(null);
  const lastFragmentIdRef = useRef<string | null>(null);
  const [backTargetLabel, setBackTargetLabel] = useState<string>('Home');

  const computeBackTargetLabel = (stack: NoesisHistoryEntry[], currentIdx: number): string => {
    for (let i = currentIdx - 1; i >= 0; i--) {
      const entry = stack[i];
      if (!entry || entry.overlayId) continue;
      if (entry.fragmentDrawerOpen) return 'Fragment';
      switch (entry.view) {
        case 'home':
          return 'Home';
        case 'library':
          return 'Library';
        case 'fragments':
        case 'capture':
          return 'Fragments';
        case 'discover':
          return 'Discover';
        case 'projects':
          return 'Projects';
        case 'settings':
          return 'Settings';
        case 'editor':
          return 'Back';
        default:
          return 'Home';
      }
    }
    return 'Home';
  };

  const applyEntryToReactState = (entry: NoesisHistoryEntry) => {
    activeViewRef.current = entry.view;
    setActiveViewState(entry.view);
    activeNoteIdRef.current = entry.noteId;
    setActiveNoteIdState(entry.noteId);
    isFragmentDrawerOpenRef.current = entry.fragmentDrawerOpen;
    setIsFragmentDrawerOpen(entry.fragmentDrawerOpen);
    activeFragmentIdRef.current = entry.fragmentId;
    setActiveFragmentId(entry.fragmentId);
    setIsQuickCaptureOpen(entry.fragmentDrawerOpen);
    setBackTargetLabel(computeBackTargetLabel(historyStackRef.current, entry.idx));
  };

  const dismissTopOverlaysSync = (): number => {
    let poppedOverlays = 0;
    let scan = historyCursorRef.current;
    while (scan > 0) {
      const entry = historyStackRef.current[scan];
      if (!entry?.overlayId) break;
      const oid = entry.overlayId;
      overlaysRef.current.delete(oid);
      closingOverlayIdsRef.current.delete(oid);
      poppedOverlays += 1;
      scan -= 1;
    }
    return poppedOverlays;
  };

  const flushClosingOverlays = () => {
    closingMicrotaskScheduledRef.current = false;
    if (closingOverlayIdsRef.current.size === 0) return;

    let targetCursor = historyCursorRef.current;
    let popCount = 0;
    while (targetCursor > 0) {
      const top = historyStackRef.current[targetCursor];
      if (top?.overlayId && closingOverlayIdsRef.current.has(top.overlayId)) {
        closingOverlayIdsRef.current.delete(top.overlayId);
        popCount += 1;
        targetCursor -= 1;
      } else {
        break;
      }
    }
    closingOverlayIdsRef.current.clear();

    if (popCount > 0) {
      historyCursorRef.current = targetCursor;
      historyStackRef.current = historyStackRef.current.slice(0, targetCursor + 1);
      setBackTargetLabel(computeBackTargetLabel(historyStackRef.current, targetCursor));
      window.history.go(-popCount);
    }
  };

  const registerOverlay = (id: string, onClose: () => void) => {
    overlaysRef.current.set(id, onClose);
    closingOverlayIdsRef.current.delete(id);

    const cur = historyStackRef.current[historyCursorRef.current] || initialHistoryEntry;
    const nextIdx = historyCursorRef.current + 1;
    const nextEntry: NoesisHistoryEntry = {
      __noesis: true,
      idx: nextIdx,
      view: cur.view,
      noteId: cur.noteId,
      fragmentDrawerOpen: cur.fragmentDrawerOpen,
      fragmentId: cur.fragmentId,
      overlayId: id,
    };
    historyStackRef.current = [...historyStackRef.current.slice(0, nextIdx), nextEntry];
    historyCursorRef.current = nextIdx;
    window.history.pushState(nextEntry, '');
  };

  const unregisterOverlay = (id: string) => {
    if (!overlaysRef.current.has(id)) {
      return;
    }
    overlaysRef.current.delete(id);
    closingOverlayIdsRef.current.add(id);
    if (!closingMicrotaskScheduledRef.current) {
      closingMicrotaskScheduledRef.current = true;
      queueMicrotask(flushClosingOverlays);
    }
  };

  const resetNavigationToHome = () => {
    overlaysRef.current.forEach((closeFn) => closeFn());
    overlaysRef.current.clear();
    closingOverlayIdsRef.current.clear();
    pendingNavAfterGoRef.current = null;
    expectedPopIdxRef.current = null;

    const delta = historyCursorRef.current;
    historyStackRef.current = [initialHistoryEntry];
    historyCursorRef.current = 0;
    applyEntryToReactState(initialHistoryEntry);

    if (delta > 0) {
      window.history.go(-delta);
    } else {
      window.history.replaceState(initialHistoryEntry, '');
    }
  };

  const startUpdateSynthesis = (noteId: string) => {
    setSynthesisTargetNoteId(noteId);
    setDiscoverTab('synthesis');
    setActiveView('discover');
  };

  const clearSynthesisTarget = () => {
    setSynthesisTargetNoteId(null);
  };

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

  // Auth & Sync statuses
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(() => isSupabaseConfigured());
  const [offlineBypass, setOfflineBypass] = useState<boolean>(() => {
    return localStorage.getItem('noesis_offline_bypass') === 'true';
  });
  const [safetyModalAction, setSafetyModalAction] = useState<
    'offline-logout' | 'wipe-local-exit' | 'reset-workspace' | null
  >(null);

  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(isSupabaseConfigured());
  const [isCloudflareConnected, setIsCloudflareConnected] = useState<boolean>(isCloudflareAiConfigured());
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [autoSyncNotice, setAutoSyncNotice] = useState<string | null>(null);

  // Debounce refs for auto-embedding notes and already-embedded fragments
  const embedTimersRef = useRef<{ [noteId: string]: NodeJS.Timeout }>({});
  const fragEmbedTimersRef = useRef<{ [fragmentId: string]: NodeJS.Timeout }>({});

  // Latest-state refs for safe async sync & logout cleanup
  const authUserRef = useRef<User | null>(authUser);
  authUserRef.current = authUser;
  const notesRef = useRef<Note[]>(notes);
  notesRef.current = notes;
  const fragmentsRef = useRef<Fragment[]>(fragments);
  fragmentsRef.current = fragments;
  const isReconcilingRef = useRef<boolean>(false);
  const rerunReconcileRef = useRef<boolean>(false);

  const canRemoteSync = () => isSupabaseConfigured() && Boolean(authUserRef.current);

  const isBrowserOnline = () =>
    typeof navigator === 'undefined' ? true : navigator.onLine;

  const syncNoteWithFallback = async (note: Note): Promise<boolean> => {
    if (!canRemoteSync() || !isBrowserOnline()) return false;
    const embeddedOk = await embedAndSyncNote(note);
    if (embeddedOk) return true;
    return await upsertNoteToSupabase(note);
  };

  const syncFragmentWithFallback = async (frag: Fragment): Promise<boolean> => {
    if (!canRemoteSync() || !isBrowserOnline()) return false;
    if (frag.embeddedAt) {
      const embeddedOk = await embedAndSyncFragment(frag);
      if (embeddedOk) return true;
    }
    return await upsertFragmentToSupabase(frag);
  };

  const markOfflineDirtyIfLoggedOut = () => {
    if (!authUserRef.current) {
      localStorage.setItem('noesis_offline_dirty', 'true');
    }
  };

  const enterOfflineMode = () => {
    setOfflineBypass(true);
    localStorage.setItem('noesis_offline_bypass', 'true');
  };

  const exitOfflineMode = () => {
    setOfflineBypass(false);
    localStorage.removeItem('noesis_offline_bypass');
    setIsMobileDrawerOpen(false);
  };

  const clearLocalContentOnly = () => {
    Object.values(embedTimersRef.current).forEach((t) => clearTimeout(t));
    embedTimersRef.current = {};
    Object.values(fragEmbedTimersRef.current).forEach((t) => clearTimeout(t));
    fragEmbedTimersRef.current = {};

    const contentKeys = [
      'noesis_notes',
      'noesis_fragments',
      'noesis_relics',
      'noesis_projects',
      'noesis_dismissed_connections',
      'noesis_approved_connections',
      'noesis_discover_analyses',
      'noesis_discover_cluster_summaries',
      'noesis_offline_dirty',
    ];
    contentKeys.forEach((k) => localStorage.removeItem(k));
    clearPendingSyncQueue();

    setNotes([]);
    setFragments([]);
    setProjects([]);
    setApprovedConnections([]);
    setDismissedConnections([]);
    setConnectionAnalyses({});
    setSearchQuery('');
    setSelectedTag(null);
    setDiscoverTab('synthesis');
    setLibraryViewPrefs({
      search: '',
      selectedType: 'all',
      selectedTag: null,
      viewLayout: 'grid',
      sortBy: 'updated',
      showArchivedOnly: false,
      showFavoritesOnly: false,
    });
    setFragmentsViewPrefs({
      search: '',
      selectedType: 'all',
      showFavoritesOnly: false,
      sortBy: 'recent',
      viewMode: 'grid',
    });
    resetNavigationToHome();
  };

  const clearLocalWorkspaceData = (wipeAuthTokens = false) => {
    clearLocalContentOnly();

    const metaAndLegacyKeys = [
      'noesis_auth_uid',
      'noesis_offline_bypass',
      'noesis_supabase_url',
      'noesis_supabase_anon_key',
      'noesis_cf_account_id',
      'noesis_cf_api_token',
    ];
    metaAndLegacyKeys.forEach((k) => localStorage.removeItem(k));

    if (wipeAuthTokens) {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        }
        sessionStorage.clear();
      } catch {
        // Ignore storage access errors
      }
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await signInWithEmailPassword(email, password);
    if (res.error) {
      return { ok: false, error: res.error };
    }
    setAuthUser(res.user);
    setOfflineBypass(false);
    localStorage.removeItem('noesis_offline_bypass');
    return { ok: true };
  };

  const signUp = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; needsConfirmation?: boolean; error?: string }> => {
    const res = await signUpWithEmailPassword(email, password);
    if (res.error) {
      return { ok: false, error: res.error };
    }
    if (res.session && res.user) {
      setAuthUser(res.user);
      setOfflineBypass(false);
      localStorage.removeItem('noesis_offline_bypass');
    }
    return { ok: true, needsConfirmation: res.needsEmailConfirmation };
  };

  const signOut = async () => {
    await signOutFromSupabase();
    clearLocalWorkspaceData(true);
    setAuthUser(null);
    setOfflineBypass(false);
    setAutoSyncNotice(null);
    setIsMobileDrawerOpen(false);
  };

  const requestSignOut = () => {
    if (!authUserRef.current) {
      exitOfflineMode();
      return;
    }
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!isOnline) {
      setSafetyModalAction('offline-logout');
      return;
    }
    void signOut();
  };

  const requestWipeLocalExit = () => {
    setSafetyModalAction('wipe-local-exit');
  };

  const requestResetWorkspace = () => {
    setSafetyModalAction('reset-workspace');
  };

  const closeSafetyModal = () => {
    setSafetyModalAction(null);
  };

  const confirmSafetyAction = async () => {
    const action = safetyModalAction;
    setSafetyModalAction(null);
    if (action === 'offline-logout') {
      await signOut();
    } else if (action === 'wipe-local-exit') {
      clearLocalWorkspaceData(true);
      setAuthUser(null);
      setOfflineBypass(false);
      setAutoSyncNotice(null);
      setIsMobileDrawerOpen(false);
    } else if (action === 'reset-workspace') {
      clearLocalContentOnly();
    }
  };

  const updatePassword = async (
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await updateSupabasePassword(newPassword);
    if (res.error) {
      return { ok: false, error: res.error };
    }
    return { ok: true };
  };

  // Sync entities to localStorage on state changes (keep storage clean when logged out & empty)
  useEffect(() => {
    if (!authUser && !offlineBypass && notes.length === 0) {
      localStorage.removeItem('noesis_notes');
    } else {
      localStorage.setItem('noesis_notes', JSON.stringify(notes));
    }
  }, [notes, authUser, offlineBypass]);

  useEffect(() => {
    if (!authUser && !offlineBypass && fragments.length === 0) {
      localStorage.removeItem('noesis_fragments');
      localStorage.removeItem('noesis_relics');
    } else {
      localStorage.setItem('noesis_fragments', JSON.stringify(fragments));
      localStorage.setItem('noesis_relics', JSON.stringify(fragments));
    }
  }, [fragments, authUser, offlineBypass]);

  useEffect(() => {
    if (!authUser && !offlineBypass && projects.length === 0) {
      localStorage.removeItem('noesis_projects');
    } else {
      localStorage.setItem('noesis_projects', JSON.stringify(projects));
    }
  }, [projects, authUser, offlineBypass]);

  // Listen to Supabase Auth Session changes
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthUser(null);
      setAuthLoading(false);
      setIsSupabaseConnected(false);
      return;
    }

    let isMounted = true;
    setAuthLoading(true);
    setIsSupabaseConnected(true);

    getSupabaseSession().then((session) => {
      if (!isMounted) return;
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const unsubscribeAuth = onSupabaseAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
    };
  }, []);

  // Initial Supabase Sync, Logged-In Offline Outbox Reconciliation & Realtime Listeners
  useEffect(() => {
    if (!isSupabaseConfigured() || !authUser?.id) return;

    const uid = authUser.id;
    let isMounted = true;
    const savedUid = localStorage.getItem('noesis_auth_uid');
    const isDifferentUser = savedUid !== null && savedUid !== uid;
    const hasOfflineDirtyFlag = localStorage.getItem('noesis_offline_dirty') === 'true';

    // Snapshot any unauthenticated offline drafts before potential state transitions
    const offlineNotesSnapshot = notesRef.current;
    const offlineFragmentsSnapshot = fragmentsRef.current;
    const offlineApprovedSnapshot = approvedRef.current;
    const offlineDismissedSnapshot = dismissedRef.current;
    const offlineAnalysesSnapshot = analysesRef.current;

    const hasOfflineDrafts =
      (hasOfflineDirtyFlag || !savedUid) &&
      (offlineNotesSnapshot.length > 0 ||
        offlineFragmentsSnapshot.length > 0 ||
        offlineApprovedSnapshot.length > 0 ||
        offlineDismissedSnapshot.length > 0 ||
        Object.keys(offlineAnalysesSnapshot).length > 0);

    if (isDifferentUser && !hasOfflineDirtyFlag) {
      clearLocalWorkspaceData();
    }
    localStorage.setItem('noesis_auth_uid', uid);

    const applyDbDiscoverConnections = (
      dbConns: DiscoverConnectionRecord[],
      onlyIfNonEmpty = false
    ) => {
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

    const pushUnauthenticatedDraftsIfAny = async () => {
      if (!hasOfflineDrafts) return;
      setSyncStatus('syncing');
      let pushedNotes = 0;
      let pushedFragments = 0;

      for (const note of offlineNotesSnapshot) {
        const synced = isCloudflareAiConfigured()
          ? (await embedAndSyncNote(note)) || (await upsertNoteToSupabase(note))
          : await upsertNoteToSupabase(note);
        if (synced) pushedNotes++;
      }

      for (const frag of offlineFragmentsSnapshot) {
        const synced =
          frag.embeddedAt && isCloudflareAiConfigured()
            ? (await embedAndSyncFragment(frag)) || (await upsertFragmentToSupabase(frag))
            : await upsertFragmentToSupabase(frag);
        if (synced) pushedFragments++;
      }

      // Push offline Discover connections & AI analyses
      const itemMap = new Map<string, DiscoverSourceItem>();
      offlineNotesSnapshot.forEach((n) => itemMap.set(n.id, noteToDiscoverItem(n)));
      offlineFragmentsSnapshot.forEach((f) => itemMap.set(f.id, fragmentToDiscoverItem(f)));

      const allPairKeys = new Set<string>([
        ...offlineApprovedSnapshot,
        ...offlineDismissedSnapshot,
        ...Object.keys(offlineAnalysesSnapshot),
      ]);

      for (const pairKey of allPairKeys) {
        const [idA, idB] = pairKey.split('::');
        const itemA = itemMap.get(idA);
        const itemB = itemMap.get(idB);
        if (!itemA || !itemB) continue;
        const first = itemA.id < itemB.id ? itemA : itemB;
        const second = itemA.id < itemB.id ? itemB : itemA;
        const status = offlineApprovedSnapshot.includes(pairKey)
          ? 'approved'
          : offlineDismissedSnapshot.includes(pairKey)
          ? 'dismissed'
          : 'pending';

        await upsertDiscoverConnectionToSupabase({
          pairKey,
          itemAId: first.id,
          itemAKind: first.kind,
          itemBId: second.id,
          itemBKind: second.kind,
          status,
          analysis: offlineAnalysesSnapshot[pairKey],
          updatedAt: new Date().toISOString(),
        });
      }

      localStorage.removeItem('noesis_offline_dirty');
      if (isMounted && (pushedNotes > 0 || pushedFragments > 0)) {
        setAutoSyncNotice(
          `Data offline otomatis tersinkronisasi (${pushedNotes} catatan, ${pushedFragments} fragments).`
        );
        setTimeout(() => {
          setAutoSyncNotice(null);
        }, 4500);
      }
    };

    // Strict Choice A Reconciliation: Flush pending outbox queue against Supabase truth, then pull final truth
    const flushPendingOutbox = async (): Promise<number> => {
      const queue = loadPendingSyncQueue(uid);
      if (!hasPendingSyncItems(queue)) return 0;

      // 1. Fetch current server truth first for strict server/timestamp conflict checks
      const [serverNotes, serverFragments, serverConns] = await Promise.all([
        fetchNotesFromSupabase(),
        fetchFragmentsFromSupabase(),
        fetchDiscoverConnectionsFromSupabase(),
      ]);

      if (serverNotes === null || serverFragments === null || serverConns === null) {
        // Still offline or unreachable -> leave queue untouched
        throw new Error('Supabase unreachable during queue reconciliation');
      }

      const serverNotesMap = new Map(serverNotes.map((n) => [n.id, n]));
      const serverFragsMap = new Map(serverFragments.map((f) => [f.id, f]));
      const serverConnsMap = new Map(serverConns.map((c) => [c.pairKey, c]));

      const localNotesMap = new Map(notesRef.current.map((n) => [n.id, n]));
      const localFragsMap = new Map(fragmentsRef.current.map((f) => [f.id, f]));

      let syncedCount = 0;

      // 2. Process queued Deletes first
      for (const noteId of [...queue.deleteNoteIds]) {
        const ok = await deleteNoteFromSupabase(noteId);
        if (ok) {
          dequeueDeleteNote(uid, noteId);
          serverNotesMap.delete(noteId);
          syncedCount++;
        }
      }

      for (const fragId of [...queue.deleteFragmentIds]) {
        const ok = await deleteFragmentFromSupabase(fragId);
        if (ok) {
          dequeueDeleteFragment(uid, fragId);
          serverFragsMap.delete(fragId);
          syncedCount++;
        }
      }

      for (const pairKey of [...queue.deleteConnectionPairKeys]) {
        const ok = await unlinkDiscoverConnectionInSupabase(pairKey);
        if (ok) {
          dequeueDeleteConnection(uid, pairKey);
          syncedCount++;
        }
      }

      // 3. Process queued Note Upserts (Choice A: Supabase Mutlak / Server-Wins)
      for (const [noteId, entry] of Object.entries(queue.upsertNotes)) {
        const localNote = localNotesMap.get(noteId);
        if (!localNote) {
          dequeueUpsertNote(uid, noteId);
          continue;
        }

        const serverNote = serverNotesMap.get(noteId);
        if (!serverNote && !entry.isNew) {
          // Deleted on another device while offline -> Supabase Mutlak wins (no zombie resurrection)
          dequeueUpsertNote(uid, noteId, entry.updatedAt);
          continue;
        }

        if (serverNote) {
          const serverMs = Date.parse(serverNote.updatedAt || '') || 0;
          const localMs = Date.parse(localNote.updatedAt || entry.updatedAt || '') || 0;
          if (serverMs > localMs) {
            // Another device saved a newer revision -> Supabase Mutlak wins
            dequeueUpsertNote(uid, noteId, entry.updatedAt);
            continue;
          }
        }

        const ok = await syncNoteWithFallback(localNote);
        if (ok) {
          dequeueUpsertNote(uid, noteId, localNote.updatedAt);
          serverNotesMap.set(localNote.id, localNote);
          syncedCount++;
        }
      }

      // 4. Process queued Fragment Upserts (Choice A: Respect server deletions)
      for (const [fragId, entry] of Object.entries(queue.upsertFragments)) {
        const localFrag = localFragsMap.get(fragId);
        if (!localFrag) {
          dequeueUpsertFragment(uid, fragId);
          continue;
        }

        const serverFrag = serverFragsMap.get(fragId);
        if (!serverFrag && !entry.isNew) {
          // Deleted on another device while offline -> Supabase Mutlak wins
          dequeueUpsertFragment(uid, fragId, entry.updatedAt);
          continue;
        }

        const ok = await syncFragmentWithFallback(localFrag);
        if (ok) {
          dequeueUpsertFragment(uid, fragId, localFrag.updatedAt || entry.updatedAt);
          serverFragsMap.set(localFrag.id, localFrag);
          syncedCount++;
        }
      }

      // 5. Process queued Discover Connections
      const combinedItemMap = new Map<string, DiscoverSourceItem>();
      serverNotesMap.forEach((n) => combinedItemMap.set(n.id, noteToDiscoverItem(n)));
      serverFragsMap.forEach((f) => combinedItemMap.set(f.id, fragmentToDiscoverItem(f)));

      for (const [pairKey, entry] of Object.entries(queue.upsertConnections)) {
        const serverConn = serverConnsMap.get(pairKey);
        if (serverConn) {
          const serverMs = Date.parse(serverConn.updatedAt || '') || 0;
          const localMs = Date.parse(entry.updatedAt || '') || 0;
          if (serverMs > localMs) {
            dequeueUpsertConnection(uid, pairKey, entry.updatedAt);
            continue;
          }
        }

        const [idA, idB] = pairKey.split('::');
        const itemA = combinedItemMap.get(idA);
        const itemB = combinedItemMap.get(idB);
        if (!itemA || !itemB) {
          dequeueUpsertConnection(uid, pairKey, entry.updatedAt);
          continue;
        }

        const first = itemA.id < itemB.id ? itemA : itemB;
        const second = itemA.id < itemB.id ? itemB : itemA;
        const status = approvedRef.current.includes(pairKey)
          ? 'approved'
          : dismissedRef.current.includes(pairKey)
          ? 'dismissed'
          : 'pending';

        const ok = await upsertDiscoverConnectionToSupabase({
          pairKey,
          itemAId: first.id,
          itemAKind: first.kind,
          itemBId: second.id,
          itemBKind: second.kind,
          status,
          analysis: analysesRef.current[pairKey],
          updatedAt: entry.updatedAt || new Date().toISOString(),
        });
        if (ok) {
          dequeueUpsertConnection(uid, pairKey, entry.updatedAt);
          syncedCount++;
        }
      }

      return syncedCount;
    };

    const reconcileWithSupabase = async (
      reason: 'init' | 'reconnect' | 'realtime' = 'init'
    ) => {
      if (!isMounted) return;
      if (!isBrowserOnline()) {
        setSyncStatus('offline');
        return;
      }
      if (isReconcilingRef.current) {
        rerunReconcileRef.current = true;
        return;
      }

      isReconcilingRef.current = true;
      setSyncStatus('syncing');

      try {
        if (reason === 'init') {
          await pushUnauthenticatedDraftsIfAny();
        }

        const syncedQueuedCount = await flushPendingOutbox();

        // Always pull fresh Supabase truth after flushing (Supabase Mutlak)
        const [dbNotes, dbFragments, dbDiscoverConns] = await Promise.all([
          fetchNotesFromSupabase(),
          fetchFragmentsFromSupabase(),
          fetchDiscoverConnectionsFromSupabase(),
        ]);

        const remainingQueue = loadPendingSyncQueue(uid);

        if (
          dbNotes !== null &&
          Object.keys(remainingQueue.upsertNotes).length === 0 &&
          remainingQueue.deleteNoteIds.length === 0 &&
          isMounted
        ) {
          setNotes(dbNotes);
          if (dbNotes.length > 0) {
            setActiveNoteIdState((prevId) => {
              const resolved = prevId || dbNotes[0].id;
              activeNoteIdRef.current = resolved;
              return resolved;
            });
          }
        }

        if (
          dbFragments !== null &&
          Object.keys(remainingQueue.upsertFragments).length === 0 &&
          remainingQueue.deleteFragmentIds.length === 0 &&
          isMounted
        ) {
          setFragments(dbFragments);
        }

        if (
          dbDiscoverConns !== null &&
          Object.keys(remainingQueue.upsertConnections).length === 0 &&
          remainingQueue.deleteConnectionPairKeys.length === 0 &&
          isMounted
        ) {
          applyDbDiscoverConnections(
            dbDiscoverConns,
            reason === 'init' && !hasOfflineDrafts && !isDifferentUser && savedUid === uid
          );
        }

        if (syncedQueuedCount > 0 && reason === 'reconnect' && isMounted) {
          setAutoSyncNotice(
            `Perubahan offline (${syncedQueuedCount} item) otomatis tersinkron ke Supabase.`
          );
          setTimeout(() => {
            setAutoSyncNotice(null);
          }, 4000);
        }

        setSyncStatus(hasPendingSyncItems(remainingQueue) ? 'offline' : 'synced');
        setIsSupabaseConnected(true);
      } catch (err) {
        console.warn('Supabase reconciliation failed, keeping offline cache & queue:', err);
        if (isMounted) setSyncStatus('offline');
      } finally {
        isReconcilingRef.current = false;
        if (rerunReconcileRef.current && isMounted) {
          rerunReconcileRef.current = false;
          void reconcileWithSupabase('reconnect');
        }
      }
    };

    void reconcileWithSupabase('init');

    const handleOnline = () => {
      void reconcileWithSupabase('reconnect');
    };
    const handleOffline = () => {
      if (isMounted) setSyncStatus('offline');
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isBrowserOnline()) {
        const q = loadPendingSyncQueue(uid);
        if (hasPendingSyncItems(q)) {
          void reconcileWithSupabase('reconnect');
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Subscribe to realtime changes (if queue has pending items, reconcile queue first!)
    const unsubscribe = subscribeToRealtimeChanges(
      async () => {
        const q = loadPendingSyncQueue(uid);
        if (hasPendingSyncItems(q)) {
          await reconcileWithSupabase('realtime');
          return;
        }
        const latestNotes = await fetchNotesFromSupabase();
        if (latestNotes !== null && isMounted) {
          setNotes(latestNotes);
        }
      },
      async () => {
        const q = loadPendingSyncQueue(uid);
        if (hasPendingSyncItems(q)) {
          await reconcileWithSupabase('realtime');
          return;
        }
        const latestFragments = await fetchFragmentsFromSupabase();
        if (latestFragments !== null && isMounted) {
          setFragments(latestFragments);
        }
      },
      async () => {
        const q = loadPendingSyncQueue(uid);
        if (hasPendingSyncItems(q)) {
          await reconcileWithSupabase('realtime');
          return;
        }
        const latestConns = await fetchDiscoverConnectionsFromSupabase();
        if (latestConns !== null && isMounted) {
          applyDbDiscoverConnections(latestConns, false);
        }
      }
    );

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, [authUser?.id]);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || notes[0];
  }, [notes, activeNoteId]);

  // Handlers
  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  const createNote = (type?: ManualNoteType): string => {
    const now = new Date().toISOString();
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
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [newNote, ...prev]);
    notesRef.current = [newNote, ...notesRef.current];
    activeNoteIdRef.current = newNote.id;
    setActiveNoteIdState(newNote.id);
    setActiveView('editor', newNote.id);

    if (canRemoteSync() && authUserRef.current) {
      const uid = authUserRef.current.id;
      enqueueUpsertNote(uid, newNote.id, now, true);
      if (isBrowserOnline()) {
        upsertNoteToSupabase(newNote)
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueUpsertNote(uid, newNote.id, now);
            }
          })
          .catch(console.warn);
      } else {
        setSyncStatus('offline');
      }
    } else {
      markOfflineDirtyIfLoggedOut();
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

    if (canRemoteSync() && updatedObj && authUserRef.current) {
      const uid = authUserRef.current.id;
      const snapshot = updatedObj;
      enqueueUpsertNote(uid, id, snapshot.updatedAt, false);

      if (embedTimersRef.current[id]) {
        clearTimeout(embedTimersRef.current[id]);
      }

      if (!isBrowserOnline()) {
        setSyncStatus('offline');
        return;
      }

      embedTimersRef.current[id] = setTimeout(async () => {
        if (!canRemoteSync() || authUserRef.current?.id !== uid) return;
        const ok = await syncNoteWithFallback(snapshot);
        if (ok && authUserRef.current?.id === uid) {
          dequeueUpsertNote(uid, id, snapshot.updatedAt);
        }
      }, 1500);
    } else if (updatedObj) {
      markOfflineDirtyIfLoggedOut();
    }
  };

  const linkRelatedNote = (noteId: string, targetNoteId: string) => {
    if (noteId === targetNoteId) return;
    markOfflineDirtyIfLoggedOut();
    const now = new Date().toISOString();
    const uid = authUserRef.current?.id;

    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === noteId && !n.relatedNoteIds.includes(targetNoteId)) {
          const updated = { ...n, relatedNoteIds: [...n.relatedNoteIds, targetNoteId], updatedAt: now };
          if (canRemoteSync() && uid) {
            enqueueUpsertNote(uid, updated.id, now, false);
            if (isBrowserOnline()) {
              upsertNoteToSupabase(updated)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertNote(uid, updated.id, now);
                  }
                })
                .catch(console.warn);
            }
          }
          return updated;
        }
        if (n.id === targetNoteId && !n.relatedNoteIds.includes(noteId)) {
          const updated = { ...n, relatedNoteIds: [...n.relatedNoteIds, noteId], updatedAt: now };
          if (canRemoteSync() && uid) {
            enqueueUpsertNote(uid, updated.id, now, false);
            if (isBrowserOnline()) {
              upsertNoteToSupabase(updated)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertNote(uid, updated.id, now);
                  }
                })
                .catch(console.warn);
            }
          }
          return updated;
        }
        return n;
      })
    );
  };

  const unlinkRelatedNote = (noteId: string, targetNoteId: string) => {
    markOfflineDirtyIfLoggedOut();
    const now = new Date().toISOString();
    const uid = authUserRef.current?.id;

    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === noteId) {
          const updated = {
            ...n,
            relatedNoteIds: n.relatedNoteIds.filter((id) => id !== targetNoteId),
            updatedAt: now,
          };
          if (canRemoteSync() && uid) {
            enqueueUpsertNote(uid, updated.id, now, false);
            if (isBrowserOnline()) {
              upsertNoteToSupabase(updated)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertNote(uid, updated.id, now);
                  }
                })
                .catch(console.warn);
            }
          }
          return updated;
        }
        if (n.id === targetNoteId) {
          const updated = {
            ...n,
            relatedNoteIds: n.relatedNoteIds.filter((id) => id !== noteId),
            updatedAt: now,
          };
          if (canRemoteSync() && uid) {
            enqueueUpsertNote(uid, updated.id, now, false);
            if (isBrowserOnline()) {
              upsertNoteToSupabase(updated)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertNote(uid, updated.id, now);
                  }
                })
                .catch(console.warn);
            }
          }
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
    const target = notesRef.current.find((n) => n.id === id);
    if (!target) return false;
    if (isNoteEffectivelyEmpty(target)) {
      if (embedTimersRef.current[id]) {
        clearTimeout(embedTimersRef.current[id]);
        delete embedTimersRef.current[id];
      }
      const remaining = notesRef.current.filter((n) => n.id !== id);
      notesRef.current = remaining;
      setNotes(remaining);
      if (activeNoteIdRef.current === id) {
        const nextId = remaining.length > 0 ? remaining[0].id : '';
        activeNoteIdRef.current = nextId;
        setActiveNoteIdState(nextId);
      }

      if (canRemoteSync() && authUserRef.current) {
        const uid = authUserRef.current.id;
        enqueueDeleteNote(uid, id);
        if (isBrowserOnline()) {
          deleteNoteFromSupabase(id)
            .then((ok) => {
              if (ok && authUserRef.current?.id === uid) {
                dequeueDeleteNote(uid, id);
              }
            })
            .catch(console.warn);
        }
      }
      return true;
    }
    return false;
  };

  const deleteNote = (id: string) => {
    if (embedTimersRef.current[id]) {
      clearTimeout(embedTimersRef.current[id]);
      delete embedTimersRef.current[id];
    }
    const remaining = notesRef.current.filter((n) => n.id !== id);
    notesRef.current = remaining;
    setNotes(remaining);
    if (activeNoteIdRef.current === id) {
      const nextId = remaining.length > 0 ? remaining[0].id : '';
      activeNoteIdRef.current = nextId;
      setActiveNoteIdState(nextId);
    }

    if (canRemoteSync() && authUserRef.current) {
      const uid = authUserRef.current.id;
      enqueueDeleteNote(uid, id);
      if (isBrowserOnline()) {
        deleteNoteFromSupabase(id)
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueDeleteNote(uid, id);
            }
          })
          .catch(console.warn);
      } else {
        setSyncStatus('offline');
      }
    }
  };

  const toggleFavoriteNote = (id: string) => {
    markOfflineDirtyIfLoggedOut();
    const now = new Date().toISOString();
    const uid = authUserRef.current?.id;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, favorite: !n.favorite, updatedAt: now };
          if (canRemoteSync() && uid) {
            enqueueUpsertNote(uid, id, now, false);
            if (isBrowserOnline()) {
              upsertNoteToSupabase(updated)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertNote(uid, id, now);
                  }
                })
                .catch(console.warn);
            } else {
              setSyncStatus('offline');
            }
          }
          return updated;
        }
        return n;
      })
    );
  };

  const toggleArchiveNote = (id: string) => {
    markOfflineDirtyIfLoggedOut();
    const now = new Date().toISOString();
    const uid = authUserRef.current?.id;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, archived: !n.archived, updatedAt: now };
          if (canRemoteSync() && uid) {
            enqueueUpsertNote(uid, id, now, false);
            if (isBrowserOnline()) {
              upsertNoteToSupabase(updated)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertNote(uid, id, now);
                  }
                })
                .catch(console.warn);
            } else {
              setSyncStatus('offline');
            }
          }
          return updated;
        }
        return n;
      })
    );
  };

  // =========================================================================
  // NAVIGATION METHODS (Synced with window.history & popstate)
  // =========================================================================
  const setActiveView = (view: ViewMode, overrideNoteId?: string) => {
    setIsMobileDrawerOpen(false);
    const poppedOverlays = dismissTopOverlaysSync();
    const baseCursor = Math.max(0, historyCursorRef.current - poppedOverlays);
    const baseEntry = historyStackRef.current[baseCursor] || initialHistoryEntry;
    const prevNoteId = activeNoteIdRef.current;
    const targetNoteId = overrideNoteId ?? prevNoteId;

    // Discard empty note if leaving editor or switching notes
    let discardedCurrentEditorNote = false;
    if (
      activeViewRef.current === 'editor' &&
      prevNoteId &&
      (view !== 'editor' || prevNoteId !== targetNoteId)
    ) {
      discardedCurrentEditorNote = discardNoteIfEmpty(prevNoteId);
    }

    // 1. Navigating to Home -> Always rewind cleanly to root (depth 0)
    if (view === 'home') {
      const totalPops = historyCursorRef.current;
      historyStackRef.current = [initialHistoryEntry];
      historyCursorRef.current = 0;
      applyEntryToReactState(initialHistoryEntry);
      if (totalPops > 0) {
        window.history.go(-totalPops);
      } else {
        window.history.replaceState(initialHistoryEntry, '');
      }
      return;
    }

    if (view === 'library') {
      lastLibraryNoteIdRef.current = null;
    } else if (view === 'editor') {
      lastLibraryNoteIdRef.current = targetNoteId || null;
    }

    // 2. Top-Level Hub-and-Spoke Views (Opsi B: live at depth 1 above Home)
    if (TOP_LEVEL_VIEWS.has(view)) {
      const targetEntry: NoesisHistoryEntry = {
        __noesis: true,
        idx: 1,
        view,
        noteId: '',
        fragmentDrawerOpen: false,
        fragmentId: null,
        overlayId: null,
      };

      const curCursor = historyCursorRef.current;
      if (curCursor === 0) {
        historyStackRef.current = [historyStackRef.current[0] || initialHistoryEntry, targetEntry];
        historyCursorRef.current = 1;
        applyEntryToReactState(targetEntry);
        window.history.pushState(targetEntry, '');
      } else if (curCursor === 1) {
        if (
          baseEntry.view === view &&
          !baseEntry.fragmentDrawerOpen &&
          poppedOverlays === 0
        ) {
          return;
        }
        historyStackRef.current = [historyStackRef.current[0] || initialHistoryEntry, targetEntry];
        historyCursorRef.current = 1;
        applyEntryToReactState(targetEntry);
        window.history.replaceState(targetEntry, '');
      } else {
        const delta = curCursor - 1;
        historyStackRef.current = [historyStackRef.current[0] || initialHistoryEntry, targetEntry];
        historyCursorRef.current = 1;
        expectedPopIdxRef.current = 1;
        pendingNavAfterGoRef.current = () => {
          window.history.replaceState(targetEntry, '');
        };
        applyEntryToReactState(targetEntry);
        window.history.go(-delta);
      }
      return;
    }

    // 3. Sub-pages ('editor', 'settings')
    const resolvedNoteId = view === 'editor' ? targetNoteId : '';
    if (
      poppedOverlays === 0 &&
      baseEntry.view === view &&
      baseEntry.noteId === resolvedNoteId &&
      !baseEntry.fragmentDrawerOpen
    ) {
      return;
    }

    let replaceSteps = poppedOverlays;
    if (discardedCurrentEditorNote && baseEntry.view === 'editor' && baseCursor > 0) {
      replaceSteps += 1;
    }

    const targetIdx = Math.max(1, historyCursorRef.current - replaceSteps + 1);
    const nextEntry: NoesisHistoryEntry = {
      __noesis: true,
      idx: targetIdx,
      view,
      noteId: resolvedNoteId,
      fragmentDrawerOpen: false,
      fragmentId: null,
      overlayId: null,
    };

    if (replaceSteps === 0) {
      historyStackRef.current = [...historyStackRef.current.slice(0, targetIdx), nextEntry];
      historyCursorRef.current = targetIdx;
      applyEntryToReactState(nextEntry);
      window.history.pushState(nextEntry, '');
    } else if (replaceSteps === 1) {
      historyStackRef.current = [...historyStackRef.current.slice(0, targetIdx), nextEntry];
      historyCursorRef.current = targetIdx;
      applyEntryToReactState(nextEntry);
      window.history.replaceState(nextEntry, '');
    } else {
      const delta = replaceSteps - 1;
      historyStackRef.current = [...historyStackRef.current.slice(0, targetIdx), nextEntry];
      historyCursorRef.current = targetIdx;
      expectedPopIdxRef.current = targetIdx;
      pendingNavAfterGoRef.current = () => {
        window.history.replaceState(nextEntry, '');
      };
      applyEntryToReactState(nextEntry);
      window.history.go(-delta);
    }
  };

  const setActiveNoteId = (id: string) => {
    const prevId = activeNoteIdRef.current;
    activeNoteIdRef.current = id;
    setActiveNoteIdState(id);

    if (activeViewRef.current === 'editor' && id && id !== prevId) {
      setActiveView('editor', id);
    }
  };

  const openNoteFromFragment = (noteId: string) => {
    activeNoteIdRef.current = noteId;
    setActiveNoteIdState(noteId);
    setActiveView('editor', noteId);
  };

  const openFragmentDrawer = (fragmentId?: string | null) => {
    setIsMobileDrawerOpen(false);
    const nextFragId = fragmentId ?? null;
    lastFragmentIdRef.current = nextFragId;
    const poppedOverlays = dismissTopOverlaysSync();
    const baseCursor = Math.max(0, historyCursorRef.current - poppedOverlays);
    const baseEntry = historyStackRef.current[baseCursor] || initialHistoryEntry;

    if (
      poppedOverlays === 0 &&
      baseEntry.fragmentDrawerOpen &&
      baseEntry.fragmentId === nextFragId
    ) {
      return;
    }

    const targetIdx = Math.max(1, historyCursorRef.current - poppedOverlays + 1);
    const nextEntry: NoesisHistoryEntry = {
      __noesis: true,
      idx: targetIdx,
      view: baseEntry.view,
      noteId: baseEntry.noteId,
      fragmentDrawerOpen: true,
      fragmentId: nextFragId,
      overlayId: null,
    };

    if (poppedOverlays === 0) {
      historyStackRef.current = [...historyStackRef.current.slice(0, targetIdx), nextEntry];
      historyCursorRef.current = targetIdx;
      applyEntryToReactState(nextEntry);
      window.history.pushState(nextEntry, '');
    } else if (poppedOverlays === 1) {
      historyStackRef.current = [...historyStackRef.current.slice(0, targetIdx), nextEntry];
      historyCursorRef.current = targetIdx;
      applyEntryToReactState(nextEntry);
      window.history.replaceState(nextEntry, '');
    } else {
      const delta = poppedOverlays - 1;
      historyStackRef.current = [...historyStackRef.current.slice(0, targetIdx), nextEntry];
      historyCursorRef.current = targetIdx;
      expectedPopIdxRef.current = targetIdx;
      pendingNavAfterGoRef.current = () => {
        window.history.replaceState(nextEntry, '');
      };
      applyEntryToReactState(nextEntry);
      window.history.go(-delta);
    }
  };

  const closeFragmentDrawer = () => {
    lastFragmentIdRef.current = null;
    const poppedOverlays = dismissTopOverlaysSync();
    let targetCursor = Math.max(0, historyCursorRef.current - poppedOverlays);

    while (targetCursor > 0 && historyStackRef.current[targetCursor]?.fragmentDrawerOpen) {
      targetCursor -= 1;
    }

    const totalPops = historyCursorRef.current - targetCursor;
    if (totalPops > 0) {
      const targetEntry = historyStackRef.current[targetCursor] || initialHistoryEntry;
      historyStackRef.current = historyStackRef.current.slice(0, targetCursor + 1);
      historyCursorRef.current = targetCursor;
      applyEntryToReactState(targetEntry);
      window.history.go(-totalPops);
    } else {
      isFragmentDrawerOpenRef.current = false;
      activeFragmentIdRef.current = null;
      setIsFragmentDrawerOpen(false);
      setActiveFragmentId(null);
      setIsQuickCaptureOpen(false);
    }
  };

  const navigateBack = () => {
    lastLibraryNoteIdRef.current = null;
    if (historyCursorRef.current > 0) {
      window.history.back();
      return;
    }
    if (activeViewRef.current === 'editor' && activeNoteIdRef.current) {
      discardNoteIfEmpty(activeNoteIdRef.current);
      setActiveView('library');
    } else if (activeViewRef.current !== 'home') {
      setActiveView('home');
    }
  };

  const selectTab = (targetTab: ViewMode) => {
    setIsMobileDrawerOpen(false);

    // 1. LIBRARY TAB
    if (targetTab === 'library') {
      // If currently inside an open note in Editor -> POP TO ROOT (return to main library list)
      if (activeViewRef.current === 'editor') {
        lastLibraryNoteIdRef.current = null;
        if (activeNoteIdRef.current) {
          discardNoteIfEmpty(activeNoteIdRef.current);
        }
        setActiveView('library');
        return;
      }

      // If already at main library list -> SCROLL TO TOP
      if (activeViewRef.current === 'library') {
        scrollToTop('library');
        return;
      }

      // Coming from another tab (e.g. Home, Fragments, Discover)
      // Check if we remembered an open note in Library
      const rememberedNoteId = lastLibraryNoteIdRef.current;
      if (rememberedNoteId && notesRef.current.some((n) => n.id === rememberedNoteId && !n.archived)) {
        setActiveView('editor', rememberedNoteId);
      } else {
        setActiveView('library');
      }
      return;
    }

    // 2. FRAGMENTS TAB
    if (targetTab === 'fragments' || targetTab === 'capture') {
      // If currently viewing a fragment in Drawer -> POP TO ROOT (close drawer)
      if (isFragmentDrawerOpenRef.current) {
        closeFragmentDrawer();
        lastFragmentIdRef.current = null;
        return;
      }

      // If already on fragments list -> SCROLL TO TOP
      if (activeViewRef.current === 'fragments' || activeViewRef.current === 'capture') {
        scrollToTop('fragments');
        return;
      }

      // Coming from another tab: check if a fragment was open
      const rememberedFragId = lastFragmentIdRef.current;
      if (rememberedFragId && fragmentsRef.current.some((f) => f.id === rememberedFragId)) {
        setActiveView('fragments');
        openFragmentDrawer(rememberedFragId);
      } else {
        setActiveView('fragments');
      }
      return;
    }

    // 3. HOME TAB
    if (targetTab === 'home') {
      if (activeViewRef.current === 'home') {
        scrollToTop('home');
        return;
      }
      setActiveView('home');
      return;
    }

    // 4. DISCOVER TAB
    if (targetTab === 'discover') {
      if (activeViewRef.current === 'discover') {
        scrollToTop(`discover:${discoverTab}`);
        return;
      }
      setActiveView('discover');
      return;
    }

    // 5. PROJECTS TAB
    if (targetTab === 'projects') {
      if (activeViewRef.current === 'projects') {
        scrollToTop('projects');
        return;
      }
      setActiveView('projects');
      return;
    }

    // 6. SETTINGS TAB
    if (targetTab === 'settings') {
      if (activeViewRef.current === 'settings') {
        scrollToTop('settings');
        return;
      }
      setActiveView('settings');
      return;
    }

    setActiveView(targetTab);
  };

  const exitDeletedNote = (deletedNoteId: string) => {
    if (lastLibraryNoteIdRef.current === deletedNoteId) {
      lastLibraryNoteIdRef.current = null;
    }
    dismissTopOverlaysSync();
    let targetCursor = historyCursorRef.current;
    while (
      targetCursor > 0 &&
      (historyStackRef.current[targetCursor]?.overlayId !== null ||
        (historyStackRef.current[targetCursor]?.view === 'editor' &&
          historyStackRef.current[targetCursor]?.noteId === deletedNoteId))
    ) {
      targetCursor -= 1;
    }

    const delta = historyCursorRef.current - targetCursor;
    const targetEntry = historyStackRef.current[targetCursor] || initialHistoryEntry;
    historyStackRef.current = historyStackRef.current.slice(0, targetCursor + 1);
    historyCursorRef.current = targetCursor;
    applyEntryToReactState(targetEntry);

    if (delta > 0) {
      window.history.go(-delta);
    } else {
      setActiveView('library');
    }
  };

  const exitDeletedFragment = (deletedFragmentId: string) => {
    if (lastFragmentIdRef.current === deletedFragmentId) {
      lastFragmentIdRef.current = null;
    }
    dismissTopOverlaysSync();
    let targetCursor = historyCursorRef.current;
    while (
      targetCursor > 0 &&
      (historyStackRef.current[targetCursor]?.overlayId !== null ||
        (historyStackRef.current[targetCursor]?.fragmentDrawerOpen &&
          historyStackRef.current[targetCursor]?.fragmentId === deletedFragmentId))
    ) {
      targetCursor -= 1;
    }

    const delta = historyCursorRef.current - targetCursor;
    const targetEntry = historyStackRef.current[targetCursor] || initialHistoryEntry;
    historyStackRef.current = historyStackRef.current.slice(0, targetCursor + 1);
    historyCursorRef.current = targetCursor;
    applyEntryToReactState(targetEntry);

    if (delta > 0) {
      window.history.go(-delta);
    }
  };

  // Initialize root history entry and handle OS/Browser Back (`popstate`)
  useEffect(() => {
    window.history.replaceState(initialHistoryEntry, '');

    const handlePopState = (event: PopStateEvent) => {
      const incoming = event.state as NoesisHistoryEntry | null;

      if (pendingNavAfterGoRef.current && incoming?.idx === expectedPopIdxRef.current) {
        const fn = pendingNavAfterGoRef.current;
        pendingNavAfterGoRef.current = null;
        expectedPopIdxRef.current = null;
        fn();
        return;
      }

      if (!incoming || !incoming.__noesis) {
        overlaysRef.current.forEach((closeFn) => closeFn());
        overlaysRef.current.clear();
        closingOverlayIdsRef.current.clear();
        historyStackRef.current = [initialHistoryEntry];
        historyCursorRef.current = 0;
        applyEntryToReactState(initialHistoryEntry);
        window.history.replaceState(initialHistoryEntry, '');
        return;
      }

      const prevCursor = historyCursorRef.current;
      const prevEntry = historyStackRef.current[prevCursor];
      const nextIdx = incoming.idx;

      // Already synced synchronously by programmatic navigation / overlay close
      if (nextIdx === prevCursor) {
        return;
      }

      if (nextIdx < prevCursor) {
        for (let i = prevCursor; i > nextIdx; i--) {
          const popped = historyStackRef.current[i];
          if (popped?.overlayId) {
            const closeFn = overlaysRef.current.get(popped.overlayId);
            overlaysRef.current.delete(popped.overlayId);
            closingOverlayIdsRef.current.delete(popped.overlayId);
            closeFn?.();
          }
        }

        if (
          prevEntry?.view === 'editor' &&
          prevEntry.noteId &&
          (incoming.view !== 'editor' || incoming.noteId !== prevEntry.noteId)
        ) {
          lastLibraryNoteIdRef.current = null;
          discardNoteIfEmpty(prevEntry.noteId);
        }
        if (prevEntry?.fragmentDrawerOpen && !incoming.fragmentDrawerOpen) {
          lastFragmentIdRef.current = null;
        }
      }

      // Guard against landing on a deleted Note or deleted Fragment (e.g. browser Forward)
      let resolvedEntry = incoming;
      if (resolvedEntry.overlayId && nextIdx > prevCursor) {
        resolvedEntry = { ...resolvedEntry, overlayId: null };
        window.history.replaceState(resolvedEntry, '');
      }

      if (
        resolvedEntry.view === 'editor' &&
        resolvedEntry.noteId &&
        !notesRef.current.some((n) => n.id === resolvedEntry.noteId)
      ) {
        if (nextIdx > 0) {
          window.history.back();
          return;
        }
        resolvedEntry = initialHistoryEntry;
        window.history.replaceState(resolvedEntry, '');
      }

      if (
        resolvedEntry.fragmentDrawerOpen &&
        resolvedEntry.fragmentId &&
        !fragmentsRef.current.some((f) => f.id === resolvedEntry.fragmentId)
      ) {
        resolvedEntry = {
          ...resolvedEntry,
          fragmentDrawerOpen: false,
          fragmentId: null,
        };
        window.history.replaceState(resolvedEntry, '');
      }

      historyStackRef.current = [
        ...historyStackRef.current.slice(0, nextIdx),
        resolvedEntry,
      ];
      historyCursorRef.current = nextIdx;
      applyEntryToReactState(resolvedEntry);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const formatDateDDMMYYYY = (d: Date = new Date()) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const createFragment = (data: { type: FragmentType; title: string; content: string; tags: string[]; source?: string }): string => {
    const id = `fragment-${Date.now()}`;
    const now = new Date().toISOString();
    const newFragment: Fragment = {
      id,
      type: data.type,
      title: data.title || 'Untitled Fragment',
      content: data.content,
      tags: data.tags,
      source: data.source,
      date: formatDateDDMMYYYY(),
      updatedAt: now,
      starred: false,
    };
    setFragments((prev) => [newFragment, ...prev]);

    if (canRemoteSync() && authUserRef.current) {
      const uid = authUserRef.current.id;
      enqueueUpsertFragment(uid, id, now, true);
      if (isBrowserOnline()) {
        upsertFragmentToSupabase(newFragment)
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueUpsertFragment(uid, id, now);
            }
          })
          .catch(console.warn);
      } else {
        setSyncStatus('offline');
      }
    } else {
      markOfflineDirtyIfLoggedOut();
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

    if (canRemoteSync() && updatedFragObj && authUserRef.current) {
      const uid = authUserRef.current.id;
      const snapshot = updatedFragObj;
      enqueueUpsertFragment(uid, id, updatedAt, false);

      if (!isBrowserOnline()) {
        setSyncStatus('offline');
        return;
      }

      // Preserve existing vector embedding unless user explicitly removes it
      upsertFragmentToSupabase(snapshot)
        .then((ok) => {
          if (ok && !snapshot.embeddedAt && authUserRef.current?.id === uid) {
            dequeueUpsertFragment(uid, id, updatedAt);
          }
        })
        .catch(console.warn);

      // Only auto re-embed if the user already opted this Fragment into vector embedding
      if (snapshot.embeddedAt) {
        if (fragEmbedTimersRef.current[id]) {
          clearTimeout(fragEmbedTimersRef.current[id]);
        }
        fragEmbedTimersRef.current[id] = setTimeout(async () => {
          if (!canRemoteSync() || authUserRef.current?.id !== uid) return;
          const ok = await embedAndSyncFragment(snapshot);
          if (ok) {
            const nowIso = new Date().toISOString();
            setFragments((prev) =>
              prev.map((f) => (f.id === id ? { ...f, embeddedAt: nowIso } : f))
            );
            if (authUserRef.current?.id === uid) {
              dequeueUpsertFragment(uid, id, updatedAt);
            }
          } else {
            const fallbackOk = await upsertFragmentToSupabase(snapshot);
            if (fallbackOk && authUserRef.current?.id === uid) {
              dequeueUpsertFragment(uid, id, updatedAt);
            }
          }
        }, 1500);
      }
    } else if (updatedFragObj) {
      markOfflineDirtyIfLoggedOut();
    }
  };

  const deleteFragment = (id: string) => {
    if (fragEmbedTimersRef.current[id]) {
      clearTimeout(fragEmbedTimersRef.current[id]);
      delete fragEmbedTimersRef.current[id];
    }
    const nextFragments = fragmentsRef.current.filter((f) => f.id !== id);
    fragmentsRef.current = nextFragments;
    setFragments(nextFragments);
    if (activeFragmentIdRef.current === id) {
      exitDeletedFragment(id);
    }
    if (canRemoteSync() && authUserRef.current) {
      const uid = authUserRef.current.id;
      enqueueDeleteFragment(uid, id);
      if (isBrowserOnline()) {
        deleteFragmentFromSupabase(id)
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueDeleteFragment(uid, id);
            }
          })
          .catch(console.warn);
      } else {
        setSyncStatus('offline');
      }
    }
  };

  const toggleStarFragment = (id: string) => {
    markOfflineDirtyIfLoggedOut();
    const now = new Date().toISOString();
    const uid = authUserRef.current?.id;
    setFragments((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updated = { ...f, starred: !f.starred, updatedAt: now };
          if (canRemoteSync() && uid) {
            enqueueUpsertFragment(uid, id, now, false);
            if (isBrowserOnline()) {
              upsertFragmentToSupabase(updated)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertFragment(uid, id, now);
                  }
                })
                .catch(console.warn);
            } else {
              setSyncStatus('offline');
            }
          }
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

  const approvedRef = useRef<string[]>(approvedConnections);
  approvedRef.current = approvedConnections;
  const dismissedRef = useRef<string[]>(dismissedConnections);
  dismissedRef.current = dismissedConnections;
  const analysesRef = useRef<Record<string, ConnectionAnalysis>>(connectionAnalyses);
  analysesRef.current = connectionAnalyses;

  useEffect(() => {
    if (!authUser && !offlineBypass && dismissedConnections.length === 0) {
      localStorage.removeItem('noesis_dismissed_connections');
    } else {
      localStorage.setItem('noesis_dismissed_connections', JSON.stringify(dismissedConnections));
    }
  }, [dismissedConnections, authUser, offlineBypass]);

  useEffect(() => {
    if (!authUser && !offlineBypass && approvedConnections.length === 0) {
      localStorage.removeItem('noesis_approved_connections');
    } else {
      localStorage.setItem('noesis_approved_connections', JSON.stringify(approvedConnections));
    }
  }, [approvedConnections, authUser, offlineBypass]);

  useEffect(() => {
    if (!authUser && !offlineBypass && Object.keys(connectionAnalyses).length === 0) {
      localStorage.removeItem('noesis_discover_analyses');
    } else {
      localStorage.setItem('noesis_discover_analyses', JSON.stringify(connectionAnalyses));
    }
  }, [connectionAnalyses, authUser, offlineBypass]);

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
    const now = new Date().toISOString();
    setDismissedConnections((prev) => (prev.includes(pairKey) ? prev : [...prev, pairKey]));
    setApprovedConnections((prev) => prev.filter((k) => k !== pairKey));

    if (canRemoteSync() && authUserRef.current) {
      const uid = authUserRef.current.id;
      enqueueUpsertConnection(uid, pairKey, now);
      if (isBrowserOnline()) {
        upsertDiscoverConnectionToSupabase({
          pairKey,
          itemAId: first.id,
          itemAKind: first.kind,
          itemBId: second.id,
          itemBKind: second.kind,
          status: 'dismissed',
          analysis: connectionAnalyses[pairKey],
          updatedAt: now,
        })
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueUpsertConnection(uid, pairKey, now);
            }
          })
          .catch(console.warn);
      }
    } else {
      markOfflineDirtyIfLoggedOut();
    }
  };

  const resetDismissedConnections = () => {
    setDismissedConnections([]);
    if (canRemoteSync()) {
      restoreDismissedDiscoverConnectionsInSupabase().catch(console.warn);
    }
  };

  const approveConnection = (itemA: DiscoverSourceItem, itemB: DiscoverSourceItem) => {
    const { pairKey, first, second } = buildCanonicalPair(itemA, itemB);
    const now = new Date().toISOString();
    setApprovedConnections((prev) => (prev.includes(pairKey) ? prev : [...prev, pairKey]));
    setDismissedConnections((prev) => prev.filter((k) => k !== pairKey));

    if (itemA.kind === 'note' && itemB.kind === 'note') {
      linkRelatedNote(itemA.id, itemB.id);
    }

    if (canRemoteSync() && authUserRef.current) {
      const uid = authUserRef.current.id;
      enqueueUpsertConnection(uid, pairKey, now);
      if (isBrowserOnline()) {
        upsertDiscoverConnectionToSupabase({
          pairKey,
          itemAId: first.id,
          itemAKind: first.kind,
          itemBId: second.id,
          itemBKind: second.kind,
          status: 'approved',
          analysis: connectionAnalyses[pairKey],
          updatedAt: now,
        })
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueUpsertConnection(uid, pairKey, now);
            }
          })
          .catch(console.warn);
      }
    } else {
      markOfflineDirtyIfLoggedOut();
    }
  };

  const saveConnectionAnalysis = (
    itemA: DiscoverSourceItem,
    itemB: DiscoverSourceItem,
    analysis: ConnectionAnalysis
  ) => {
    const { pairKey, first, second } = buildCanonicalPair(itemA, itemB);
    const now = new Date().toISOString();
    setConnectionAnalyses((prev) => ({
      ...prev,
      [pairKey]: analysis,
    }));

    if (canRemoteSync() && authUserRef.current) {
      const uid = authUserRef.current.id;
      enqueueUpsertConnection(uid, pairKey, now);
      if (isBrowserOnline()) {
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
          updatedAt: now,
        })
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueUpsertConnection(uid, pairKey, now);
            }
          })
          .catch(console.warn);
      }
    } else {
      markOfflineDirtyIfLoggedOut();
    }
  };

  const unlinkDiscoverConnection = (idA: string, idB: string) => {
    const pairKey = makePairKey(idA, idB);
    setApprovedConnections((prev) => prev.filter((k) => k !== pairKey));
    if (canRemoteSync() && authUserRef.current) {
      const uid = authUserRef.current.id;
      enqueueDeleteConnection(uid, pairKey);
      if (isBrowserOnline()) {
        unlinkDiscoverConnectionInSupabase(pairKey)
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueDeleteConnection(uid, pairKey);
            }
          })
          .catch(console.warn);
      }
    } else {
      markOfflineDirtyIfLoggedOut();
    }
  };

  const promoteFragmentToNote = async (
    fragmentId: string
  ): Promise<{ ok: boolean; noteId?: string; error?: string }> => {
    const frag = fragments.find((f) => f.id === fragmentId);
    if (!frag) {
      return { ok: false, error: 'Fragment tidak ditemukan.' };
    }

    if (canRemoteSync() && !isBrowserOnline()) {
      return {
        ok: false,
        error:
          'Koneksi internet terputus. Naikkan pangkat Fragment ke Note saat online agar salinan, relasi, dan embedding di Supabase tetap aman.',
      };
    }

    const pairMatchesFragment = (pairKey: string) => {
      const parts = pairKey.split('::');
      return parts.length === 2 && (parts[0] === frag.id || parts[1] === frag.id);
    };

    // 1. Collect all approved relations (Notes -> relatedNoteIds, Fragments -> discover_connections)
    const connectedIds = new Set<string>();
    for (const pairKey of approvedConnections) {
      const parts = pairKey.split('::');
      if (parts.length !== 2) continue;
      if (parts[0] === frag.id) connectedIds.add(parts[1]);
      else if (parts[1] === frag.id) connectedIds.add(parts[0]);
    }

    const connectedNotes = notes.filter((n) => !n.archived && connectedIds.has(n.id));
    const connectedNoteIds = connectedNotes.map((n) => n.id);
    const connectedFragments = fragments.filter(
      (f) => f.id !== frag.id && connectedIds.has(f.id)
    );

    // 2. Convert plain text Fragment content into clean Tiptap HTML paragraphs
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

    let copiedEmbedding: number[] | undefined;
    let resolvedEmbeddedAt: string | undefined;

    // 3. Commit-First in Supabase (if authenticated & configured) before touching local state or deleting old Fragment
    if (canRemoteSync()) {
      if (frag.embeddedAt) {
        const embedRes = await fetchFragmentEmbeddingById(frag.id);
        if (!embedRes.ok) {
          return {
            ok: false,
            error:
              'Gagal mengambil vector embedding dari Supabase. Fragment asli tetap aman dan tidak dihapus.',
          };
        }
        if (embedRes.embedding) {
          copiedEmbedding = embedRes.embedding;
          resolvedEmbeddedAt = embedRes.embeddedAt || frag.embeddedAt || now;
        }
      }
    }

    const newNote: Note = {
      id: newId,
      title: frag.title || 'Untitled Note',
      content: htmlContent,
      excerpt: plainText.slice(0, 180),
      type: frag.type || 'thought',
      tags: frag.tags && frag.tags.length > 0 ? [...frag.tags] : [],
      source: frag.source || undefined,
      favorite: Boolean(frag.starred),
      archived: false,
      relatedNoteIds: connectedNoteIds,
      createdAt: now,
      updatedAt: now,
      embeddedAt: resolvedEmbeddedAt,
    };

    const migratedFragmentConnections: {
      linkedFrag: Fragment;
      newPairKey: string;
      analysis?: ConnectionAnalysis;
    }[] = connectedFragments.map((linkedFrag) => {
      const oldPairKey = makePairKey(frag.id, linkedFrag.id);
      const newPairKey = makePairKey(newNote.id, linkedFrag.id);
      return {
        linkedFrag,
        newPairKey,
        analysis: connectionAnalyses[oldPairKey],
      };
    });

    if (canRemoteSync()) {
      // Cancel any pending auto-embed timer on the fragment so it won't race
      if (fragEmbedTimersRef.current[frag.id]) {
        clearTimeout(fragEmbedTimersRef.current[frag.id]);
        delete fragEmbedTimersRef.current[frag.id];
      }

      // Step 3a: Insert new Note (with copied embedding vector if present)
      const noteInserted = await upsertNoteToSupabase(newNote, copiedEmbedding);
      if (!noteInserted) {
        return {
          ok: false,
          error:
            'Gagal menyalin data Note ke Supabase. Fragment asli tetap aman dan tidak dihapus.',
        };
      }

      // Step 3b: Link relatedNoteIds bidirectionally on connected Notes in Supabase
      for (const linkedNote of connectedNotes) {
        if (!linkedNote.relatedNoteIds.includes(newNote.id)) {
          const updatedLinkedNote: Note = {
            ...linkedNote,
            relatedNoteIds: [...linkedNote.relatedNoteIds, newNote.id],
            updatedAt: now,
          };
          const linkedOk = await upsertNoteToSupabase(updatedLinkedNote);
          if (!linkedOk) {
            return {
              ok: false,
              error:
                'Note baru berhasil dibuat, namun gagal menyalin relasi Note terkait di Supabase. Fragment lama dipertahankan agar aman.',
            };
          }
        }
      }

      // Step 3c: Migrate connected Fragment links in discover_connections to new Note ID
      const newNoteItem = noteToDiscoverItem(newNote);
      for (const { linkedFrag, newPairKey, analysis } of migratedFragmentConnections) {
        const fragItem = fragmentToDiscoverItem(linkedFrag);
        const first = newNoteItem.id < fragItem.id ? newNoteItem : fragItem;
        const second = newNoteItem.id < fragItem.id ? fragItem : newNoteItem;

        const connOk = await upsertDiscoverConnectionToSupabase({
          pairKey: newPairKey,
          itemAId: first.id,
          itemAKind: first.kind,
          itemBId: second.id,
          itemBKind: second.kind,
          status: 'approved',
          analysis,
          updatedAt: now,
        });

        if (!connOk) {
          return {
            ok: false,
            error:
              'Note baru berhasil dibuat, namun gagal memindahkan koneksi Fragment di Supabase. Fragment lama dipertahankan agar aman.',
          };
        }
      }

      // Step 3d: Delete-Last — only now remove old discover_connections rows and old Fragment row
      await deleteDiscoverConnectionsForItem(frag.id);
      const fragDeleted = await deleteFragmentFromSupabase(frag.id);
      if (!fragDeleted) {
        return {
          ok: false,
          error:
            'Note & seluruh relasi berhasil disalin ke Library, namun gagal menghapus Fragment lama dari Supabase.',
        };
      }
    } else {
      markOfflineDirtyIfLoggedOut();
    }

    // 4. All remote steps succeeded (or running offline): update React state atomically
    setNotes((prev) => {
      const updatedExisting = prev.map((n) => {
        if (connectedNoteIds.includes(n.id) && !n.relatedNoteIds.includes(newId)) {
          return { ...n, relatedNoteIds: [...n.relatedNoteIds, newId], updatedAt: now };
        }
        return n;
      });
      return [newNote, ...updatedExisting];
    });

    setApprovedConnections((prev) => {
      const cleaned = prev.filter((k) => !pairMatchesFragment(k));
      const added = migratedFragmentConnections.map((m) => m.newPairKey);
      return Array.from(new Set([...cleaned, ...added]));
    });

    setDismissedConnections((prev) => prev.filter((k) => !pairMatchesFragment(k)));

    setConnectionAnalyses((prev) => {
      const next: Record<string, ConnectionAnalysis> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!pairMatchesFragment(k)) {
          next[k] = v;
        }
      }
      for (const { newPairKey, analysis } of migratedFragmentConnections) {
        if (analysis) {
          next[newPairKey] = analysis;
        }
      }
      return next;
    });

    const nextFragments = fragmentsRef.current.filter((f) => f.id !== frag.id);
    fragmentsRef.current = nextFragments;
    setFragments(nextFragments);
    notesRef.current = [newNote, ...notesRef.current];

    // Replace FragmentDrawer (and any confirmation overlay) in history with the promoted Note Editor
    dismissTopOverlaysSync();
    let baseCursor = historyCursorRef.current;
    while (baseCursor > 0 && historyStackRef.current[baseCursor]?.fragmentDrawerOpen) {
      baseCursor -= 1;
    }
    const targetIdx = baseCursor + 1;
    const promotedEntry: NoesisHistoryEntry = {
      __noesis: true,
      idx: targetIdx,
      view: 'editor',
      noteId: newId,
      fragmentDrawerOpen: false,
      fragmentId: null,
      overlayId: null,
    };

    const delta = historyCursorRef.current - targetIdx;
    historyStackRef.current = [...historyStackRef.current.slice(0, targetIdx), promotedEntry];
    historyCursorRef.current = targetIdx;
    applyEntryToReactState(promotedEntry);

    if (delta > 0) {
      expectedPopIdxRef.current = targetIdx;
      pendingNavAfterGoRef.current = () => {
        window.history.replaceState(promotedEntry, '');
      };
      window.history.go(-delta);
    } else if (delta === 0) {
      window.history.replaceState(promotedEntry, '');
    } else {
      window.history.pushState(promotedEntry, '');
    }

    return { ok: true, noteId: newId };
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
  }: {
    title: string;
    htmlContent: string;
    tags: string[];
    sourceItems: DiscoverSourceItem[];
  }): string => {
    const newId = `note-${Date.now()}`;
    const noteIds = Array.from(
      new Set(sourceItems.filter((item) => item.kind === 'note').map((item) => item.id))
    );
    const fragmentItems = sourceItems.filter((item) => item.kind === 'fragment');

    const cleanedBodyHtml = stripSynthesisSourcesFooter(htmlContent) || htmlContent;
    const sourceListHtml = sourceItems
      .map(
        (item) =>
          `<li>[${item.kind === 'fragment' ? 'Fragment' : 'Catatan'}] ${item.title || 'Tanpa Judul'}</li>`
      )
      .join('');

    const finalHtml = `${cleanedBodyHtml}<hr><p><strong>Sumber Pengetahuan (${sourceItems.length}):</strong></p><ul>${sourceListHtml}</ul>`;
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
      type: 'synthesis',
      tags: cleanTags,
      source: sourceLabel,
      favorite: false,
      archived: false,
      relatedNoteIds: noteIds,
      createdAt: now,
      updatedAt: now,
    };

    // Save synthesized document to Library & link bidirectionally without modifying source contents
    const uid = authUserRef.current?.id;
    setNotes((prev) => {
      const updatedExisting = prev.map((n) => {
        if (noteIds.includes(n.id) && !n.relatedNoteIds.includes(newId)) {
          const linked = { ...n, relatedNoteIds: [...n.relatedNoteIds, newId], updatedAt: now };
          if (canRemoteSync() && uid) {
            enqueueUpsertNote(uid, linked.id, now, false);
            if (isBrowserOnline()) {
              upsertNoteToSupabase(linked)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertNote(uid, linked.id, now);
                  }
                })
                .catch(console.warn);
            }
          }
          return linked;
        }
        return n;
      });
      return [newNote, ...updatedExisting];
    });

    // Record fragment provenance in approvedConnections / discover_connections
    if (fragmentItems.length > 0) {
      const newNoteItem = noteToDiscoverItem(newNote);
      const addedPairKeys: string[] = [];
      for (const fragItem of fragmentItems) {
        const { pairKey, first, second } = buildCanonicalPair(newNoteItem, fragItem);
        addedPairKeys.push(pairKey);
        if (canRemoteSync() && uid) {
          enqueueUpsertConnection(uid, pairKey, now);
          if (isBrowserOnline()) {
            upsertDiscoverConnectionToSupabase({
              pairKey,
              itemAId: first.id,
              itemAKind: first.kind,
              itemBId: second.id,
              itemBKind: second.kind,
              status: 'approved',
              analysis: connectionAnalyses[pairKey],
              updatedAt: now,
            })
              .then((ok) => {
                if (ok && authUserRef.current?.id === uid) {
                  dequeueUpsertConnection(uid, pairKey, now);
                }
              })
              .catch(console.warn);
          }
        }
      }
      if (addedPairKeys.length > 0) {
        setApprovedConnections((prev) => Array.from(new Set([...prev, ...addedPairKeys])));
      }
    }

    if (canRemoteSync() && uid) {
      enqueueUpsertNote(uid, newNote.id, now, true);
      if (isBrowserOnline()) {
        syncNoteWithFallback(newNote)
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueUpsertNote(uid, newNote.id, now);
            }
          })
          .catch(console.warn);
      } else {
        setSyncStatus('offline');
      }
    } else {
      markOfflineDirtyIfLoggedOut();
    }

    return newId;
  };

  const updateSynthesizedNote = ({
    targetNoteId,
    title,
    htmlContent,
    tags,
    newSourceItems,
    allResolvedSourceItems,
  }: {
    targetNoteId: string;
    title: string;
    htmlContent: string;
    tags: string[];
    newSourceItems: DiscoverSourceItem[];
    allResolvedSourceItems: DiscoverSourceItem[];
  }): boolean => {
    const existingTarget = notes.find((n) => n.id === targetNoteId);
    if (!existingTarget) return false;

    // Deduplicate all sources (existing + new)
    const uniqueSourcesMap = new Map<string, DiscoverSourceItem>();
    for (const item of allResolvedSourceItems) {
      if (item.id !== targetNoteId && !uniqueSourcesMap.has(item.id)) {
        uniqueSourcesMap.set(item.id, item);
      }
    }
    for (const item of newSourceItems) {
      if (item.id !== targetNoteId && !uniqueSourcesMap.has(item.id)) {
        uniqueSourcesMap.set(item.id, item);
      }
    }
    const mergedSources = Array.from(uniqueSourcesMap.values());

    const mergedNoteIds = Array.from(
      new Set([
        ...(existingTarget.relatedNoteIds || []),
        ...mergedSources.filter((item) => item.kind === 'note').map((item) => item.id),
      ])
    ).filter((id) => id !== targetNoteId);

    const newNoteIdsToLink = Array.from(
      new Set(newSourceItems.filter((item) => item.kind === 'note').map((item) => item.id))
    ).filter((id) => id !== targetNoteId);

    const newFragmentItems = newSourceItems.filter((item) => item.kind === 'fragment');
    const totalFragmentCount = mergedSources.filter((item) => item.kind === 'fragment').length;

    const cleanedBodyHtml = stripSynthesisSourcesFooter(htmlContent) || htmlContent;
    const sourceListHtml = mergedSources
      .map(
        (item) =>
          `<li>[${item.kind === 'fragment' ? 'Fragment' : 'Catatan'}] ${item.title || 'Tanpa Judul'}</li>`
      )
      .join('');

    const finalHtml =
      mergedSources.length > 0
        ? `${cleanedBodyHtml}<hr><p><strong>Sumber Pengetahuan (${mergedSources.length}):</strong></p><ul>${sourceListHtml}</ul>`
        : cleanedBodyHtml;

    const plainText = cleanTextForEmbedding(finalHtml);
    const excerpt = plainText.slice(0, 180);
    const now = new Date().toISOString();

    const cleanTags = Array.from(
      new Set([
        'synthesis',
        ...tags.map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean),
      ])
    );

    const sourceLabel = `Disintesis dari ${mergedNoteIds.length} catatan${
      totalFragmentCount > 0 ? ` & ${totalFragmentCount} fragments` : ''
    }`;

    const updatedSynthNote: Note = {
      ...existingTarget,
      title: title.trim() || existingTarget.title || 'Dokumen Sintesis',
      content: finalHtml,
      excerpt,
      type: 'synthesis',
      tags: cleanTags,
      source: sourceLabel,
      relatedNoteIds: mergedNoteIds,
      updatedAt: now,
    };

    const uid = authUserRef.current?.id;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === targetNoteId) {
          return updatedSynthNote;
        }
        if (newNoteIdsToLink.includes(n.id) && !n.relatedNoteIds.includes(targetNoteId)) {
          const linked: Note = {
            ...n,
            relatedNoteIds: [...n.relatedNoteIds, targetNoteId],
            updatedAt: now,
          };
          if (canRemoteSync() && uid) {
            enqueueUpsertNote(uid, linked.id, now, false);
            if (isBrowserOnline()) {
              upsertNoteToSupabase(linked)
                .then((ok) => {
                  if (ok && authUserRef.current?.id === uid) {
                    dequeueUpsertNote(uid, linked.id, now);
                  }
                })
                .catch(console.warn);
            }
          }
          return linked;
        }
        return n;
      })
    );

    // Record newly added fragment links in approvedConnections / discover_connections
    if (newFragmentItems.length > 0) {
      const synthItem = noteToDiscoverItem(updatedSynthNote);
      const addedPairKeys: string[] = [];
      for (const fragItem of newFragmentItems) {
        const { pairKey, first, second } = buildCanonicalPair(synthItem, fragItem);
        addedPairKeys.push(pairKey);
        if (canRemoteSync() && uid) {
          enqueueUpsertConnection(uid, pairKey, now);
          if (isBrowserOnline()) {
            upsertDiscoverConnectionToSupabase({
              pairKey,
              itemAId: first.id,
              itemAKind: first.kind,
              itemBId: second.id,
              itemBKind: second.kind,
              status: 'approved',
              analysis: connectionAnalyses[pairKey],
              updatedAt: now,
            })
              .then((ok) => {
                if (ok && authUserRef.current?.id === uid) {
                  dequeueUpsertConnection(uid, pairKey, now);
                }
              })
              .catch(console.warn);
          }
        }
      }
      if (addedPairKeys.length > 0) {
        setApprovedConnections((prev) => Array.from(new Set([...prev, ...addedPairKeys])));
      }
    }

    if (canRemoteSync() && uid) {
      enqueueUpsertNote(uid, updatedSynthNote.id, now, false);
      if (isBrowserOnline()) {
        syncNoteWithFallback(updatedSynthNote)
          .then((ok) => {
            if (ok && authUserRef.current?.id === uid) {
              dequeueUpsertNote(uid, updatedSynthNote.id, now);
            }
          })
          .catch(console.warn);
      } else {
        setSyncStatus('offline');
      }
    } else {
      markOfflineDirtyIfLoggedOut();
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
        selectTab,
        activeStreamFilter,
        setActiveStreamFilter,
        activeNotebookId,
        setActiveNotebookId,
        activeNoteId,
        setActiveNoteId,
        navigateBack,
        backTargetLabel,
        openNoteFromFragment,
        exitDeletedNote,
        exitDeletedFragment,
        registerOverlay,
        unregisterOverlay,
        discoverTab,
        setDiscoverTab,
        libraryViewPrefs,
        setLibraryViewPrefs,
        fragmentsViewPrefs,
        setFragmentsViewPrefs,
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
        authUser,
        authLoading,
        offlineBypass,
        enterOfflineMode,
        exitOfflineMode,
        safetyModalAction,
        closeSafetyModal,
        confirmSafetyAction,
        requestSignOut,
        requestWipeLocalExit,
        requestResetWorkspace,
        signIn,
        signUp,
        signOut,
        updatePassword,
        isSupabaseConnected,
        isCloudflareConnected,
        syncStatus,
        autoSyncNotice,
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
        synthesisTargetNoteId,
        startUpdateSynthesis,
        clearSynthesisTarget,
        saveSynthesizedNote,
        updateSynthesizedNote,
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
