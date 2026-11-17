// Supabase SQL Schema for Noesis Knowledge Base
// Optimized for Cloudflare Workers AI 'bge-m3' (1024 Dimensions)
// Completely Idempotent (Safe to execute multiple times without deleting existing data)
// Fully supports Supabase Realtime & pgvector similarity search

export const SUPABASE_SQL_SCRIPT = `-- ========================================================================
-- NOESIS KNOWLEDGE BASE - SUPABASE SETUP & AUTH RLS SCRIPT
-- Model: Cloudflare Workers AI 'bge-m3' (1024 Dimensions)
-- Auth: Supabase Auth (Email & Password) with Per-User Row Level Security
-- Idempotent: Aman dijalankan berulang kali tanpa menghapus data yang ada
-- Realtime: Mendukung Supabase Realtime pub/sub
-- ========================================================================

-- 1. AKTIFKAN EKSTENSI VECTOR (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABEL NOTES (LIBRARY)
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  excerpt TEXT DEFAULT '',
  type TEXT DEFAULT 'thought' CHECK (type IN ('thought', 'reference', 'idea', 'synthesis')),
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  favorite BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  related_note_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  embedding vector(1024),
  embedded_at TIMESTAMPTZ,
  exclude_from_embed BOOLEAN DEFAULT false
);

-- 3. TABEL FRAGMENTS
CREATE TABLE IF NOT EXISTS public.fragments (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  type TEXT DEFAULT 'thought' CHECK (type IN ('thought', 'reference', 'idea')),
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  date TEXT,
  source TEXT,
  starred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  embedding vector(1024),
  embedded_at TIMESTAMPTZ
);

-- 3B. TABEL DISCOVER CONNECTIONS (Sinkronisasi koneksi & analisis antar perangkat)
CREATE TABLE IF NOT EXISTS public.discover_connections (
  pair_key TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  item_a_id TEXT NOT NULL,
  item_a_kind TEXT NOT NULL CHECK (item_a_kind IN ('note', 'fragment')),
  item_b_id TEXT NOT NULL,
  item_b_kind TEXT NOT NULL CHECK (item_b_kind IN ('note', 'fragment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  analysis JSONB,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3C. TABEL PROJECTS (Wadah tujuan kerja berbasis teks + sinkronisasi lintas perangkat)
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'review', 'completed', 'archived')),
  progress INTEGER DEFAULT 0,
  enable_word_goal BOOLEAN DEFAULT false,
  target_word_count INTEGER DEFAULT 0,
  current_word_count INTEGER DEFAULT 0,
  deadline TEXT,
  note_ids TEXT[] DEFAULT '{}',
  fragment_ids TEXT[] DEFAULT '{}',
  sections JSONB DEFAULT '[]'::jsonb,
  milestones JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3D. TABEL COPILOT CHATS (Sinkronisasi obrolan Ask Noesis per catatan/bagian project)
CREATE TABLE IF NOT EXISTS public.copilot_chats (
  session_key TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  messages JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. MIGRASI KOLOM (Untuk database yang sudah pernah dibuat sebelumnya)
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS exclude_from_embed BOOLEAN DEFAULT false;
ALTER TABLE public.notes DROP COLUMN IF EXISTS word_count;

-- Perbarui CHECK constraint pada notes.type agar mendukung dokumen 'synthesis'
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'notes'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS %I', c_name);
  END LOOP;
END $$;
ALTER TABLE public.notes
  ADD CONSTRAINT notes_type_check CHECK (type IN ('thought', 'reference', 'idea', 'synthesis'));

ALTER TABLE public.fragments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.fragments ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE public.fragments ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

ALTER TABLE public.discover_connections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.copilot_chats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS enable_word_goal BOOLEAN DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS fragment_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb;

-- Perbarui CHECK constraint pada projects.status agar mendukung status 'draft'
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'projects'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS %I', c_name);
  END LOOP;
END $$;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check CHECK (status IN ('draft', 'active', 'review', 'completed', 'archived'));

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS fragments_user_id_idx ON public.fragments (user_id);
CREATE INDEX IF NOT EXISTS discover_connections_user_id_idx ON public.discover_connections (user_id);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS copilot_chats_user_id_idx ON public.copilot_chats (user_id);

-- 5. AMANKAN DENGAN ROW LEVEL SECURITY (RLS) PER USER
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discover_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_chats ENABLE ROW LEVEL SECURITY;

-- 6. KEBIJAKAN AKSES KETAT (Hanya user login pemilik data yang bisa baca/tulis)
DROP POLICY IF EXISTS "Allow public access to notes" ON public.notes;
DROP POLICY IF EXISTS "Users can manage own notes" ON public.notes;
CREATE POLICY "Users can manage own notes"
  ON public.notes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow public access to fragments" ON public.fragments;
DROP POLICY IF EXISTS "Users can manage own fragments" ON public.fragments;
CREATE POLICY "Users can manage own fragments"
  ON public.fragments FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow public access to discover_connections" ON public.discover_connections;
DROP POLICY IF EXISTS "Users can manage own discover_connections" ON public.discover_connections;
CREATE POLICY "Users can manage own discover_connections"
  ON public.discover_connections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
CREATE POLICY "Users can manage own projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own copilot_chats" ON public.copilot_chats;
CREATE POLICY "Users can manage own copilot_chats"
  ON public.copilot_chats FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. AKTIFKAN SUPABASE REALTIME SECARA AMAN
DO $$
BEGIN
  ALTER TABLE public.notes REPLICA IDENTITY FULL;
  ALTER TABLE public.fragments REPLICA IDENTITY FULL;
  ALTER TABLE public.discover_connections REPLICA IDENTITY FULL;
  ALTER TABLE public.projects REPLICA IDENTITY FULL;
  ALTER TABLE public.copilot_chats REPLICA IDENTITY FULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'fragments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fragments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'discover_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.discover_connections;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'copilot_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.copilot_chats;
  END IF;
END $$;

-- 8. INDEKS HNSW (High-Performance Vector Indexing untuk 1024 dimensi)
CREATE INDEX IF NOT EXISTS notes_embedding_hnsw_idx 
  ON public.notes 
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS fragments_embedding_hnsw_idx 
  ON public.fragments 
  USING hnsw (embedding vector_cosine_ops);

-- 9. FUNGSI SEMANTIC MATCHING (RPC) PER USER
CREATE OR REPLACE FUNCTION match_notes (
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.45,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  excerpt TEXT,
  type TEXT,
  tags TEXT[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    notes.id,
    notes.title,
    notes.content,
    notes.excerpt,
    notes.type,
    notes.tags,
    (1 - (notes.embedding <=> query_embedding))::float AS similarity
  FROM public.notes
  WHERE notes.user_id = auth.uid()
    AND notes.embedding IS NOT NULL
    AND 1 - (notes.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_fragments (
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.45,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  type TEXT,
  tags TEXT[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fragments.id,
    fragments.title,
    fragments.content,
    fragments.type,
    fragments.tags,
    (1 - (fragments.embedding <=> query_embedding))::float AS similarity
  FROM public.fragments
  WHERE fragments.user_id = auth.uid()
    AND fragments.embedding IS NOT NULL
    AND 1 - (fragments.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
`;
