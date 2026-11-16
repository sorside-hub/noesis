import {
  Note,
  Fragment,
  DiscoverSourceItem,
  SynthesisStyle,
  SynthesisResult,
  ConnectionAnalysis,
  ConnectionCandidate,
  TopicClusterCandidate,
  TopicClusterSummary,
  TagSuggestionResult,
  WritingAssistMode,
  WritingAssistAction,
  WritingAssistResult,
  ProjectOutlineResult,
} from '../types';
import { cleanTextForEmbedding } from './cloudflareEmbedding';
import { VectorMapResult } from './supabase';

export const makePairKey = (idA: string, idB: string): string => {
  return idA < idB ? `${idA}::${idB}` : `${idB}::${idA}`;
};

export const noteToDiscoverItem = (note: Note, similarity?: number): DiscoverSourceItem => ({
  id: note.id,
  kind: 'note',
  title: note.title || 'Untitled Note',
  type: note.type || 'thought',
  content: note.content || '',
  excerpt: note.excerpt || cleanTextForEmbedding(note.content).slice(0, 180),
  tags: note.tags || [],
  source: note.source,
  date: note.updatedAt || note.createdAt,
  relatedNoteIds: note.relatedNoteIds || [],
  similarity,
});

export const fragmentToDiscoverItem = (frag: Fragment, similarity?: number): DiscoverSourceItem => ({
  id: frag.id,
  kind: 'fragment',
  title: frag.title || 'Untitled Fragment',
  type: frag.type || 'thought',
  content: frag.content || '',
  excerpt: cleanTextForEmbedding(frag.content).slice(0, 180),
  tags: frag.tags || [],
  source: frag.source,
  date: frag.date || '',
  similarity,
});

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

const extractKeywords = (item: DiscoverSourceItem): Set<string> => {
  const stopWords = new Set([
    'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'adalah', 'ini', 'itu',
    'atau', 'juga', 'dalam', 'akan', 'bisa', 'tidak', 'ada', 'karena', 'seperti', 'kita',
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'have', 'not',
  ]);
  const text = `${item.title} ${cleanTextForEmbedding(item.content)} ${(item.tags || []).join(' ')}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');

  const words = new Set<string>();
  for (const w of text.split(/\s+/)) {
    if (w.length >= 3 && !stopWords.has(w)) {
      words.add(w);
    }
  }
  return words;
};

const computeKeywordSimilarity = (a: DiscoverSourceItem, b: DiscoverSourceItem): number => {
  const setA = extractKeywords(a);
  const setB = extractKeywords(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((w) => {
    if (setB.has(w)) intersection++;
  });

  // Boost slightly for shared tags
  const tagOverlap = (a.tags || []).filter((t) => (b.tags || []).includes(t)).length;
  const union = setA.size + setB.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;
  return Math.min(0.95, jaccard + tagOverlap * 0.12);
};

interface InternalUnifiedEntry {
  item: DiscoverSourceItem;
  vector?: number[];
}

const buildUnifiedEntries = (
  notes: Note[],
  fragments: Fragment[],
  vectorMap?: VectorMapResult | null,
  options?: { excludeSynthesisNotes?: boolean }
): InternalUnifiedEntry[] => {
  const activeNotes = notes.filter(
    (n) =>
      !n.archived &&
      !n.excludeFromEmbed &&
      !(options?.excludeSynthesisNotes && n.type === 'synthesis')
  );
  const entries: InternalUnifiedEntry[] = [];

  for (const n of activeNotes) {
    entries.push({
      item: noteToDiscoverItem(n),
      vector: vectorMap?.noteVectors.get(n.id),
    });
  }

  for (const f of fragments) {
    entries.push({
      item: fragmentToDiscoverItem(f),
      vector: vectorMap?.fragmentVectors.get(f.id),
    });
  }

  return entries;
};

/**
 * Computes potential unlinked connection pairs across Notes & Fragments.
 * Excludes pairs already linked via relatedNoteIds, approvedPairKeys, or dismissedPairKeys.
 */
export const computeConnectionCandidates = (
  notes: Note[],
  fragments: Fragment[],
  vectorMap: VectorMapResult | null,
  dismissedPairKeys: Set<string>,
  approvedPairKeys: Set<string>,
  options: { minVectorThreshold?: number; limit?: number } = {}
): ConnectionCandidate[] => {
  const minVectorThreshold = options.minVectorThreshold ?? 0.48;
  const limit = options.limit ?? 12;
  const entries = buildUnifiedEntries(notes, fragments, vectorMap, {
    excludeSynthesisNotes: true,
  });
  const candidates: ConnectionCandidate[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const pairKey = makePairKey(a.item.id, b.item.id);

      if (dismissedPairKeys.has(pairKey) || approvedPairKeys.has(pairKey)) {
        continue;
      }

      // Skip notes that are already explicitly linked
      if (
        a.item.kind === 'note' &&
        b.item.kind === 'note' &&
        (a.item.relatedNoteIds?.includes(b.item.id) || b.item.relatedNoteIds?.includes(a.item.id))
      ) {
        continue;
      }

      if (a.vector && b.vector) {
        const score = cosineSimilarity(a.vector, b.vector);
        if (score >= minVectorThreshold) {
          candidates.push({
            pairKey,
            itemA: a.item,
            itemB: b.item,
            score,
            basis: 'vector',
          });
        }
      } else {
        // Graceful offline/unembedded fallback using keyword + tag overlap
        const score = computeKeywordSimilarity(a.item, b.item);
        if (score >= 0.18) {
          candidates.push({
            pairKey,
            itemA: a.item,
            itemB: b.item,
            score,
            basis: 'semantic-keyword',
          });
        }
      }
    }
  }

  candidates.sort((x, y) => y.score - x.score);
  return candidates.slice(0, limit);
};

/**
 * Groups closely related Notes & Fragments into tentative Topic Clusters for exploration.
 * Only groups with >= 3 items are returned so users can inspect before deciding to synthesize.
 */
export const computeTopicClusters = (
  notes: Note[],
  fragments: Fragment[],
  vectorMap: VectorMapResult | null,
  options: { minVectorThreshold?: number; minClusterSize?: number; maxClusters?: number } = {}
): TopicClusterCandidate[] => {
  const minVectorThreshold = options.minVectorThreshold ?? 0.50;
  const minClusterSize = options.minClusterSize ?? 3;
  const maxClusters = options.maxClusters ?? 6;

  const entries = buildUnifiedEntries(notes, fragments, vectorMap, {
    excludeSynthesisNotes: true,
  });
  if (entries.length < minClusterSize) return [];

  // Build adjacency list of similar items
  const adjacency = new Map<number, { idx: number; score: number }[]>();
  for (let i = 0; i < entries.length; i++) adjacency.set(i, []);

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      let score = 0;
      let passed = false;

      if (a.vector && b.vector) {
        score = cosineSimilarity(a.vector, b.vector);
        passed = score >= minVectorThreshold;
      } else {
        score = computeKeywordSimilarity(a.item, b.item);
        passed = score >= 0.22;
      }

      if (passed) {
        adjacency.get(i)!.push({ idx: j, score });
        adjacency.get(j)!.push({ idx: i, score });
      }
    }
  }

  // Greedy cohesive clustering: start from nodes with most strong connections
  const indicesByDegree = Array.from({ length: entries.length }, (_, i) => i).sort(
    (a, b) => (adjacency.get(b)?.length || 0) - (adjacency.get(a)?.length || 0)
  );

  const visited = new Set<number>();
  const clusters: TopicClusterCandidate[] = [];

  for (const seedIdx of indicesByDegree) {
    if (visited.has(seedIdx)) continue;
    const neighbors = adjacency.get(seedIdx) || [];
    const availableNeighbors = neighbors
      .filter((n) => !visited.has(n.idx))
      .sort((a, b) => b.score - a.score);

    if (availableNeighbors.length + 1 < minClusterSize) continue;

    const clusterIndices = [seedIdx, ...availableNeighbors.slice(0, 9).map((n) => n.idx)];
    clusterIndices.forEach((idx) => visited.add(idx));

    const items = clusterIndices.map((idx) => entries[idx].item);
    const avgScore =
      availableNeighbors.slice(0, 9).reduce((sum, n) => sum + n.score, 0) /
      Math.max(1, Math.min(9, availableNeighbors.length));

    const hasVectors = clusterIndices.every((idx) => Boolean(entries[idx].vector));

    clusters.push({
      id: `cluster-${entries[seedIdx].item.id}`,
      anchorTitle: entries[seedIdx].item.title,
      items,
      avgScore,
      basis: hasVectors ? 'vector' : 'semantic-keyword',
    });

    if (clusters.length >= maxClusters) break;
  }

  return clusters;
};

export interface ClusterSynthesisMatch {
  note: Note;
  overlapCount: number;
  totalClusterItems: number;
  coveredItemIds: Set<string>;
  isFullMatch: boolean;
}

export interface ClusterSynthesisCoverage {
  coveredBySynthesis: ClusterSynthesisMatch | null;
  isFullySynthesized: boolean;
  newItemsCount: number;
}

/**
 * Resolves all source Note & Fragment IDs incorporated into a Synthesis note
 * using relatedNoteIds, approvedConnections (for fragments), and legacy HTML footer fallback.
 */
export const resolveSynthesisSourceIds = (
  synthesisNote: Note,
  notes: Note[],
  fragments: Fragment[],
  approvedConnections: string[]
): Set<string> => {
  const coveredIds = new Set<string>();

  for (const relId of synthesisNote.relatedNoteIds || []) {
    if (relId && relId !== synthesisNote.id) {
      coveredIds.add(relId);
    }
  }

  for (const pairKey of approvedConnections) {
    const parts = pairKey.split('::');
    if (parts.length !== 2) continue;
    const otherId =
      parts[0] === synthesisNote.id
        ? parts[1]
        : parts[1] === synthesisNote.id
        ? parts[0]
        : null;
    if (otherId) {
      coveredIds.add(otherId);
    }
  }

  const legacyEntries = parseLegacySynthesisFooterItems(synthesisNote.content || '');
  if (legacyEntries.length > 0) {
    for (const entry of legacyEntries) {
      const targetTitle = entry.title.toLowerCase();
      if (entry.kind === 'fragment') {
        const frag = fragments.find(
          (f) => !coveredIds.has(f.id) && (f.title || 'Tanpa Judul').trim().toLowerCase() === targetTitle
        );
        if (frag) coveredIds.add(frag.id);
      } else {
        const note = notes.find(
          (n) =>
            n.id !== synthesisNote.id &&
            !coveredIds.has(n.id) &&
            (n.title || 'Tanpa Judul').trim().toLowerCase() === targetTitle
        );
        if (note) coveredIds.add(note.id);
      }
    }
  }

  return coveredIds;
};

export const resolveSynthesisSourceIdsMap = (
  synthesisNotes: Note[],
  notes: Note[],
  fragments: Fragment[],
  approvedConnections: string[]
): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  for (const sNote of synthesisNotes) {
    if (sNote.archived || sNote.type !== 'synthesis') continue;
    map.set(sNote.id, resolveSynthesisSourceIds(sNote, notes, fragments, approvedConnections));
  }
  return map;
};

/**
 * Evaluates whether a TopicClusterCandidate is already fully or partially covered
 * by an existing non-archived Synthesis document.
 */
export const evaluateClusterSynthesisCoverage = (
  cluster: TopicClusterCandidate,
  synthesisNotes: Note[],
  sourceIdsBySynthesisId: Map<string, Set<string>>
): ClusterSynthesisCoverage => {
  let bestMatch: ClusterSynthesisMatch | null = null;
  const totalClusterItems = cluster.items.length;

  for (const sNote of synthesisNotes) {
    if (sNote.archived || sNote.type !== 'synthesis') continue;
    const coveredSet = sourceIdsBySynthesisId.get(sNote.id);
    if (!coveredSet || coveredSet.size === 0) continue;

    const matchedIds = new Set<string>();
    for (const item of cluster.items) {
      if (coveredSet.has(item.id)) {
        matchedIds.add(item.id);
      }
    }

    const overlapCount = matchedIds.size;
    const isFullMatch = totalClusterItems > 0 && overlapCount === totalClusterItems;

    // Only treat as meaningful match if 100% covered OR at least 2 items overlap
    if (!isFullMatch && overlapCount < 2) continue;

    if (
      !bestMatch ||
      (isFullMatch && !bestMatch.isFullMatch) ||
      (isFullMatch === bestMatch.isFullMatch && overlapCount > bestMatch.overlapCount) ||
      (isFullMatch === bestMatch.isFullMatch &&
        overlapCount === bestMatch.overlapCount &&
        new Date(sNote.updatedAt).getTime() > new Date(bestMatch.note.updatedAt).getTime())
    ) {
      bestMatch = {
        note: sNote,
        overlapCount,
        totalClusterItems,
        coveredItemIds: matchedIds,
        isFullMatch,
      };
    }
  }

  return {
    coveredBySynthesis: bestMatch,
    isFullySynthesized: Boolean(bestMatch?.isFullMatch),
    newItemsCount: bestMatch ? totalClusterItems - bestMatch.overlapCount : totalClusterItems,
  };
};

export interface RelatedNoteSuggestion {
  note: Note;
  reason: 'vector' | 'tag-concept';
}

/**
 * Suggests up to `limit` unlinked notes related to `targetNote` for optional user linking.
 * Uses stored BGE-M3 vectors when available, with keyword + tag similarity fallback.
 */
export const computeRelatedNoteSuggestions = (
  targetNote: Note,
  candidateNotes: Note[],
  vectorMap: VectorMapResult | null,
  limit = 4
): RelatedNoteSuggestion[] => {
  const targetItem = noteToDiscoverItem(targetNote);
  const targetVec = vectorMap?.noteVectors.get(targetNote.id);
  const scored: { note: Note; score: number; reason: 'vector' | 'tag-concept' }[] = [];

  if (targetNote.excludeFromEmbed) return [];
  for (const candidate of candidateNotes) {
    if (candidate.archived || candidate.excludeFromEmbed || candidate.id === targetNote.id) continue;
    const candidateVec = vectorMap?.noteVectors.get(candidate.id);

    if (targetVec && candidateVec) {
      const score = cosineSimilarity(targetVec, candidateVec);
      if (score >= 0.35) {
        scored.push({ note: candidate, score, reason: 'vector' });
      }
    } else {
      const candidateItem = noteToDiscoverItem(candidate);
      const score = computeKeywordSimilarity(targetItem, candidateItem);
      if (score >= 0.12) {
        scored.push({ note: candidate, score, reason: 'tag-concept' });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ note, reason }) => ({ note, reason }));
};

export interface SynthesisUpdateSuggestion {
  item: DiscoverSourceItem;
  basis: 'vector' | 'semantic-keyword';
  score: number;
}

/**
 * Recommends un-included Notes & Fragments relevant to an existing Synthesis document
 * for the 1 + N -> 1 Update Synthesis workflow (excludes other synthesis docs and already-included items).
 */
export const computeSynthesisUpdateSuggestions = (
  baseSynthesisNote: Note,
  notes: Note[],
  fragments: Fragment[],
  alreadyIncludedIds: Set<string>,
  vectorMap: VectorMapResult | null,
  limit = 6
): SynthesisUpdateSuggestion[] => {
  const baseItem = noteToDiscoverItem(baseSynthesisNote);
  const baseVec = vectorMap?.noteVectors.get(baseSynthesisNote.id);
  const scored: SynthesisUpdateSuggestion[] = [];

  for (const n of notes) {
    if (
      n.archived ||
      n.type === 'synthesis' ||
      n.id === baseSynthesisNote.id ||
      alreadyIncludedIds.has(n.id)
    ) {
      continue;
    }

    const item = noteToDiscoverItem(n);
    const candidateVec = vectorMap?.noteVectors.get(n.id);

    if (baseVec && candidateVec) {
      const score = cosineSimilarity(baseVec, candidateVec);
      if (score >= 0.42) {
        scored.push({ item, basis: 'vector', score });
      }
    } else {
      const score = computeKeywordSimilarity(baseItem, item);
      if (score >= 0.14) {
        scored.push({ item, basis: 'semantic-keyword', score });
      }
    }
  }

  for (const f of fragments) {
    if (alreadyIncludedIds.has(f.id)) continue;

    const item = fragmentToDiscoverItem(f);
    const candidateVec = vectorMap?.fragmentVectors.get(f.id);

    if (baseVec && candidateVec) {
      const score = cosineSimilarity(baseVec, candidateVec);
      if (score >= 0.42) {
        scored.push({ item, basis: 'vector', score });
      }
    } else {
      const score = computeKeywordSimilarity(baseItem, item);
      if (score >= 0.14) {
        scored.push({ item, basis: 'semantic-keyword', score });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
};

// ============================================================================
// SERVER-SIDE GEMINI API CLIENT HELPERS
// ============================================================================

export const stripSynthesisSourcesFooter = (html: string): string => {
  if (!html) return '';
  return html
    .replace(
      /(?:<hr\s*\/?>\s*)?<p>\s*<strong>\s*Sumber Pengetahuan\s*\(\d+\):\s*<\/strong>\s*<\/p>\s*<ul>[\s\S]*?<\/ul>\s*$/i,
      ''
    )
    .trim();
};

export const parseLegacySynthesisFooterItems = (
  html: string
): { kind: 'note' | 'fragment'; title: string }[] => {
  if (!html) return [];
  const footerMatch = html.match(
    /<p>\s*<strong>\s*Sumber Pengetahuan\s*\(\d+\):\s*<\/strong>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>\s*$/i
  );
  if (!footerMatch) return [];
  const items: { kind: 'note' | 'fragment'; title: string }[] = [];
  const liRegex = /<li>\s*\[(Fragment|Catatan)\]\s*([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = liRegex.exec(footerMatch[1])) !== null) {
    const kind = match[1].toLowerCase() === 'fragment' ? 'fragment' : 'note';
    const title = match[2].replace(/<[^>]*>/g, '').trim();
    if (title) items.push({ kind, title });
  }
  return items;
};

export const requestSynthesizeDocument = async (payload: {
  topic?: string;
  style: SynthesisStyle;
  items: DiscoverSourceItem[];
  existingSynthesis?: {
    id: string;
    title: string;
    htmlContent: string;
    tags?: string[];
  };
}): Promise<SynthesisResult> => {
  const json = await postAiJson<any>(
    '/api/discover/synthesize',
    payload,
    'Gagal menyintesis dokumen.'
  );

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
    aiTrace: json.aiTrace,
  };
};

async function postAiJson<T = any>(
  url: string,
  body: unknown,
  fallbackError: string
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let json: any = null;
  if (rawText) {
    try {
      json = JSON.parse(rawText);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const serverMsg = json?.error || (rawText && rawText.length < 180 ? rawText.trim() : '');
    throw new Error(serverMsg || `${fallbackError} (HTTP ${res.status})`);
  }

  if (!json) {
    throw new Error(`${fallbackError} (Respons server bukan JSON valid).`);
  }

  if (!json.success) {
    throw new Error(json.error || fallbackError);
  }

  return json as T;
}

export const requestAnalyzeConnection = async (
  itemA: DiscoverSourceItem,
  itemB: DiscoverSourceItem
): Promise<ConnectionAnalysis> => {
  const json = await postAiJson<any>(
    '/api/discover/analyze-connection',
    { itemA, itemB },
    'Gagal menganalisis koneksi.'
  );

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
    aiTrace: json.aiTrace,
  };
};

export const requestSummarizeCluster = async (
  items: DiscoverSourceItem[]
): Promise<TopicClusterSummary> => {
  const json = await postAiJson<any>(
    '/api/discover/summarize-cluster',
    { items },
    'Gagal merangkum tema cluster.'
  );

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
    aiTrace: json.aiTrace,
  };
};

export const MAX_AI_TAGS_PER_ITEM = 5;

export const collectWorkspaceTags = (
  notes: Note[],
  fragments: Fragment[],
  limit = 100
): string[] => {
  const counts = new Map<string, number>();

  const addTag = (raw: string) => {
    const clean = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^#+/, '');
    if (!clean) return;
    counts.set(clean, (counts.get(clean) || 0) + 1);
  };

  for (const n of notes) {
    if (n.archived) continue;
    for (const tag of n.tags || []) addTag(tag);
  }
  for (const f of fragments) {
    for (const tag of f.tags || []) addTag(tag);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
};

export const requestSuggestTags = async (payload: {
  kind: 'note' | 'fragment';
  title: string;
  content: string;
  source?: string;
  itemType?: string;
  currentTags: string[];
  existingTags: string[];
  maxSuggestions?: number;
  maxTotalTags?: number;
}): Promise<TagSuggestionResult> => {
  const json = await postAiJson<any>(
    '/api/ai/suggest-tags',
    payload,
    'Gagal membuat saran tag AI.'
  );

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
    aiTrace: json.aiTrace,
  };
};

export const requestWritingAssist = async (payload: {
  contextKind: 'note' | 'project';
  mode: WritingAssistMode;
  action: WritingAssistAction;
  customPrompt?: string;
  selectedText?: string;
  title?: string;
  surroundingBefore?: string;
  surroundingAfter?: string;
  documentExcerpt?: string;
  projectTitle?: string;
  sectionTitle?: string;
  previousSectionSnippet?: string;
  noteType?: string;
}): Promise<WritingAssistResult> => {
  const json = await postAiJson<any>(
    '/api/ai/writing-assist',
    payload,
    'Gagal memproses pendamping AI.'
  );

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
    aiTrace: json.aiTrace,
  };
};

export const requestProjectOutline = async (payload: {
  projectTitle: string;
  projectDescription?: string;
  existingSections?: { title: string; hasContent: boolean }[];
  materials?: {
    kind: 'note' | 'fragment';
    title: string;
    type: string;
    excerpt: string;
    content: string;
    tags: string[];
  }[];
  userGuidance?: string;
}): Promise<ProjectOutlineResult> => {
  const json = await postAiJson<any>(
    '/api/ai/project-outline',
    payload,
    'Gagal menyusun kerangka project.'
  );

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
    aiTrace: json.aiTrace,
  };
};


