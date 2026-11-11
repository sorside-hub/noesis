import { Note, Notebook, Relic, Fragment, Project } from '../types';

export const INITIAL_NOTEBOOKS: Notebook[] = [
  { id: 'personal', name: 'Personal', count: 0, description: 'Personal reflections and thoughts' },
  { id: 'reading', name: 'Reading', count: 0, description: 'Book notes and references' },
  { id: 'ideas', name: 'Ideas', count: 0, description: 'Concepts and explorations' },
];

// Clean empty notes and fragments as requested
export const INITIAL_NOTES: Note[] = [];

export const INITIAL_FRAGMENTS: Fragment[] = [];

export const INITIAL_RELICS: Fragment[] = [];

export const INITIAL_PROJECTS: Project[] = [];
