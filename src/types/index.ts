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

export type ManualNoteType = 'reference' | 'thought' | 'idea';
export type NoteType = ManualNoteType | 'synthesis';

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

// ============================================================================
// DISCOVER & SYNTHESIS TYPES
// ============================================================================

export type DiscoverItemKind = 'note' | 'fragment';

export interface DiscoverSourceItem {
  id: string;
  kind: DiscoverItemKind;
  title: string;
  type: NoteType | FragmentType;
  content: string;
  excerpt: string;
  tags: string[];
  source?: string;
  date: string;
  relatedNoteIds?: string[];
  similarity?: number;
}

export type SynthesisStyle = 'structured' | 'essay' | 'brief';

export interface SynthesisResult {
  title: string;
  summary: string;
  htmlContent: string;
  suggestedTags: string[];
  synthesisNotes: string;
  modelUsed?: string;
  fallbackUsed?: boolean;
}

export type ConnectionRelationshipType =
  | 'complementary'
  | 'expanding'
  | 'contrasting'
  | 'foundational';

export interface ConnectionAnalysis {
  relationshipType: ConnectionRelationshipType;
  similaritySummary: string;
  connectionInsight: string;
  synthesisPotential: string;
  modelUsed?: string;
  fallbackUsed?: boolean;
}

export interface ConnectionCandidate {
  pairKey: string;
  itemA: DiscoverSourceItem;
  itemB: DiscoverSourceItem;
  score: number;
  basis: 'vector' | 'semantic-keyword';
}

export interface TopicClusterCandidate {
  id: string;
  anchorTitle: string;
  items: DiscoverSourceItem[];
  avgScore: number;
  basis: 'vector' | 'semantic-keyword';
}

export interface TopicClusterSummary {
  themeTitle: string;
  themeDescription: string;
  keyAngles: string[];
  modelUsed?: string;
  fallbackUsed?: boolean;
}

export type DiscoverConnectionStatus = 'pending' | 'approved' | 'dismissed';

export interface DiscoverConnectionRecord {
  pairKey: string;
  itemAId: string;
  itemAKind: DiscoverItemKind;
  itemBId: string;
  itemBKind: DiscoverItemKind;
  status: DiscoverConnectionStatus;
  analysis?: ConnectionAnalysis;
  updatedAt: string;
}
