import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ViewMode, ThemePreference, Note, Notebook, Relic, Project, RelicType, NoteType } from '../types';
import { INITIAL_NOTES, INITIAL_NOTEBOOKS, INITIAL_RELICS, INITIAL_PROJECTS } from '../data/mockData';

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

  // Relics (Quick Captures)
  relics: Relic[];
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

  const [relics, setRelics] = useState<Relic[]>(() => {
    const saved = localStorage.getItem('noesis_relics');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_RELICS;
      }
    }
    return INITIAL_RELICS;
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

  // Save changes locally
  useEffect(() => {
    localStorage.setItem('noesis_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('noesis_notebooks', JSON.stringify(notebooks));
  }, [notebooks]);

  useEffect(() => {
    localStorage.setItem('noesis_relics', JSON.stringify(relics));
  }, [relics]);

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

  const createRelic = (data: { type: RelicType; title: string; content: string; tags: string[]; source?: string }) => {
    const newRelic: Relic = {
      id: `relic-${Date.now()}`,
      type: data.type,
      title: data.title,
      content: data.content,
      tags: data.tags,
      source: data.source,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      starred: false,
    };
    setRelics((prev) => [newRelic, ...prev]);
  };

  const deleteRelic = (id: string) => {
    setRelics((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleStarRelic = (id: string) => {
    setRelics((prev) =>
      prev.map((r) => (r.id === id ? { ...r, starred: !r.starred } : r))
    );
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
        relics,
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
