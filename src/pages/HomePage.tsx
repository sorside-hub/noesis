import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import {
  Note,
  Fragment,
  NoteType,
  FragmentType,
  TopicClusterSummary,
  ConnectionRelationshipType,
} from '../types';
import {
  Feather,
  BookOpen,
  Sparkles,
  ArrowRight,
  Star,
  Shuffle,
  RefreshCw,
  GitBranch,
  Layers,
  Loader2,
  ArrowUpRight,
  FolderKanban,
  Calendar,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  countProjectTotalWords,
  getSortedProjectSections,
} from '../lib/projectMaster';

type SparkEntry =
  | { kind: 'note'; item: Note }
  | { kind: 'fragment'; item: Fragment };

const RELATIONSHIP_LABELS: Record<ConnectionRelationshipType, string> = {
  complementary: 'Saling Melengkapi',
  expanding: 'Memperluas Topik',
  contrasting: 'Sudut Berlawanan',
  foundational: 'Saling Mendasari',
  loose: 'Bersinggungan Longgar',
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'Selamat Pagi';
  if (hour >= 11 && hour < 15) return 'Selamat Siang';
  if (hour >= 15 && hour < 19) return 'Selamat Sore';
  return 'Selamat Malam';
};

const parseFragmentTimestamp = (fragment: Fragment): number => {
  if (fragment.updatedAt) {
    const t = Date.parse(fragment.updatedAt);
    if (!Number.isNaN(t)) return t;
  }
  if (fragment.date) {
    const parts = fragment.date.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      const t = new Date(year, month - 1, day).getTime();
      if (!Number.isNaN(t)) return t;
    }
    const parsed = Date.parse(fragment.date);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const formatDisplayDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const getTypeBadgeClass = (type: NoteType | FragmentType) => {
  switch (type) {
    case 'reference':
      return 'text-[#1E3A8A] dark:text-[#60A5FA]';
    case 'idea':
      return 'text-[#B45309] dark:text-[#F59E0B]';
    case 'synthesis':
      return 'text-[#6D28D9] dark:text-[#A78BFA]';
    default:
      return 'text-[#9A3412] dark:text-[#EA580C]';
  }
};

const decodeBasicEntities = (text: string): string =>
  text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const extractReadableParagraphs = (raw: string): string[] => {
  if (!raw) return [];
  const withBreaks = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/(p|h1|h2|h3|h4|h5|h6|li|blockquote|div)\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  return decodeBasicEntities(withBreaks)
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const getReadablePreviewText = (raw: string, fallback = '', maxChars = 320): string => {
  const paras = extractReadableParagraphs(raw);
  const joined = paras.length > 0 ? paras.join(' ') : fallback.trim();
  if (!joined) return '';
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars).trimEnd()}…`;
};

export const HomePage: React.FC = () => {
  const scrollRef = useScrollRestoration<HTMLDivElement>('home');
  const {
    notes,
    fragments,
    projects,
    approvedConnections,
    connectionAnalyses,
    setActiveView,
    setActiveNoteId,
    openProject,
    openFragmentDrawer,
    promoteFragmentToNote,
    startUpdateSynthesis,
  } = useNoesis();

  const [promotingFragmentId, setPromotingFragmentId] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [isSparkExpanded, setIsSparkExpanded] = useState(false);

  const activeNotes = useMemo(() => notes.filter((n) => !n.archived), [notes]);

  // Pool bacaan acak: utamakan catatan pengetahuan (non-excluded) & fragments
  const sparkPool = useMemo<SparkEntry[]>(() => {
    const eligibleNotes = activeNotes.filter((n) => !n.excludeFromEmbed);
    const noteSource = eligibleNotes.length > 0 ? eligibleNotes : activeNotes;
    return [
      ...noteSource.map((item) => ({ kind: 'note' as const, item })),
      ...fragments.map((item) => ({ kind: 'fragment' as const, item })),
    ];
  }, [activeNotes, fragments]);

  const [sparkRef, setSparkRef] = useState<{ kind: 'note' | 'fragment'; id: string } | null>(null);

  const pickRandomSpark = useCallback(
    (exclude?: { kind: 'note' | 'fragment'; id: string } | null) => {
      if (sparkPool.length === 0) {
        setSparkRef(null);
        return;
      }
      const candidates =
        sparkPool.length > 1 && exclude
          ? sparkPool.filter((e) => !(e.kind === exclude.kind && e.item.id === exclude.id))
          : sparkPool;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      setSparkRef({ kind: chosen.kind, id: chosen.item.id });
      setIsSparkExpanded(false);
    },
    [sparkPool]
  );

  // Inisialisasi spark atau pilih ulang jika item saat ini terhapus/diarsipkan
  useEffect(() => {
    if (sparkPool.length === 0) {
      if (sparkRef !== null) setSparkRef(null);
      return;
    }
    const stillExists =
      sparkRef && sparkPool.some((e) => e.kind === sparkRef.kind && e.item.id === sparkRef.id);
    if (!stillExists) {
      pickRandomSpark(null);
    }
  }, [sparkPool, sparkRef, pickRandomSpark]);

  const activeSpark = useMemo<SparkEntry | null>(() => {
    if (!sparkRef) return null;
    return (
      sparkPool.find((e) => e.kind === sparkRef.kind && e.item.id === sparkRef.id) || null
    );
  }, [sparkPool, sparkRef]);

  const sparkReadingData = useMemo(() => {
    if (!activeSpark) return { paragraphs: [] as string[], isLong: false };
    const raw =
      activeSpark.kind === 'note'
        ? activeSpark.item.content || activeSpark.item.excerpt || ''
        : activeSpark.item.content || '';
    const paragraphs = extractReadableParagraphs(raw);
    const totalLength = paragraphs.reduce((acc, p) => acc + p.length, 0);
    const isLong = paragraphs.length > 3 || totalLength > 520;
    return { paragraphs, isLong };
  }, [activeSpark]);

  const visibleSparkParagraphs = useMemo(() => {
    const { paragraphs } = sparkReadingData;
    if (paragraphs.length === 0) return [];
    if (isSparkExpanded) return paragraphs;

    const sliced: string[] = [];
    let charBudget = 0;
    for (const p of paragraphs) {
      if (sliced.length >= 3) break;
      if (sliced.length > 0 && charBudget + p.length > 560) break;
      if (p.length > 560 && sliced.length === 0) {
        sliced.push(`${p.slice(0, 560).trimEnd()}…`);
        break;
      }
      sliced.push(p);
      charBudget += p.length;
    }
    return sliced;
  }, [sparkReadingData, isSparkExpanded]);

  // 1. Living Synthesis terbaru + cek materi baru yang belum terhubung
  const latestSynthesisInfo = useMemo(() => {
    const synthesisNotes = activeNotes
      .filter((n) => n.type === 'synthesis')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (synthesisNotes.length === 0) return null;
    const latest = synthesisNotes[0];

    const linkedSet = new Set<string>(latest.relatedNoteIds || []);
    for (const key of approvedConnections) {
      const [idA, idB] = key.split('::');
      if (idA === latest.id && idB) linkedSet.add(idB);
      if (idB === latest.id && idA) linkedSet.add(idA);
    }

    const latestTs = new Date(latest.updatedAt).getTime();
    const hasNewCandidates =
      activeNotes.some(
        (n) =>
          n.id !== latest.id &&
          !n.excludeFromEmbed &&
          !linkedSet.has(n.id) &&
          new Date(n.updatedAt).getTime() > latestTs
      ) ||
      fragments.some(
        (f) => !linkedSet.has(f.id) && parseFragmentTimestamp(f) > latestTs
      );

    return { note: latest, hasNewCandidates };
  }, [activeNotes, fragments, approvedConnections]);

  // 2. Catatan terakhir untuk dilanjutkan (maks 2 agar bisa tampil lega 3-4 baris)
  const recentWritingNotes = useMemo(() => {
    const regularNotes = activeNotes.filter((n) => n.type !== 'synthesis');
    const source = regularNotes.length > 0 ? regularNotes : activeNotes;
    return [...source]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 2);
  }, [activeNotes]);

  // 3. Fragment terbaru untuk dibaca langsung & diolah (maks 2 agar terbaca utuh)
  const recentFragments = useMemo(() => {
    return [...fragments]
      .sort((a, b) => parseFragmentTimestamp(b) - parseFragmentTimestamp(a))
      .slice(0, 2);
  }, [fragments]);

  // 4. Proyek aktif / sedang dikerjakan (maks 2 ringkas & informatif)
  const activeHomeProjects = useMemo(() => {
    return [...projects]
      .filter((p) => p.status !== 'archived' && p.status !== 'completed')
      .sort(
        (a, b) =>
          (Date.parse(b.updatedAt || b.createdAt || '') || 0) -
          (Date.parse(a.updatedAt || a.createdAt || '') || 0)
      )
      .slice(0, 2);
  }, [projects]);

  // 5. Jejak Discover (Approved Connections & Topic Clusters) + Favorit Pilihan
  const approvedHighlights = useMemo(() => {
    if (approvedConnections.length === 0) return [];
    const noteMap = new Map(activeNotes.map((n) => [n.id, n]));
    const fragMap = new Map(fragments.map((f) => [f.id, f]));

    const items: {
      pairKey: string;
      titleA: string;
      titleB: string;
      kindA: 'note' | 'fragment';
      idA: string;
      relationshipType?: ConnectionRelationshipType;
      insight?: string;
    }[] = [];

    for (const key of [...approvedConnections].reverse()) {
      const [idA, idB] = key.split('::');
      if (!idA || !idB) continue;
      const entryA = noteMap.get(idA)
        ? { kind: 'note' as const, title: noteMap.get(idA)!.title || 'Untitled Note', id: idA }
        : fragMap.get(idA)
        ? { kind: 'fragment' as const, title: fragMap.get(idA)!.title || 'Untitled Fragment', id: idA }
        : null;
      const entryB = noteMap.get(idB)
        ? { kind: 'note' as const, title: noteMap.get(idB)!.title || 'Untitled Note', id: idB }
        : fragMap.get(idB)
        ? { kind: 'fragment' as const, title: fragMap.get(idB)!.title || 'Untitled Fragment', id: idB }
        : null;

      if (!entryA || !entryB) continue;
      const analysis = connectionAnalyses[key];
      items.push({
        pairKey: key,
        titleA: entryA.title,
        titleB: entryB.title,
        kindA: entryA.kind,
        idA: entryA.id,
        relationshipType: analysis?.relationshipType,
        insight: analysis?.connectionInsight || analysis?.similaritySummary,
      });
      if (items.length >= 2) break;
    }

    return items;
  }, [approvedConnections, connectionAnalyses, activeNotes, fragments]);

  const savedClusterTheme = useMemo<TopicClusterSummary | null>(() => {
    try {
      const raw = localStorage.getItem('noesis_discover_cluster_summaries');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, TopicClusterSummary>;
      const list = Object.values(parsed);
      return list.length > 0 ? list[0] : null;
    } catch {
      return null;
    }
  }, []);

  const starredItems = useMemo<SparkEntry[]>(() => {
    const favNotes: SparkEntry[] = activeNotes
      .filter((n) => n.favorite)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((item) => ({ kind: 'note', item }));
    const favFragments: SparkEntry[] = fragments
      .filter((f) => f.starred)
      .sort((a, b) => parseFragmentTimestamp(b) - parseFragmentTimestamp(a))
      .map((item) => ({ kind: 'fragment', item }));

    return [...favNotes, ...favFragments].slice(0, 2);
  }, [activeNotes, fragments]);

  const handleOpenEntry = (entry: SparkEntry) => {
    if (entry.kind === 'note') {
      setActiveNoteId(entry.item.id);
      setActiveView('editor');
    } else {
      openFragmentDrawer(entry.item.id);
    }
  };

  const handlePromoteFragment = async (e: React.MouseEvent, fragmentId: string) => {
    e.stopPropagation();
    if (promotingFragmentId) return;
    setPromoteError(null);
    setPromotingFragmentId(fragmentId);
    try {
      const res = await promoteFragmentToNote(fragmentId);
      if (res.ok && res.noteId) {
        setActiveNoteId(res.noteId);
        setActiveView('editor');
      } else if (!res.ok) {
        setPromoteError(res.error || 'Gagal mengangkat fragment menjadi note.');
      }
    } finally {
      setPromotingFragmentId(null);
    }
  };

  const isWorkspaceEmpty = activeNotes.length === 0 && fragments.length === 0 && projects.length === 0;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-2.5 sm:px-8 lg:px-14 py-2.5 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-7">
        {/* Editorial Header */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-2.5 sm:pb-4">
          <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-[#9A3412] dark:text-[#EA580C]">
            {getGreeting()} · Curatorial Desk
          </span>
          <h1 className="font-serif text-2xl sm:text-4xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] mt-0.5">
            Home
          </h1>
          <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-0.5 sm:mt-1 max-w-xl leading-relaxed">
            Ruang tenang untuk membaca kembali pemikiran, melanjutkan karya, dan menemukan benang merah baru.
          </p>
        </div>

        {isWorkspaceEmpty ? (
          /* Quiet Empty State */
          <div className="py-12 sm:py-16 px-4 sm:px-8 rounded-2xl border border-dashed border-[#E8E2D8] dark:border-[#2F2B28] bg-white/50 dark:bg-[#1E1C1A]/50 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mb-3">
              <Feather size={20} />
            </div>
            <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Meja Pemikiran Masih Kosong
            </h2>
            <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-1 max-w-md leading-relaxed">
              Mulai tangkap percikan ide singkat atau tulis catatan pertamamu lewat tombol bulu. Semua yang kamu simpan akan otomatis terkurasi di sini.
            </p>
          </div>
        ) : (
          <>
            {/* ==============================================================
                BLOK 1: BACAAN HARI INI (Hero Reading Card — Nyaman Dibaca)
               ============================================================== */}
            {activeSpark && (
              <article
                onClick={() => handleOpenEntry(activeSpark)}
                className="p-3.5 sm:p-6 rounded-2xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-[#9C9388] dark:text-[#736C62] shrink-0">
                      <Shuffle size={11} className="text-[#9A3412] dark:text-[#EA580C]" />
                      <span>Bacaan Hari Ini</span>
                    </span>
                    <span className="text-[#D6CEBE] dark:text-[#3D3834]">·</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-semibold shrink-0 ${getTypeBadgeClass(
                        activeSpark.item.type
                      )}`}
                    >
                      {activeSpark.item.type === 'synthesis' && <Sparkles size={10} />}
                      <span>
                        {activeSpark.kind === 'fragment' ? `Fragment · ${activeSpark.item.type}` : activeSpark.item.type}
                      </span>
                    </span>
                  </div>

                  {sparkPool.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pickRandomSpark(sparkRef);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[11px] font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#9A3412] dark:hover:text-[#EA580C] flex items-center gap-1.5 transition-colors shrink-0"
                      title="Acak bacaan lain"
                    >
                      <RefreshCw size={11} />
                      <span>Acak</span>
                    </button>
                  )}
                </div>

                <h2 className="font-serif text-xl sm:text-3xl font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors leading-snug">
                  {activeSpark.item.title || 'Untitled'}
                </h2>

                <div className="mt-2.5 sm:mt-3.5 space-y-2.5 max-w-3xl">
                  {visibleSparkParagraphs.length > 0 ? (
                    visibleSparkParagraphs.map((para, idx) => (
                      <p
                        key={idx}
                        className="text-[13px] sm:text-[15px] text-[#3F3A35] dark:text-[#D1C9BE] leading-relaxed sm:leading-[1.7]"
                      >
                        {para}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs sm:text-sm text-[#9C9388] dark:text-[#736C62] italic">
                      Catatan ini belum memiliki isi tulisan. Ketuk untuk mulai menulis.
                    </p>
                  )}
                </div>

                {sparkReadingData.isLong && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSparkExpanded((prev) => !prev);
                    }}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-[#9A3412] dark:text-[#EA580C] hover:underline"
                  >
                    {isSparkExpanded ? (
                      <>
                        <ChevronUp size={13} />
                        <span>Ringkas bacaan</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={13} />
                        <span>Baca utuh di sini</span>
                      </>
                    )}
                  </button>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 mt-3.5 pt-2.5 border-t border-[#E8E2D8]/80 dark:border-[#2F2B28]/80 text-[11px] font-mono text-[#9C9388] dark:text-[#736C62]">
                  <div className="flex items-center gap-2 truncate">
                    <span>
                      {formatDisplayDate(
                        activeSpark.kind === 'note'
                          ? activeSpark.item.updatedAt
                          : activeSpark.item.date
                      )}
                    </span>
                    {activeSpark.item.tags && activeSpark.item.tags.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="truncate">
                          {activeSpark.item.tags
                            .slice(0, 3)
                            .map((t) => `#${t}`)
                            .join(' ')}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[#9A3412] dark:text-[#EA580C] font-sans font-medium shrink-0">
                    <span>{activeSpark.kind === 'note' ? 'Buka di Editor' : 'Buka Fragment'}</span>
                    <ArrowUpRight size={12} />
                  </span>
                </div>
              </article>
            )}

            {/* ==============================================================
                MAIN EDITORIAL WORKSPACE
                Desktop (lg): Kolom Kiri (Baca & Lanjutkan) | Kolom Kanan (Proyek & Sorotan)
                Mobile: Alur baca berurutan dari atas ke bawah
               ============================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
              {/* KOLOM KIRI (lg:col-span-7): RUANG BACA & LANJUTKAN KARYA */}
              <div className="lg:col-span-7 space-y-5 sm:space-y-6">
                {/* 1. Living Synthesis Terbaru (Isi naskah terbaca jelas, bukan sekadar notice) */}
                {latestSynthesisInfo && (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] flex items-center gap-1.5">
                        <Sparkles size={15} className="text-[#6D28D9] dark:text-[#A78BFA]" />
                        <span>Sintesis Terakhir</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveView('discover')}
                        className="text-xs text-[#6D28D9] dark:text-[#A78BFA] hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Discover</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>

                    <div
                      onClick={() => {
                        setActiveNoteId(latestSynthesisInfo.note.id);
                        setActiveView('editor');
                      }}
                      className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-violet-200/80 dark:border-violet-900/50 hover:border-violet-300 dark:hover:border-violet-700/60 cursor-pointer transition-all shadow-2xs group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#6D28D9] dark:text-[#A78BFA]">
                          <span>Synthesis</span>
                          <span className="text-[#9C9388] dark:text-[#736C62]">
                            · {formatDisplayDate(latestSynthesisInfo.note.updatedAt)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startUpdateSynthesis(latestSynthesisInfo.note.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900/50 text-[11px] font-medium text-[#6D28D9] dark:text-[#A78BFA] hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors shrink-0 flex items-center gap-1"
                        >
                          <Sparkles size={11} />
                          <span>{latestSynthesisInfo.hasNewCandidates ? 'Perbarui · Ada Materi Baru' : 'Perbarui'}</span>
                        </button>
                      </div>

                      <h3 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#6D28D9] dark:group-hover:text-[#A78BFA] transition-colors leading-snug">
                        {latestSynthesisInfo.note.title || 'Untitled Synthesis'}
                      </h3>

                      <p className="text-xs sm:text-[13px] text-[#575049] dark:text-[#B8B0A4] mt-1.5 line-clamp-4 leading-relaxed">
                        {getReadablePreviewText(
                          latestSynthesisInfo.note.content,
                          latestSynthesisInfo.note.excerpt || 'Dokumen sintesis siap dibaca atau diperkaya lagi.',
                          380
                        )}
                      </p>
                    </div>
                  </section>
                )}

                {/* 2. Lanjutkan Menulis (Maks 2 catatan dengan cuplikan 3-4 baris yang terbaca) */}
                {recentWritingNotes.length > 0 && (
                  <section className="space-y-2 sm:space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                        Lanjutkan Menulis
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveView('library')}
                        className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Library</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {recentWritingNotes.map((note) => {
                        const previewText = getReadablePreviewText(
                          note.content,
                          note.excerpt,
                          320
                        );
                        return (
                          <div
                            key={note.id}
                            onClick={() => {
                              setActiveNoteId(note.id);
                              setActiveView('editor');
                            }}
                            className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all shadow-2xs group"
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#9C9388] dark:text-[#736C62] mb-1">
                              <span
                                className={`inline-flex items-center gap-1 uppercase tracking-wider font-semibold ${getTypeBadgeClass(
                                  note.type
                                )}`}
                              >
                                {note.type === 'synthesis' && <Sparkles size={10} />}
                                <span>{note.type}</span>
                              </span>
                              <span>{formatDisplayDate(note.updatedAt)}</span>
                            </div>

                            <h3 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors leading-snug">
                              {note.title || 'Untitled Note'}
                            </h3>

                            {previewText && (
                              <p className="text-xs sm:text-[13px] text-[#575049] dark:text-[#B8B0A4] line-clamp-3 sm:line-clamp-4 mt-1.5 leading-relaxed">
                                {previewText}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 3. Fragment Terbaru (Terbaca utuh di tempat, bukan 1 baris terpotong) */}
                {recentFragments.length > 0 && (
                  <section className="space-y-2 sm:space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                        Fragment Terbaru
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveView('fragments')}
                        className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Fragments</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>

                    {promoteError && (
                      <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl px-3 py-2">
                        {promoteError}
                      </p>
                    )}

                    <div className="space-y-2.5">
                      {recentFragments.map((fragment) => {
                        const isPromoting = promotingFragmentId === fragment.id;
                        return (
                          <div
                            key={fragment.id}
                            onClick={() => openFragmentDrawer(fragment.id)}
                            className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all shadow-2xs group"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 text-[10px] font-mono text-[#9C9388] dark:text-[#736C62]">
                                <span
                                  className={`uppercase tracking-wider font-semibold ${getTypeBadgeClass(
                                    fragment.type
                                  )}`}
                                >
                                  {fragment.type}
                                </span>
                                <span>·</span>
                                <span>{formatDisplayDate(fragment.date)}</span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => handlePromoteFragment(e, fragment.id)}
                                disabled={Boolean(promotingFragmentId)}
                                title="Jadikan Note penuh di Library"
                                className="px-2 py-1 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#272422] text-[11px] font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#9A3412] dark:hover:text-[#EA580C] hover:border-[#9A3412]/40 dark:hover:border-[#EA580C]/40 transition-colors shrink-0 flex items-center gap-1 disabled:opacity-50"
                              >
                                {isPromoting ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <BookOpen size={11} />
                                )}
                                <span>Jadikan Note</span>
                              </button>
                            </div>

                            <h3 className="font-serif text-sm sm:text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors">
                              {fragment.title || 'Untitled Fragment'}
                            </h3>

                            {fragment.content && (
                              <p className="text-xs sm:text-[13px] text-[#575049] dark:text-[#B8B0A4] line-clamp-5 mt-1.5 leading-relaxed whitespace-pre-line">
                                {fragment.content}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              {/* KOLOM KANAN (lg:col-span-5): PROYEK BERJALAN + SOROTAN & KONEKSI */}
              <div className="lg:col-span-5 space-y-5 sm:space-y-6">
                {/* 4. Proyek Berjalan (Maks 2 proyek aktif, ringkas & informatif) */}
                <section className="space-y-2 sm:space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] flex items-center gap-1.5">
                      <FolderKanban size={15} className="text-[#9A3412] dark:text-[#EA580C]" />
                      <span>Proyek Berjalan</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveView('projects')}
                      className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>Projects</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {activeHomeProjects.length > 0 ? (
                    <div className="space-y-2">
                      {activeHomeProjects.map((proj) => {
                        const secList = getSortedProjectSections(proj);
                        const doneCount = secList.filter((s) => s.status === 'done').length;
                        const words = countProjectTotalWords(proj);
                        const isReview = proj.status === 'review';

                        return (
                          <div
                            key={proj.id}
                            onClick={() => openProject(proj.id)}
                            className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all shadow-2xs group"
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#9C9388] dark:text-[#736C62] mb-1">
                              <span
                                className={`inline-flex items-center gap-1 uppercase tracking-wider font-semibold ${
                                  isReview
                                    ? 'text-[#B45309] dark:text-[#F59E0B]'
                                    : 'text-[#9A3412] dark:text-[#EA580C]'
                                }`}
                              >
                                {isReview ? 'Meninjau' : 'Aktif'}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                {proj.deadline && (
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar size={10} />
                                    <span>{proj.deadline}</span>
                                  </span>
                                )}
                                <span>{proj.progress}%</span>
                              </div>
                            </div>

                            <h3 className="font-serif text-sm sm:text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors line-clamp-1">
                              {proj.title}
                            </h3>

                            {proj.description && (
                              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-2 mt-0.5 leading-relaxed">
                                {proj.description}
                              </p>
                            )}

                            <div className="mt-2.5 flex items-center gap-2.5">
                              <div className="flex-1 h-1.5 rounded-full bg-[#EFEAE2] dark:bg-[#2A2724] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#9A3412] dark:bg-[#EA580C] transition-all"
                                  style={{ width: `${Math.min(100, Math.max(0, proj.progress))}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-[#9C9388] dark:text-[#736C62] shrink-0">
                                {secList.length > 0
                                  ? `${doneCount}/${secList.length} bagian · `
                                  : ''}
                                {words.toLocaleString('id-ID')} kata
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-dashed border-[#D6CEBE] dark:border-[#3A3531] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                          Belum ada proyek berjalan
                        </p>
                        <p className="text-[11px] sm:text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5">
                          Susun kerangka naskahmu jadi satu karya utuh.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('projects')}
                        className="px-2.5 py-1.5 rounded-lg bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C] hover:bg-[#9A3412]/15 dark:hover:bg-[#EA580C]/25 text-xs font-medium flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Plus size={13} />
                        <span>Studio</span>
                      </button>
                    </div>
                  )}
                </section>

                {/* 5. Sorotan & Koneksi (Discover Insights + Favorit dengan preview terbaca) */}
                <section className="space-y-2 sm:space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                      Sorotan &amp; Koneksi
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveView('discover')}
                      className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>Explore Discover</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  <div className="rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] divide-y divide-[#E8E2D8]/70 dark:divide-[#2F2B28]/70 overflow-hidden shadow-2xs">
                    {approvedHighlights.length > 0 ? (
                      approvedHighlights.map((conn) => (
                        <div
                          key={conn.pairKey}
                          onClick={() => {
                            if (conn.kindA === 'note') {
                              setActiveNoteId(conn.idA);
                              setActiveView('editor');
                            } else {
                              openFragmentDrawer(conn.idA);
                            }
                          }}
                          className="p-3 sm:p-3.5 hover:bg-[#FAF7F2] dark:hover:bg-[#272422]/60 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#9A3412] dark:text-[#EA580C] mb-1">
                            <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold">
                              <GitBranch size={11} />
                              <span>
                                {conn.relationshipType
                                  ? RELATIONSHIP_LABELS[conn.relationshipType]
                                  : 'Koneksi Terhubung'}
                              </span>
                            </span>
                            <ArrowUpRight
                              size={12}
                              className="text-[#9C9388] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] shrink-0"
                            />
                          </div>
                          <p className="font-serif text-xs sm:text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] leading-snug">
                            {conn.titleA} <span className="text-[#9C9388] font-sans">↔</span> {conn.titleB}
                          </p>
                          {conn.insight && (
                            <p className="text-xs text-[#575049] dark:text-[#B8B0A4] line-clamp-3 sm:line-clamp-4 mt-1.5 leading-relaxed">
                              {conn.insight}
                            </p>
                          )}
                        </div>
                      ))
                    ) : savedClusterTheme ? (
                      <div
                        onClick={() => setActiveView('discover')}
                        className="p-3 sm:p-3.5 hover:bg-[#FAF7F2] dark:hover:bg-[#272422]/60 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#9A3412] dark:text-[#EA580C] mb-1">
                          <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold">
                            <Layers size={11} />
                            <span>Klaster Topik</span>
                          </span>
                          <ArrowUpRight
                            size={12}
                            className="text-[#9C9388] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] shrink-0"
                          />
                        </div>
                        <p className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                          {savedClusterTheme.themeTitle}
                        </p>
                        <p className="text-xs text-[#575049] dark:text-[#B8B0A4] line-clamp-3 sm:line-clamp-4 mt-1 leading-relaxed">
                          {savedClusterTheme.themeDescription}
                        </p>
                      </div>
                    ) : (
                      <div
                        onClick={() => setActiveView('discover')}
                        className="p-3 sm:p-3.5 hover:bg-[#FAF7F2] dark:hover:bg-[#272422]/60 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#9A3412] dark:text-[#EA580C] mb-1">
                          <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold">
                            <Sparkles size={11} />
                            <span>Discover Workspace</span>
                          </span>
                          <ArrowUpRight
                            size={12}
                            className="text-[#9C9388] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] shrink-0"
                          />
                        </div>
                        <p className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                          Temukan keterkaitan antar pemikiranmu
                        </p>
                        <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5 leading-relaxed">
                          Jelajahi koneksi ide yang mirip atau rangkai beberapa catatan menjadi satu dokumen sintesis.
                        </p>
                      </div>
                    )}

                    {/* Favorit Pilihan (2 item, dengan preview terbaca 3 baris) */}
                    {starredItems.map((entry) => {
                      const previewText =
                        entry.kind === 'note'
                          ? getReadablePreviewText(entry.item.content, entry.item.excerpt, 240)
                          : (entry.item.content || '').trim();
                      return (
                        <div
                          key={`${entry.kind}-${entry.item.id}`}
                          onClick={() => handleOpenEntry(entry)}
                          className="p-3 sm:p-3.5 hover:bg-[#FAF7F2] dark:hover:bg-[#272422]/60 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#9C9388] dark:text-[#736C62] mb-0.5">
                            <span className="inline-flex items-center gap-1.5">
                              <Star
                                size={11}
                                fill="currentColor"
                                className="text-[#B45309] dark:text-[#F59E0B] shrink-0"
                              />
                              <span
                                className={`uppercase tracking-wider font-semibold ${getTypeBadgeClass(
                                  entry.item.type
                                )}`}
                              >
                                {entry.kind === 'fragment' ? `Fragment · ${entry.item.type}` : entry.item.type}
                              </span>
                            </span>
                            <span>
                              {formatDisplayDate(
                                entry.kind === 'note' ? entry.item.updatedAt : entry.item.date
                              )}
                            </span>
                          </div>

                          <h3 className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors leading-snug">
                            {entry.item.title || 'Untitled'}
                          </h3>

                          {previewText && (
                            <p className="text-xs text-[#575049] dark:text-[#B8B0A4] line-clamp-3 mt-1 leading-relaxed">
                              {previewText}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
