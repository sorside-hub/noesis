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
  excludeFromEmbed?: boolean;
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

export type ProjectStatus = 'active' | 'review' | 'completed' | 'archived';

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface ProjectSection {
  id: string;
  title: string;
  content: string; // HTML from Tiptap
  status: 'draft' | 'done';
  order: number;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  enableWordGoal?: boolean;
  targetWordCount: number;
  currentWordCount: number;
  deadline?: string;
  noteIds: string[];
  fragmentIds: string[];
  sections: ProjectSection[];
  milestones: Milestone[];
  createdAt?: string;
  updatedAt: string;
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

export interface AiProcessStep {
  step: number;
  label: string;
  model?: string;
  role?: 'primary' | 'fallback' | 'wait';
  status: 'success' | 'failed' | 'waiting';
  detail?: string;
  durationMs?: number;
}

export interface AiExecutionTrace {
  primaryModel: string;
  fallbackModel: string;
  modelUsed: string;
  fallbackUsed: boolean;
  retriedPrimary: boolean;
  totalDurationMs: number;
  steps: AiProcessStep[];
}

export interface SynthesisResult {
  title: string;
  summary: string;
  htmlContent: string;
  suggestedTags: string[];
  synthesisNotes: string;
  modelUsed?: string;
  fallbackUsed?: boolean;
  aiTrace?: AiExecutionTrace;
}

export type ConnectionRelationshipType =
  | 'complementary'
  | 'expanding'
  | 'contrasting'
  | 'foundational'
  | 'loose';

export interface ConnectionAnalysis {
  relationshipType: ConnectionRelationshipType;
  similaritySummary: string;
  connectionInsight: string;
  synthesisPotential: string;
  modelUsed?: string;
  fallbackUsed?: boolean;
  aiTrace?: AiExecutionTrace;
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
  aiTrace?: AiExecutionTrace;
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
