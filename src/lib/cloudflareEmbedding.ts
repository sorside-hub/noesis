// Cloudflare Workers AI 'bge-m3' (1024-dimension) Embedding Service
import { Note, Fragment } from '../types';
import { isSupabaseConfigured, upsertNoteToSupabase, upsertFragmentToSupabase } from './supabase';

export const getCloudflareAccountId = (): string => {
  return (
    import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID ||
    import.meta.env.CLOUDFLARE_ACCOUNT_ID ||
    ''
  ).trim();
};

export const getCloudflareApiToken = (): string => {
  return (
    import.meta.env.VITE_CLOUDFLARE_API_TOKEN ||
    import.meta.env.CLOUDFLARE_API_TOKEN ||
    ''
  ).trim();
};

export const isCloudflareAiConfigured = (): boolean => {
  const accId = getCloudflareAccountId();
  const token = getCloudflareApiToken();
  return (
    accId.length > 0 &&
    !accId.includes('your-cloudflare-account-id') &&
    token.length > 0 &&
    !token.includes('your-cloudflare-api-token')
  );
};

/**
 * Strips HTML tags and normalizes whitespace for optimal semantic embedding
 */
export const cleanTextForEmbedding = (rawText: string): string => {
  if (!rawText) return '';
  return rawText
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Generates 1024-dimension dense vector embedding using Cloudflare Workers AI 'bge-m3'
 * Strategy 1: Uses /api/embed Pages Function with Cloudflare env.AI binding (Deployed on Cloudflare)
 * Strategy 2: Direct REST API using Account ID & API Token (Preview/Local)
 */
export const generateBgeM3Embedding = async (
  text: string
): Promise<number[] | null> => {
  const cleaned = cleanTextForEmbedding(text);
  if (!cleaned) return null;

  // Strategy 1: Try Cloudflare Pages Function at /api/embed (uses env.AI binding)
  try {
    const proxyRes = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleaned }),
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success && Array.isArray(json.vector) && json.vector.length === 1024) {
        return json.vector;
      }
    }
  } catch {
    // /api/embed not available or running in standalone client preview
  }

  // Strategy 2: Fallback to Cloudflare REST API with credentials
  if (!isCloudflareAiConfigured()) {
    console.info(
      'Cloudflare Workers AI credentials or Pages Function /api/embed not configured.'
    );
    return null;
  }

  try {
    const cfAccountId = getCloudflareAccountId();
    const cfApiToken = getCloudflareApiToken();
    const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/baai/bge-m3`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleaned,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Cloudflare Workers AI bge-m3 error:', response.status, errText);
      return null;
    }

    const json = await response.json();
    if (json.success && json.result?.data) {
      const data = json.result.data;
      if (Array.isArray(data[0])) {
        return data[0];
      }
      return data;
    }

    return null;
  } catch (err) {
    console.warn('Failed to call Cloudflare Workers AI bge-m3 REST API:', err);
    return null;
  }
};

/**
 * Unified semantic text builder for both Notes and Fragments:
 * Includes Title, Content, Tags, and Source (omits Type to keep semantic matching topic-focused).
 */
export const buildEmbeddingPayload = (item: {
  title?: string;
  content?: string;
  tags?: string[];
  source?: string;
}): string => {
  const parts: string[] = [];
  if (item.title?.trim()) {
    parts.push(item.title.trim());
  }
  const cleanedContent = cleanTextForEmbedding(item.content || '');
  if (cleanedContent) {
    parts.push(cleanedContent);
  }
  const cleanTags = (item.tags || []).map((t) => t.trim()).filter(Boolean);
  if (cleanTags.length > 0) {
    parts.push(`Tags: ${cleanTags.join(', ')}`);
  }
  if (item.source?.trim()) {
    parts.push(`Source: ${item.source.trim()}`);
  }
  return parts.join('\n\n');
};

/**
 * Embeds a note and persists the 1024-dimension vector to Supabase
 */
export const embedAndSyncNote = async (note: Note): Promise<boolean> => {
  const textToEmbed = buildEmbeddingPayload({
    title: note.title,
    content: note.content,
    tags: note.tags,
    source: note.source,
  });
  const vector = await generateBgeM3Embedding(textToEmbed);

  if (vector && vector.length === 1024 && isSupabaseConfigured()) {
    const embeddedAt = new Date().toISOString();
    const noteWithTimestamp = { ...note, embeddedAt };
    const ok = await upsertNoteToSupabase(noteWithTimestamp, vector);
    return ok;
  }

  return false;
};

/**
 * Embeds a fragment and persists the 1024-dimension vector to Supabase
 */
export const embedAndSyncFragment = async (frag: Fragment): Promise<boolean> => {
  const textToEmbed = buildEmbeddingPayload({
    title: frag.title,
    content: frag.content,
    tags: frag.tags,
    source: frag.source,
  });
  const vector = await generateBgeM3Embedding(textToEmbed);

  if (vector && vector.length === 1024 && isSupabaseConfigured()) {
    const embeddedAt = new Date().toISOString();
    const fragWithTimestamp = { ...frag, embeddedAt };
    const ok = await upsertFragmentToSupabase(fragWithTimestamp, vector);
    return ok;
  }

  return false;
};
