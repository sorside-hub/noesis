import React, { useMemo, useState } from 'react';
import { useNoesis } from '../../context/NoesisContext';
import {
  ConnectionCandidate,
  ConnectionRelationshipType,
  DiscoverSourceItem,
} from '../../types';
import { VectorMapResult } from '../../lib/supabase';
import {
  computeConnectionCandidates,
  fragmentToDiscoverItem,
  makePairKey,
  noteToDiscoverItem,
  requestAnalyzeConnection,
} from '../../lib/discoverAi';
import {
  GitBranch,
  Sparkles,
  Check,
  X,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Loader2,
  ExternalLink,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface ConnectionsPanelProps {
  vectorMap: VectorMapResult | null;
  isLoadingVectors: boolean;
  onRefreshVectors: () => void;
  onSendToSynthesis: (items: DiscoverSourceItem[], topicHint?: string) => void;
}

const RELATIONSHIP_LABELS: Record<
  ConnectionRelationshipType,
  { label: string; badgeClass: string }
> = {
  complementary: {
    label: 'Saling Melengkapi',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  expanding: {
    label: 'Memperluas Topik',
    badgeClass:
      'bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C] border-[#9A3412]/20 dark:border-[#EA580C]/25',
  },
  contrasting: {
    label: 'Sudut Pandang Berlawanan',
    badgeClass:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  },
  foundational: {
    label: 'Saling Mendasari',
    badgeClass:
      'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  },
};

export const ConnectionsPanel: React.FC<ConnectionsPanelProps> = ({
  vectorMap,
  isLoadingVectors,
  onRefreshVectors,
  onSendToSynthesis,
}) => {
  const {
    notes,
    fragments,
    dismissedConnections,
    approvedConnections,
    connectionAnalyses,
    dismissConnection,
    approveConnection,
    saveConnectionAnalysis,
    resetDismissedConnections,
    setActiveNoteId,
    setActiveView,
    openFragmentDrawer,
  } = useNoesis();

  const [viewFilter, setViewFilter] = useState<'pending' | 'approved'>('pending');
  const [analyzingPairs, setAnalyzingPairs] = useState<Record<string, boolean>>({});
  const [pairErrors, setPairErrors] = useState<Record<string, string>>({});
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);

  const dismissedSet = useMemo(() => new Set(dismissedConnections), [dismissedConnections]);
  const approvedSet = useMemo(() => new Set(approvedConnections), [approvedConnections]);

  // Candidate pairs waiting for user review
  const pendingCandidates = useMemo<ConnectionCandidate[]>(() => {
    return computeConnectionCandidates(
      notes,
      fragments,
      vectorMap,
      dismissedSet,
      approvedSet,
      { minVectorThreshold: 0.45, limit: 15 }
    );
  }, [notes, fragments, vectorMap, dismissedSet, approvedSet]);

  // Pairs already approved by the user (resolved from current notes & fragments)
  const approvedPairs = useMemo<{ pairKey: string; itemA: DiscoverSourceItem; itemB: DiscoverSourceItem }[]>(() => {
    if (approvedConnections.length === 0) return [];
    const itemMap = new Map<string, DiscoverSourceItem>();
    notes
      .filter((n) => !n.archived)
      .forEach((n) => itemMap.set(n.id, noteToDiscoverItem(n)));
    fragments.forEach((f) => itemMap.set(f.id, fragmentToDiscoverItem(f)));

    const list: { pairKey: string; itemA: DiscoverSourceItem; itemB: DiscoverSourceItem }[] = [];
    for (const key of approvedConnections) {
      const [idA, idB] = key.split('::');
      const itemA = itemMap.get(idA);
      const itemB = itemMap.get(idB);
      if (itemA && itemB) {
        list.push({ pairKey: makePairKey(idA, idB), itemA, itemB });
      }
    }
    return list;
  }, [approvedConnections, notes, fragments]);

  const handleAnalyzePair = async (pairKey: string, itemA: DiscoverSourceItem, itemB: DiscoverSourceItem) => {
    setAnalyzingPairs((prev) => ({ ...prev, [pairKey]: true }));
    setPairErrors((prev) => {
      const next = { ...prev };
      delete next[pairKey];
      return next;
    });

    try {
      const result = await requestAnalyzeConnection(itemA, itemB);
      saveConnectionAnalysis(itemA, itemB, result);
    } catch (err: any) {
      setPairErrors((prev) => ({
        ...prev,
        [pairKey]: err?.message || 'Gagal menganalisis keterkaitan kedua catatan ini.',
      }));
    } finally {
      setAnalyzingPairs((prev) => ({ ...prev, [pairKey]: false }));
    }
  };

  const handleAnalyzeTopThree = async () => {
    const targets = pendingCandidates
      .filter((c) => !connectionAnalyses[c.pairKey])
      .slice(0, 3);
    if (targets.length === 0) return;

    setIsBatchAnalyzing(true);
    for (const candidate of targets) {
      await handleAnalyzePair(candidate.pairKey, candidate.itemA, candidate.itemB);
    }
    setIsBatchAnalyzing(false);
  };

  const handleOpenSourceItem = (item: DiscoverSourceItem) => {
    if (item.kind === 'note') {
      setActiveNoteId(item.id);
      setActiveView('editor');
    } else {
      openFragmentDrawer(item.id);
    }
  };

  const unanalyzedPendingCount = pendingCandidates.filter((c) => !connectionAnalyses[c.pairKey]).length;

  return (
    <div className="space-y-5">
      {/* Control Header Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Keterkaitan Tersembunyi Antarcatatan
            </h2>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5 leading-relaxed">
              Noesis membandingkan catatan dan fragments yang belum terhubung untuk menjelaskan apakah keduanya saling melengkapi, memperluas gagasan, atau justru bertentangan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefreshVectors}
              disabled={isLoadingVectors}
              className="px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={isLoadingVectors ? 'animate-spin' : ''} />
              <span>{isLoadingVectors ? 'Memuat...' : 'Segarkan'}</span>
            </button>

            {viewFilter === 'pending' && unanalyzedPendingCount > 0 && (
              <button
                type="button"
                onClick={handleAnalyzeTopThree}
                disabled={isBatchAnalyzing}
                className="px-3.5 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isBatchAnalyzing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>
                  {isBatchAnalyzing
                    ? 'Menganalisis...'
                    : `Jelaskan ${Math.min(3, unanalyzedPendingCount)} Teratas`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-filter: Pending Review vs Approved + Restore Dismissed */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
          <div className="flex items-center p-1 bg-[#F5EFEB] dark:bg-[#151413] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
            <button
              type="button"
              onClick={() => setViewFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                viewFilter === 'pending'
                  ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                  : 'text-[#6B635B] dark:text-[#A8A196]'
              }`}
            >
              Perlu Tinjauan ({pendingCandidates.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('approved')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                viewFilter === 'approved'
                  ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                  : 'text-[#6B635B] dark:text-[#A8A196]'
              }`}
            >
              Disetujui ({approvedPairs.length})
            </button>
          </div>

          {dismissedConnections.length > 0 && (
            <button
              type="button"
              onClick={resetDismissedConnections}
              className="text-xs text-[#6B635B] dark:text-[#A8A196] hover:text-[#9A3412] dark:hover:text-[#EA580C] flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Pulihkan {dismissedConnections.length} yang ditolak</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading Indicator on initial vector load */}
      {isLoadingVectors && pendingCandidates.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-center space-y-2">
          <Loader2 size={22} className="animate-spin text-[#9A3412] dark:text-[#EA580C] mx-auto" />
          <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
            Memetakan keterkaitan antar catatan dan fragments...
          </p>
        </div>
      ) : viewFilter === 'pending' ? (
        pendingCandidates.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-[#F5EFEB]/70 dark:bg-[#1E1C1A]/60 border border-dashed border-[#D6CEBE] dark:border-[#332F2C] text-center space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mx-auto">
              <GitBranch size={18} />
            </div>
            <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Belum Ada Pasangan Baru yang Menunggu Tinjauan
            </h3>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] max-w-md mx-auto leading-relaxed">
              Tambahkan lebih banyak catatan atau fragments, atau pastikan catatanmu sudah di-embed di Settings agar Noesis dapat membaca hubungan maknanya secara lebih dalam.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingCandidates.map((candidate) => {
              const analysis = connectionAnalyses[candidate.pairKey];
              const isAnalyzing = Boolean(analyzingPairs[candidate.pairKey]);
              const errorMsg = pairErrors[candidate.pairKey];
              const relStyle = analysis
                ? RELATIONSHIP_LABELS[analysis.relationshipType] || RELATIONSHIP_LABELS.complementary
                : null;

              return (
                <div
                  key={candidate.pairKey}
                  className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4"
                >
                  {/* Top Meta Row — Qualitative basis without raw % focus */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196] bg-[#FAF7F2] dark:bg-[#272422] px-2.5 py-1 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28]">
                        <Layers size={11} className="text-[#9A3412] dark:text-[#EA580C]" />
                        <span>
                          {candidate.basis === 'vector'
                            ? 'Potensi Keterkaitan Makna'
                            : 'Kemiripan Konsep & Tag'}
                        </span>
                      </span>

                      {relStyle && (
                        <span
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border ${relStyle.badgeClass}`}
                        >
                          {relStyle.label}
                        </span>
                      )}
                    </div>

                    {!analysis && (
                      <button
                        type="button"
                        onClick={() =>
                          handleAnalyzePair(candidate.pairKey, candidate.itemA, candidate.itemB)
                        }
                        disabled={isAnalyzing}
                        className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-[#9A3412] dark:text-[#EA580C] hover:border-[#9A3412] dark:hover:border-[#EA580C] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      >
                        {isAnalyzing ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        <span>{isAnalyzing ? 'Menganalisis...' : 'Jelaskan Keterkaitan'}</span>
                      </button>
                    )}
                  </div>

                  {/* Two Source Cards Side-by-Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[candidate.itemA, candidate.itemB].map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-[#151413] border border-[#E8E2D8] dark:border-[#2F2B28] flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono uppercase font-semibold text-[#9A3412] dark:text-[#EA580C]">
                              {item.kind === 'fragment' ? 'Fragment' : 'Catatan'} · {item.type}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenSourceItem(item)}
                              title="Buka sumber asli"
                              className="text-[11px] text-[#9C9388] hover:text-[#9A3412] dark:hover:text-[#EA580C] flex items-center gap-1 transition-colors"
                            >
                              <span>Buka</span>
                              <ExternalLink size={11} />
                            </button>
                          </div>
                          <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] mt-1 line-clamp-1">
                            {item.title}
                          </h3>
                          <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 line-clamp-3 leading-relaxed">
                            {item.excerpt || 'Tanpa pratinjau isi'}
                          </p>
                        </div>

                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {item.tags.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-mono text-[#9C9388] dark:text-[#736C62]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pair Error Notice */}
                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Qualitative Connection Explanation (when analyzed) */}
                  {analysis && (
                    <div className="p-4 rounded-xl bg-[#F5EFEB] dark:bg-[#221F1D] border border-[#E8E2D8] dark:border-[#2F2B28] space-y-2.5">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C] font-semibold">
                          Kesamaan Inti
                        </span>
                        <p className="text-xs sm:text-sm text-[#221F1D] dark:text-[#EDE8E1] mt-0.5 leading-relaxed">
                          {analysis.similaritySummary}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#9C9388] font-semibold">
                          Hubungan yang Terbentuk
                        </span>
                        <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-0.5 leading-relaxed">
                          {analysis.connectionInsight}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#9C9388] font-semibold">
                          Potensi Penggabungan
                        </span>
                        <p className="text-xs text-[#6B635B] dark:text-[#A8A196] italic mt-0.5 leading-relaxed">
                          “{analysis.synthesisPotential}”
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Approve / Reject / Synthesize Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => approveConnection(candidate.itemA, candidate.itemB)}
                        className="px-3.5 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Check size={13} />
                        <span>Setujui Hubungan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissConnection(candidate.itemA, candidate.itemB)}
                        className="px-3.5 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-red-600 hover:border-red-300 dark:hover:border-red-900/50 transition-colors flex items-center gap-1.5"
                      >
                        <X size={13} />
                        <span>Tolak</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onSendToSynthesis(
                          [candidate.itemA, candidate.itemB],
                          analysis?.synthesisPotential
                        )
                      }
                      className="px-3.5 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#272422] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] hover:text-[#9A3412] dark:hover:text-[#EA580C] transition-colors flex items-center gap-1.5"
                    >
                      <Sparkles size={13} />
                      <span>Bawa ke Synthesis</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : /* APPROVED CONNECTIONS LIST */
      approvedPairs.length === 0 ? (
        <div className="p-8 sm:p-10 rounded-2xl bg-[#F5EFEB]/70 dark:bg-[#1E1C1A]/60 border border-dashed border-[#D6CEBE] dark:border-[#332F2C] text-center space-y-2">
          <p className="text-sm font-serif text-[#221F1D] dark:text-[#EDE8E1]">
            Belum ada koneksi yang disetujui.
          </p>
          <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
            Saat kamu menyetujui hubungan pada tab “Perlu Tinjauan”, pasangan catatan akan tertaut dan tersimpan di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvedPairs.map((pair) => {
            const analysis = connectionAnalyses[pair.pairKey];
            const relStyle = analysis
              ? RELATIONSHIP_LABELS[analysis.relationshipType] || RELATIONSHIP_LABELS.complementary
              : null;

            return (
              <div
                key={pair.pairKey}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      <Check size={11} />
                      <span>Terhubung</span>
                    </span>
                    {relStyle && (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-lg border ${relStyle.badgeClass}`}
                      >
                        {relStyle.label}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSendToSynthesis([pair.itemA, pair.itemB], analysis?.synthesisPotential)
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-[#9A3412] dark:text-[#EA580C] hover:border-[#9A3412] transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles size={12} />
                    <span>Gabungkan di Synthesis</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {[pair.itemA, pair.itemB].map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenSourceItem(item)}
                      className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#151413] border border-[#E8E2D8] dark:border-[#2F2B28] cursor-pointer hover:border-[#9A3412] transition-colors"
                    >
                      <span className="text-[10px] font-mono uppercase text-[#9A3412] dark:text-[#EA580C]">
                        {item.kind === 'fragment' ? 'Fragment' : 'Catatan'}
                      </span>
                      <div className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] line-clamp-1 mt-0.5">
                        {item.title}
                      </div>
                    </div>
                  ))}
                </div>

                {analysis && (
                  <p className="text-xs text-[#6B635B] dark:text-[#A8A196] leading-relaxed">
                    {analysis.connectionInsight}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
