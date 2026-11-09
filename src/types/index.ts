export type ViewMode =
  | 'home'
  | 'capture'
  | 'library'
  | 'editor'
  | 'discover'
  | 'projects'
  | 'settings';

export type ThemePreference = 'light' | 'dark' | 'system';

export type RelicType = 'object' | 'memory' | 'quote' | 'lesson' | 'idea';

export type NoteType = 'reference' | 'thought' | 'idea';

export interface Note {
  id: string;
  title: string;
  content: string; // HTML formatted for Tiptap
  excerpt: string;
  type: NoteType;
  notebookId: string;
  tags: string[];
  source?: string;
  favorite: boolean;
  archived: boolean;
  relatedNoteIds: string[];
  createdAt: string;
  updatedAt: string;
  wordCount: number;
}


export interface Notebook {
  id: string;
  name: string;
  count: number;
  description?: string;
}

export interface Relic {
  id: string;
  type: RelicType;
  title: string;
  content: string;
  tags: string[];
  date: string;
  source?: string;
  starred?: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: 'drafting' | 'review' | 'in_progress' | 'completed';
  progress: number;
  targetWordCount: number;
  currentWordCount: number;
  deadline: string;
  noteIds: string[];
  milestones: Milestone[];
}
