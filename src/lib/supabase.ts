import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Note, Fragment } from '../types';

export const getSupabaseUrl = (): string => {
  return (
    import.meta.env.VITE_SUPABASE_URL ||
    localStorage.getItem('noesis_supabase_url') ||
    ''
  ).trim();
};

export const getSupabaseAnonKey = (): string => {
  return (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    localStorage.getItem('noesis_supabase_anon_key') ||
    ''
  ).trim();
};

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return (
    url.length > 0 &&
    !url.includes('your-project-id') &&
    key.length > 0 &&
    !key.includes('your-supabase-anon-key')
  );
};

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }
  cachedUrl = url;
  cachedKey = key;
  cachedClient = createClient(url, key);
  return cachedClient;
};

// Keep export for backward compatibility
export const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;

// ============================================================================
// DATA MAPPERS (TypeScript camelCase <-> PostgreSQL snake_case)
// ============================================================================

export const toDbNote = (note: Note, embedding?: number[] | null) => {
  const row: Record<string, any> = {
    id: note.id,
    title: note.title,
    content: note.content,
    excerpt: note.excerpt,
    type: note.type,
    notebook_id: note.notebookId || null,
    tags: note.tags || [],
    source: note.source || null,
    favorite: Boolean(note.favorite),
    archived: Boolean(note.archived),
    related_note_ids: note.relatedNoteIds || [],
    word_count: note.wordCount || 0,
    created_at: note.createdAt || new Date().toISOString(),
    updated_at: note.updatedAt || new Date().toISOString(),
  };

  if (embedding !== undefined) {
    row.embedding = embedding;
    row.embedded_at = embedding ? new Date().toISOString() : null;
  }

  return row;
};

export const fromDbNote = (row: any): Note => {
  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    excerpt: row.excerpt || '',
    type: row.type || 'thought',
    notebookId: row.notebook_id || 'nb_philosophy',
    tags: row.tags || [],
    source: row.source || undefined,
    favorite: Boolean(row.favorite),
    archived: Boolean(row.archived),
    relatedNoteIds: row.related_note_ids || [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    wordCount: Number(row.word_count) || 0,
  };
};

export const toDbFragment = (frag: Fragment, embedding?: number[] | null) => {
  const row: Record<string, any> = {
    id: frag.id,
    type: frag.type,
    title: frag.title,
    content: frag.content,
    tags: frag.tags || [],
    date: frag.date || new Date().toLocaleDateString('en-GB'),
    source: frag.source || null,
    starred: Boolean(frag.starred),
  };

  if (embedding !== undefined) {
    row.embedding = embedding;
    row.embedded_at = embedding ? new Date().toISOString() : null;
  }

  return row;
};

export const fromDbFragment = (row: any): Fragment => {
  return {
    id: row.id,
    type: row.type || 'thought',
    title: row.title || '',
    content: row.content || '',
    tags: row.tags || [],
    date: row.date || new Date().toLocaleDateString('en-GB'),
    source: row.source || undefined,
    starred: Boolean(row.starred),
  };
};

// ============================================================================
// SUPABASE OPERATIONS (Async with graceful fallback)
// ============================================================================

export const fetchNotesFromSupabase = async (): Promise<Note[] | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchNotes error:', error.message);
      return null;
    }

    return (data || []).map(fromDbNote);
  } catch (err) {
    console.warn('Supabase fetchNotes network error:', err);
    return null;
  }
};

export const upsertNoteToSupabase = async (
  note: Note,
  embedding?: number[] | null
): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const dbRow = toDbNote(note, embedding);
    const { error } = await supabase.from('notes').upsert(dbRow, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsertNote error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertNote network error:', err);
    return false;
  }
};

export const deleteNoteFromSupabase = async (noteId: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) {
      console.warn('Supabase deleteNote error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteNote network error:', err);
    return false;
  }
};

export const fetchFragmentsFromSupabase = async (): Promise<Fragment[] | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('fragments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchFragments error:', error.message);
      return null;
    }

    return (data || []).map(fromDbFragment);
  } catch (err) {
    console.warn('Supabase fetchFragments network error:', err);
    return null;
  }
};

export const upsertFragmentToSupabase = async (
  fragment: Fragment,
  embedding?: number[] | null
): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const dbRow = toDbFragment(fragment, embedding);
    const { error } = await supabase.from('fragments').upsert(dbRow, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsertFragment error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertFragment network error:', err);
    return false;
  }
};

export const deleteFragmentFromSupabase = async (fragmentId: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('fragments').delete().eq('id', fragmentId);
    if (error) {
      console.warn('Supabase deleteFragment error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteFragment network error:', err);
    return false;
  }
};

// ============================================================================
// SEMANTIC SEARCH (RPC with BGE-M3 1024-dimension vector)
// ============================================================================

export interface SemanticSearchResult<T> {
  item: T;
  similarity: number;
}

export const searchNotesSemantic = async (
  queryEmbedding: number[],
  matchThreshold = 0.45,
  matchCount = 8
): Promise<SemanticSearchResult<Note>[] | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('match_notes', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      console.warn('Supabase match_notes error:', error.message);
      return null;
    }

    return (data || []).map((row: any) => ({
      item: fromDbNote(row),
      similarity: Number(row.similarity) || 0,
    }));
  } catch (err) {
    console.warn('Supabase match_notes network error:', err);
    return null;
  }
};

export const searchFragmentsSemantic = async (
  queryEmbedding: number[],
  matchThreshold = 0.45,
  matchCount = 8
): Promise<SemanticSearchResult<Fragment>[] | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('match_fragments', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      console.warn('Supabase match_fragments error:', error.message);
      return null;
    }

    return (data || []).map((row: any) => ({
      item: fromDbFragment(row),
      similarity: Number(row.similarity) || 0,
    }));
  } catch (err) {
    console.warn('Supabase match_fragments network error:', err);
    return null;
  }
};

// ============================================================================
// REALTIME LISTENER
// ============================================================================

export const subscribeToRealtimeChanges = (
  onNotesChange: () => void,
  onFragmentsChange: () => void
) => {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('noesis-realtime-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes' },
      () => {
        onNotesChange();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fragments' },
      () => {
        onFragmentsChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
