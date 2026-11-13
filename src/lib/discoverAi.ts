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
  vectorMap?: VectorMapResult | null
): InternalUnifiedEntry[] => {
  const activeNotes = notes.filter((n) => !n.archived);
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
  const entries = buildUnifiedEntries(notes, fragments, vectorMap);
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

  const entries = buildUnifiedEntries(notes, fragments, vectorMap);
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

  for (const candidate of candidateNotes) {
    if (candidate.archived || candidate.id === targetNote.id) continue;
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
  const res = await fetch('/api/discover/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Gagal menyintesis dokumen.');
  }

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
  };
};

export const requestAnalyzeConnection = async (
  itemA: DiscoverSourceItem,
  itemB: DiscoverSourceItem
): Promise<ConnectionAnalysis> => {
  const res = await fetch('/api/discover/analyze-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemA, itemB }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Gagal menganalisis koneksi.');
  }

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
  };
};

export const requestSummarizeCluster = async (
  items: DiscoverSourceItem[]
): Promise<TopicClusterSummary> => {
  const res = await fetch('/api/discover/summarize-cluster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Gagal merangkum tema cluster.');
  }

  return {
    ...json.result,
    modelUsed: json.modelUsed,
    fallbackUsed: json.fallbackUsed,
  };
};
