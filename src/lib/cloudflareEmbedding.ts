// Cloudflare Workers AI 'bge-m3' (1024-dimension) Embedding Service
import { Note, Fragment } from '../types';
import { isSupabaseConfigured, upsertNoteToSupabase, upsertFragmentToSupabase } from './supabase';

export const getCloudflareAccountId = (): string => {
  return (
    import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID ||
    import.meta.env.CLOUDFLARE_ACCOUNT_ID ||
    localStorage.getItem('noesis_cf_account_id') ||
    ''
  ).trim();
};

export const getCloudflareApiToken = (): string => {
  return (
    import.meta.env.VITE_CLOUDFLARE_API_TOKEN ||
    import.meta.env.CLOUDFLARE_API_TOKEN ||
    localStorage.getItem('noesis_cf_api_token') ||
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
 */
export const generateBgeM3Embedding = async (
  text: string
): Promise<number[] | null> => {
  const cleaned = cleanTextForEmbedding(text);
  if (!cleaned) return null;

  if (!isCloudflareAiConfigured()) {
    console.info(
      'Cloudflare Workers AI (bge-m3) credentials not yet configured. Set VITE_CLOUDFLARE_ACCOUNT_ID and VITE_CLOUDFLARE_API_TOKEN.'
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
      // Result data might be [ [0.1, 0.2, ...] ] or [0.1, 0.2, ...]
      const data = json.result.data;
      if (Array.isArray(data[0])) {
        return data[0];
      }
      return data;
    }

    return null;
  } catch (err) {
    console.warn('Failed to call Cloudflare Workers AI bge-m3:', err);
    return null;
  }
};

/**
 * Embeds a note and persists the 1024-dimension vector to Supabase
 */
export const embedAndSyncNote = async (note: Note): Promise<boolean> => {
  const textToEmbed = `${note.title}\n\n${cleanTextForEmbedding(note.content)}\n\nTags: ${(note.tags || []).join(', ')}`;
  const vector = await generateBgeM3Embedding(textToEmbed);

  if (vector && vector.length === 1024 && isSupabaseConfigured()) {
    return await upsertNoteToSupabase(note, vector);
  }

  // If no Cloudflare AI credentials, still upsert without vector
  if (isSupabaseConfigured()) {
    return await upsertNoteToSupabase(note);
  }

  return false;
};

/**
 * Embeds a fragment and persists the 1024-dimension vector to Supabase
 */
export const embedAndSyncFragment = async (frag: Fragment): Promise<boolean> => {
  const textToEmbed = `${frag.title}\n\n${cleanTextForEmbedding(frag.content)}\n\nCategory: ${frag.type}`;
  const vector = await generateBgeM3Embedding(textToEmbed);

  if (vector && vector.length === 1024 && isSupabaseConfigured()) {
    return await upsertFragmentToSupabase(frag, vector);
  }

  if (isSupabaseConfigured()) {
    return await upsertFragmentToSupabase(frag);
  }

  return false;
};
