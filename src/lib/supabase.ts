import { createClient, SupabaseClient, Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { Note, Fragment, DiscoverConnectionRecord } from '../types';

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

export const resetSupabaseClientCache = () => {
  cachedClient = null;
  cachedUrl = '';
  cachedKey = '';
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }
  cachedUrl = url;
  cachedKey = key;
  cachedClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
};

// Keep export for backward compatibility
export const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;

const resolveAuthUserId = async (client: SupabaseClient): Promise<string | null> => {
  try {
    const { data } = await client.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
};

// ============================================================================
// SUPABASE AUTHENTICATION HELPERS (Email & Password)
// ============================================================================

export const getSupabaseSession = async (): Promise<Session | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn('Supabase getSession error:', error.message);
      return null;
    }
    return data.session ?? null;
  } catch (err) {
    console.warn('Supabase getSession network error:', err);
    return null;
  }
};

export const onSupabaseAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void
): (() => void) => {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => {
    data.subscription.unsubscribe();
  };
};

export const signInWithEmailPassword = async (
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { user: null, session: null, error: 'Kredensial Supabase belum dikonfigurasi.' };
  }
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { user: null, session: null, error: error.message };
    }
    return { user: data.user ?? null, session: data.session ?? null, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err?.message || 'Gagal terhubung ke Supabase Auth.' };
  }
};

export const signUpWithEmailPassword = async (
  email: string,
  password: string
): Promise<{
  user: User | null;
  session: Session | null;
  needsEmailConfirmation: boolean;
  error: string | null;
}> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      user: null,
      session: null,
      needsEmailConfirmation: false,
      error: 'Kredensial Supabase belum dikonfigurasi.',
    };
  }
  try {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      return { user: null, session: null, needsEmailConfirmation: false, error: error.message };
    }
    const needsEmailConfirmation = Boolean(data.user && !data.session);
    return {
      user: data.user ?? null,
      session: data.session ?? null,
      needsEmailConfirmation,
      error: null,
    };
  } catch (err: any) {
    return {
      user: null,
      session: null,
      needsEmailConfirmation: false,
      error: err?.message || 'Gagal mendaftar ke Supabase Auth.',
    };
  }
};

export const signOutFromSupabase = async (): Promise<{ error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) return { error: null };
  try {
    const { error } = await client.auth.signOut();
    return { error: error ? error.message : null };
  } catch (err: any) {
    return { error: err?.message || 'Gagal logout.' };
  }
};

export const updateSupabasePassword = async (
  newPassword: string
): Promise<{ error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) return { error: 'Supabase belum terhubung.' };
  try {
    const { error } = await client.auth.updateUser({ password: newPassword });
    return { error: error ? error.message : null };
  } catch (err: any) {
    return { error: err?.message || 'Gagal memperbarui password.' };
  }
};

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
    tags: note.tags || [],
    source: note.source || null,
    favorite: Boolean(note.favorite),
    archived: Boolean(note.archived),
    related_note_ids: note.relatedNoteIds || [],
    created_at: note.createdAt || new Date().toISOString(),
    updated_at: note.updatedAt || new Date().toISOString(),
    embedded_at: note.embeddedAt || null,
  };

  if (embedding !== undefined) {
    row.embedding = embedding;
    if (embedding) {
      row.embedded_at = new Date().toISOString();
    } else {
      row.embedded_at = null;
    }
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
    tags: row.tags || [],
    source: row.source || undefined,
    favorite: Boolean(row.favorite),
    archived: Boolean(row.archived),
    relatedNoteIds: row.related_note_ids || [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    embeddedAt: row.embedded_at || undefined,
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
    embedded_at: frag.embeddedAt || null,
  };

  if (embedding !== undefined) {
    row.embedding = embedding;
    if (embedding) {
      row.embedded_at = new Date().toISOString();
    } else {
      row.embedded_at = null;
    }
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
    embeddedAt: row.embedded_at || undefined,
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
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const dbRow = toDbNote(note, embedding);
    const userId = await resolveAuthUserId(client);
    if (userId) dbRow.user_id = userId;
    const { error } = await client.from('notes').upsert(dbRow, { onConflict: 'id' });
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
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('notes').delete().eq('id', noteId);
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
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
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
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const dbRow = toDbFragment(fragment, embedding);
    const userId = await resolveAuthUserId(client);
    if (userId) dbRow.user_id = userId;
    const { error } = await client.from('fragments').upsert(dbRow, { onConflict: 'id' });
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
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('fragments').delete().eq('id', fragmentId);
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

export const fetchFragmentEmbeddingById = async (
  fragmentId: string
): Promise<{ ok: boolean; embedding: number[] | null; embeddedAt?: string }> => {
  const client = getSupabaseClient();
  if (!client) return { ok: false, embedding: null };
  try {
    const { data, error } = await client
      .from('fragments')
      .select('embedding, embedded_at')
      .eq('id', fragmentId)
      .maybeSingle();

    if (error) {
      console.warn('Supabase fetchFragmentEmbeddingById error:', error.message);
      return { ok: false, embedding: null };
    }

    if (!data) {
      return { ok: true, embedding: null };
    }

    return {
      ok: true,
      embedding: parsePgVector((data as any).embedding),
      embeddedAt: (data as any).embedded_at || undefined,
    };
  } catch (err) {
    console.warn('Supabase fetchFragmentEmbeddingById network error:', err);
    return { ok: false, embedding: null };
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
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('match_notes', {
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
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('match_fragments', {
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

const parsePgVector = (raw: unknown): number[] | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.length === 1024 ? raw.map(Number) : null;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 1024) {
        return parsed.map(Number);
      }
    } catch {
      return null;
    }
  }
  return null;
};

export interface VectorMapResult {
  noteVectors: Map<string, number[]>;
  fragmentVectors: Map<string, number[]>;
}

/**
 * Fetches stored 1024-dimension vectors for Notes & Fragments from Supabase
 * Used to compute connection candidates & topic clusters across both tables.
 */
export const fetchAllVectorEmbeddings = async (): Promise<VectorMapResult | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const [notesRes, fragsRes] = await Promise.all([
      client
        .from('notes')
        .select('id, embedding')
        .not('embedding', 'is', null)
        .eq('archived', false),
      client
        .from('fragments')
        .select('id, embedding')
        .not('embedding', 'is', null),
    ]);

    const noteVectors = new Map<string, number[]>();
    const fragmentVectors = new Map<string, number[]>();

    if (!notesRes.error && Array.isArray(notesRes.data)) {
      for (const row of notesRes.data) {
        const vec = parsePgVector((row as any).embedding);
        if (vec) noteVectors.set(row.id, vec);
      }
    }

    if (!fragsRes.error && Array.isArray(fragsRes.data)) {
      for (const row of fragsRes.data) {
        const vec = parsePgVector((row as any).embedding);
        if (vec) fragmentVectors.set(row.id, vec);
      }
    }

    return { noteVectors, fragmentVectors };
  } catch (err) {
    console.warn('fetchAllVectorEmbeddings error:', err);
    return null;
  }
};

// ============================================================================
// DISCOVER CONNECTIONS SYNC (Cross-Device Approved / Dismissed / Analysis)
// ============================================================================

const fromDbDiscoverConnection = (row: any): DiscoverConnectionRecord => ({
  pairKey: row.pair_key,
  itemAId: row.item_a_id,
  itemAKind: row.item_a_kind || 'note',
  itemBId: row.item_b_id,
  itemBKind: row.item_b_kind || 'note',
  status: row.status || 'pending',
  analysis: row.analysis || undefined,
  updatedAt: row.updated_at || new Date().toISOString(),
});

export const fetchDiscoverConnectionsFromSupabase = async (): Promise<
  DiscoverConnectionRecord[] | null
> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('discover_connections')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchDiscoverConnections error:', error.message);
      return null;
    }

    return (data || []).map(fromDbDiscoverConnection);
  } catch (err) {
    console.warn('Supabase fetchDiscoverConnections network error:', err);
    return null;
  }
};

export const upsertDiscoverConnectionToSupabase = async (
  record: DiscoverConnectionRecord
): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const userId = await resolveAuthUserId(client);
    const payload: Record<string, any> = {
      pair_key: record.pairKey,
      item_a_id: record.itemAId,
      item_a_kind: record.itemAKind,
      item_b_id: record.itemBId,
      item_b_kind: record.itemBKind,
      status: record.status,
      analysis: record.analysis ?? null,
      updated_at: record.updatedAt || new Date().toISOString(),
    };
    if (userId) payload.user_id = userId;

    const { error } = await client
      .from('discover_connections')
      .upsert(payload, { onConflict: 'pair_key' });

    if (error) {
      console.warn('Supabase upsertDiscoverConnection error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsertDiscoverConnection network error:', err);
    return false;
  }
};

export const restoreDismissedDiscoverConnectionsInSupabase = async (): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client
      .from('discover_connections')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'dismissed');

    if (error) {
      console.warn('Supabase restoreDismissedDiscoverConnections error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase restoreDismissedDiscoverConnections network error:', err);
    return false;
  }
};

export const unlinkDiscoverConnectionInSupabase = async (pairKey: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client
      .from('discover_connections')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('pair_key', pairKey);

    if (error) {
      console.warn('Supabase unlinkDiscoverConnection error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase unlinkDiscoverConnection network error:', err);
    return false;
  }
};

export const deleteDiscoverConnectionsForItem = async (itemId: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client
      .from('discover_connections')
      .delete()
      .or(`item_a_id.eq.${itemId},item_b_id.eq.${itemId}`);

    if (error) {
      console.warn('Supabase deleteDiscoverConnectionsForItem error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase deleteDiscoverConnectionsForItem network error:', err);
    return false;
  }
};

// ============================================================================
// REALTIME LISTENER
// ============================================================================

export const subscribeToRealtimeChanges = (
  onNotesChange: () => void,
  onFragmentsChange: () => void,
  onDiscoverConnectionsChange?: () => void
) => {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const channel = client
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
    );

  if (onDiscoverConnectionsChange) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'discover_connections' },
      () => {
        onDiscoverConnectionsChange();
      }
    );
  }

  channel.subscribe();

  return () => {
    client.removeChannel(channel);
  };
};
