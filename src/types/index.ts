export type ViewMode =
  | 'home'
  | 'fragments'
  | 'capture'
  | 'library'
  | 'editor'
  | 'discover'
  | 'projects'
  | 'settings';

export type ThemePreference = 'light' | 'dark' | 'system';

export type FragmentType = 'thought' | 'reference' | 'idea';
export type RelicType = FragmentType;

export type NoteType = 'reference' | 'thought' | 'idea';

export type StreamFilter = 'all' | 'favorites' | 'archived';

export interface Note {
  id: string;
  title: string;
  content: string; // HTML formatted for Tiptap
  excerpt: string;
  type: NoteType;
  tags: string[];
  source?: string;
  favorite: boolean;
  archived: boolean;
  relatedNoteIds: string[];
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  embeddedAt?: string;
}

export interface Fragment {
  id: string;
  type: FragmentType;
  title: string;
  content: string;
  tags: string[];
  date: string;
  source?: string;
  starred?: boolean;
  embeddedAt?: string;
  updatedAt?: string;
}

export type Relic = Fragment;

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
