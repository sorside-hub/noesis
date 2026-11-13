// Supabase SQL Schema for Noesis Knowledge Base
// Optimized for Cloudflare Workers AI 'bge-m3' (1024 Dimensions)
// Completely Idempotent (Safe to execute multiple times without deleting existing data)
// Fully supports Supabase Realtime & pgvector similarity search

export const SUPABASE_SQL_SCRIPT = `-- ========================================================================
-- NOESIS KNOWLEDGE BASE - SUPABASE SETUP SCRIPT
-- Model: Cloudflare Workers AI 'bge-m3' (1024 Dimensions)
-- Idempotent: Aman dijalankan berulang kali tanpa menghapus data yang ada
-- Realtime: Mendukung Supabase Realtime pub/sub
-- ========================================================================

-- 1. AKTIFKAN EKSTENSI VECTOR (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABEL NOTES (LIBRARY)
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  excerpt TEXT DEFAULT '',
  type TEXT DEFAULT 'thought' CHECK (type IN ('thought', 'reference', 'idea')),
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  favorite BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  related_note_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  embedding vector(1024),
  embedded_at TIMESTAMPTZ
);

-- 3. TABEL FRAGMENTS
CREATE TABLE IF NOT EXISTS public.fragments (
  id TEXT PRIMARY KEY,
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
  item_a_id TEXT NOT NULL,
  item_a_kind TEXT NOT NULL CHECK (item_a_kind IN ('note', 'fragment')),
  item_b_id TEXT NOT NULL,
  item_b_kind TEXT NOT NULL CHECK (item_b_kind IN ('note', 'fragment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  analysis JSONB,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PASTIKAN KOLOM EMBEDDING TERSEDIA & BERSIHKAN KOLOM TIDAK DIPAKAI
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;
ALTER TABLE public.notes DROP COLUMN IF EXISTS word_count;
ALTER TABLE public.fragments ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE public.fragments ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- 5. AMANKAN DENGAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discover_connections ENABLE ROW LEVEL SECURITY;

-- 6. KEBIJAKAN AKSES (RLS POLICIES) - Dibuat hanya jika belum ada
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access to notes' AND tablename = 'notes') THEN
    CREATE POLICY "Allow public access to notes" ON public.notes FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access to fragments' AND tablename = 'fragments') THEN
    CREATE POLICY "Allow public access to fragments" ON public.fragments FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access to discover_connections' AND tablename = 'discover_connections') THEN
    CREATE POLICY "Allow public access to discover_connections" ON public.discover_connections FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 7. AKTIFKAN SUPABASE REALTIME SECARA AMAN
DO $$
BEGIN
  ALTER TABLE public.notes REPLICA IDENTITY FULL;
  ALTER TABLE public.fragments REPLICA IDENTITY FULL;
  ALTER TABLE public.discover_connections REPLICA IDENTITY FULL;

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
END $$;

-- 8. INDEKS HNSW (High-Performance Vector Indexing untuk 1024 dimensi)
CREATE INDEX IF NOT EXISTS notes_embedding_hnsw_idx 
  ON public.notes 
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS fragments_embedding_hnsw_idx 
  ON public.fragments 
  USING hnsw (embedding vector_cosine_ops);

-- 9. FUNGSI SEMANTIC MATCHING (RPC) UNTUK PENCARIAN MAKNA (COSINE SIMILARITY)
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
  WHERE notes.embedding IS NOT NULL
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
  WHERE fragments.embedding IS NOT NULL
    AND 1 - (fragments.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
`;
