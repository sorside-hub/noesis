import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ViewMode, ThemePreference, Note, Notebook, Relic, Fragment, Project, RelicType, FragmentType, NoteType } from '../types';
import { INITIAL_NOTES, INITIAL_NOTEBOOKS, INITIAL_FRAGMENTS, INITIAL_RELICS, INITIAL_PROJECTS } from '../data/mockData';

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
  const [activeNoteId, setActiveNoteId] = useState<string>('note-1');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState<boolean>(false);
  const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);
  const [isFragmentDrawerOpen, setIsFragmentDrawerOpen] = useState<boolean>(false);

  // Entities state with localStorage caching and migration
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('noesis_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure every note has type and relatedNoteIds
        return parsed.map((n: any) => ({
          ...n,
          type: n.type || 'thought',
          relatedNoteIds: Array.isArray(n.relatedNoteIds) ? n.relatedNoteIds : [],
        }));
      } catch {
        return INITIAL_NOTES;
      }
    }
    return INITIAL_NOTES;
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
    const saved = localStorage.getItem('noesis_fragments') || localStorage.getItem('noesis_relics');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((f: any) => {
          let type: FragmentType = 'thought';
          if (f.type === 'thought' || f.type === 'reference' || f.type === 'idea') {
            type = f.type;
          } else if (f.type === 'quote' || f.type === 'object') {
            type = 'reference';
          }
          return {
            ...f,
            type,
          };
        });
      } catch {
        return INITIAL_FRAGMENTS;
      }
    }
    return INITIAL_FRAGMENTS;
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

  // Save changes locally
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

  useEffect(() => {
    localStorage.setItem('noesis_projects', JSON.stringify(projects));
  }, [projects]);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || notes[0];
  }, [notes, activeNoteId]);

  // Handlers
  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  const createNote = (notebookId?: string, type?: NoteType): string => {
    const targetNotebook = notebookId || activeNotebookId || 'personal';
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
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

    return newNote.id;
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n))
    );
  };

  const linkRelatedNote = (noteId: string, targetNoteId: string) => {
    if (noteId === targetNoteId) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === noteId && !n.relatedNoteIds.includes(targetNoteId)) {
          return { ...n, relatedNoteIds: [...n.relatedNoteIds, targetNoteId] };
        }
        if (n.id === targetNoteId && !n.relatedNoteIds.includes(noteId)) {
          return { ...n, relatedNoteIds: [...n.relatedNoteIds, noteId] };
        }
        return n;
      })
    );
  };

  const unlinkRelatedNote = (noteId: string, targetNoteId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === noteId) {
          return { ...n, relatedNoteIds: n.relatedNoteIds.filter((id) => id !== targetNoteId) };
        }
        if (n.id === targetNoteId) {
          return { ...n, relatedNoteIds: n.relatedNoteIds.filter((id) => id !== noteId) };
        }
        return n;
      })
    );
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
  };

  const toggleFavoriteNote = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, favorite: !n.favorite } : n))
    );
  };

  const toggleArchiveNote = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, archived: !n.archived } : n))
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
    return id;
  };

  const updateFragment = (id: string, updates: Partial<Fragment>) => {
    setFragments((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const deleteFragment = (id: string) => {
    setFragments((prev) => prev.filter((f) => f.id !== id));
    if (activeFragmentId === id) {
      closeFragmentDrawer();
    }
  };

  const toggleStarFragment = (id: string) => {
    setFragments((prev) =>
      prev.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f))
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
