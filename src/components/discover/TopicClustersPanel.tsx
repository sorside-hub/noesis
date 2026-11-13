import React, { useMemo, useState } from 'react';
import { useNoesis } from '../../context/NoesisContext';
import {
  DiscoverSourceItem,
  TopicClusterCandidate,
  TopicClusterSummary,
} from '../../types';
import { VectorMapResult } from '../../lib/supabase';
import {
  computeTopicClusters,
  requestSummarizeCluster,
} from '../../lib/discoverAi';
import {
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Check,
  ArrowRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  Compass,
} from 'lucide-react';

interface TopicClustersPanelProps {
  vectorMap: VectorMapResult | null;
  isLoadingVectors: boolean;
  onRefreshVectors: () => void;
  clusterSummaries: Record<string, TopicClusterSummary>;
  onSaveClusterSummary: (clusterId: string, summary: TopicClusterSummary) => void;
  onSendToSynthesis: (items: DiscoverSourceItem[], topicHint?: string) => void;
}

type ClusterDensity = 'loose' | 'standard' | 'tight';

const DENSITY_THRESHOLDS: Record<ClusterDensity, number> = {
  loose: 0.44,
  standard: 0.50,
  tight: 0.58,
};

export const TopicClustersPanel: React.FC<TopicClustersPanelProps> = ({
  vectorMap,
  isLoadingVectors,
  onRefreshVectors,
  clusterSummaries,
  onSaveClusterSummary,
  onSendToSynthesis,
}) => {
  const {
    notes,
    fragments,
    setActiveNoteId,
    setActiveView,
    openFragmentDrawer,
  } = useNoesis();

  const [density, setDensity] = useState<ClusterDensity>('standard');
  const [expandedClusterIds, setExpandedClusterIds] = useState<Record<string, boolean>>({});
  const [excludedItemIdsByCluster, setExcludedItemIdsByCluster] = useState<
    Record<string, Set<string>>
  >({});
  const [analyzingClusterIds, setAnalyzingClusterIds] = useState<Record<string, boolean>>({});
  const [clusterErrors, setClusterErrors] = useState<Record<string, string>>({});

  const clusters = useMemo<TopicClusterCandidate[]>(() => {
    return computeTopicClusters(notes, fragments, vectorMap, {
      minVectorThreshold: DENSITY_THRESHOLDS[density],
      minClusterSize: 3,
      maxClusters: 6,
    });
  }, [notes, fragments, vectorMap, density]);

  const toggleExpandCluster = (clusterId: string) => {
    setExpandedClusterIds((prev) => ({
      ...prev,
      [clusterId]: !prev[clusterId],
    }));
  };

  const toggleClusterItem = (clusterId: string, itemId: string) => {
    setExcludedItemIdsByCluster((prev) => {
      const current = new Set(prev[clusterId] || []);
      if (current.has(itemId)) {
        current.delete(itemId);
      } else {
        current.add(itemId);
      }
      return { ...prev, [clusterId]: current };
    });
  };

  const handleAnalyzeCluster = async (cluster: TopicClusterCandidate) => {
    setAnalyzingClusterIds((prev) => ({ ...prev, [cluster.id]: true }));
    setClusterErrors((prev) => {
      const next = { ...prev };
      delete next[cluster.id];
      return next;
    });

    try {
      const summary = await requestSummarizeCluster(cluster.items);
      onSaveClusterSummary(cluster.id, summary);
    } catch (err: any) {
      setClusterErrors((prev) => ({
        ...prev,
        [cluster.id]: err?.message || 'Gagal merangkum tema kelompok ini.',
      }));
    } finally {
      setAnalyzingClusterIds((prev) => ({ ...prev, [cluster.id]: false }));
    }
  };

  const handleOpenSourceItem = (item: DiscoverSourceItem) => {
    if (item.kind === 'note') {
      setActiveNoteId(item.id);
      setActiveView('editor');
    } else {
      openFragmentDrawer(item.id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Control Header Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Kelompok Catatan Potensial
            </h2>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5 leading-relaxed">
              Kemiripan makna tidak selalu berarti satu topik utuh. Jelajahi isinya terlebih dahulu, pilih catatan yang benar-benar cocok, lalu bawa ke Synthesis jika dirasa tepat.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefreshVectors}
            disabled={isLoadingVectors}
            className="px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <RefreshCw size={13} className={isLoadingVectors ? 'animate-spin' : ''} />
            <span>{isLoadingVectors ? 'Memuat...' : 'Segarkan'}</span>
          </button>
        </div>

        {/* Density Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#6B635B] dark:text-[#A8A196]">
              Kedekatan tema:
            </span>
            <div className="flex items-center p-1 bg-[#F5EFEB] dark:bg-[#151413] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
              {[
                { id: 'loose', label: 'Longgar' },
                { id: 'standard', label: 'Standar' },
                { id: 'tight', label: 'Ketat' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDensity(opt.id as ClusterDensity)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    density === opt.id
                      ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                      : 'text-[#6B635B] dark:text-[#A8A196]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <span className="text-[11px] font-mono text-[#9C9388] dark:text-[#736C62]">
            {clusters.length > 0
              ? `${clusters.length} kelompok potensial ditemukan`
              : 'Belum ada kelompok yang cukup padu'}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoadingVectors && clusters.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-center space-y-2">
          <Loader2 size={22} className="animate-spin text-[#9A3412] dark:text-[#EA580C] mx-auto" />
          <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
            Menelusuri kelompok gagasan di antara catatan dan fragments...
          </p>
        </div>
      ) : clusters.length === 0 ? (
        /* Honest Empty State — Never Force Artificial Clusters */
        <div className="p-8 sm:p-10 rounded-2xl bg-[#F5EFEB]/70 dark:bg-[#1E1C1A]/60 border border-dashed border-[#D6CEBE] dark:border-[#332F2C] text-center space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mx-auto">
            <Compass size={18} />
          </div>
          <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
            Belum Ada Kelompok Tema yang Cukup Alami
          </h3>
          <p className="text-xs text-[#6B635B] dark:text-[#A8A196] max-w-md mx-auto leading-relaxed">
            Noesis tidak memaksakan pengelompokan jika catatan-catatanmu belum benar-benar berdekatan. Coba ubah kedekatan tema ke <strong>Longgar</strong> atau tambahkan lebih banyak catatan & fragments terkait.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clusters.map((cluster) => {
            const isExpanded = Boolean(expandedClusterIds[cluster.id]);
            const summary = clusterSummaries[cluster.id];
            const isAnalyzing = Boolean(analyzingClusterIds[cluster.id]);
            const errorMsg = clusterErrors[cluster.id];
            const excludedSet = excludedItemIdsByCluster[cluster.id] || new Set<string>();

            const noteCount = cluster.items.filter((i) => i.kind === 'note').length;
            const fragmentCount = cluster.items.filter((i) => i.kind === 'fragment').length;
            const selectedItems = cluster.items.filter((i) => !excludedSet.has(i.id));

            // Collect top tags across items in cluster
            const clusterTags = Array.from(
              new Set(cluster.items.flatMap((i) => i.tags || []).filter((t) => t !== 'synthesis'))
            ).slice(0, 5);

            return (
              <div
                key={cluster.id}
                className="rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs overflow-hidden transition-all"
              >
                {/* Collapsed / Header Summary Row */}
                <div className="p-4 sm:p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#9A3412] dark:text-[#EA580C]">
                          <Layers size={11} />
                          <span>
                            {noteCount} Catatan
                            {fragmentCount > 0 ? ` · ${fragmentCount} Fragments` : ''}
                          </span>
                        </span>
                        <span>
                          {cluster.basis === 'vector'
                            ? 'Kedekatan makna'
                            : 'Kemiripan konsep & tag'}
                        </span>
                      </div>

                      <h3 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                        {summary
                          ? summary.themeTitle
                          : `Kelompok Potensial: seputar “${cluster.anchorTitle}”`}
                      </h3>

                      {summary ? (
                        <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] leading-relaxed">
                          {summary.themeDescription}
                        </p>
                      ) : (
                        <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-1">
                          Termasuk:{' '}
                          {cluster.items
                            .slice(0, 3)
                            .map((i) => i.title)
                            .join(', ')}
                          {cluster.items.length > 3 ? `, +${cluster.items.length - 3} lainnya` : ''}
                        </p>
                      )}
                    </div>

                    {/* Explore CTA (No premature Merge CTA here) */}
                    <button
                      type="button"
                      onClick={() => toggleExpandCluster(cluster.id)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1.5 self-start shrink-0 ${
                        isExpanded
                          ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C]'
                          : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412]'
                      }`}
                    >
                      <span>{isExpanded ? 'Tutup Eksplorasi' : 'Jelajahi Isi'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {clusterTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {clusterTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#272422] text-[#9C9388] dark:text-[#736C62]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expanded Exploration View */}
                {isExpanded && (
                  <div className="px-4 sm:px-6 pb-5 pt-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2]/60 dark:bg-[#151413]/50 space-y-4">
                    {/* Optional Gemini Theme Analysis Box */}
                    <div className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                          Gambaran Benang Merah Kelompok
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAnalyzeCluster(cluster)}
                          disabled={isAnalyzing}
                          className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-[#9A3412] dark:text-[#EA580C] hover:border-[#9A3412] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          {isAnalyzing ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          <span>
                            {isAnalyzing
                              ? 'Menganalisis Tema...'
                              : summary
                              ? 'Analisis Ulang Tema'
                              : 'Rangkum Tema Kelompok'}
                          </span>
                        </button>
                      </div>

                      {errorMsg && (
                        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      {summary ? (
                        <div className="space-y-2">
                          <p className="text-xs text-[#6B635B] dark:text-[#A8A196] leading-relaxed">
                            {summary.themeDescription}
                          </p>
                          {summary.keyAngles?.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9C9388]">
                                Sudut Pandang di Dalamnya
                              </span>
                              <ul className="space-y-1">
                                {summary.keyAngles.map((angle, idx) => (
                                  <li
                                    key={idx}
                                    className="text-xs text-[#221F1D] dark:text-[#EDE8E1] flex items-start gap-2"
                                  >
                                    <span className="text-[#9A3412] dark:text-[#EA580C] mt-0.5">
                                      •
                                    </span>
                                    <span>{angle}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
                          Klik <strong>Rangkum Tema Kelompok</strong> jika ingin Noesis membantu melihat benang merah dan sudut pandang dari isi kelompok ini.
                        </p>
                      )}
                    </div>

                    {/* Inspect & Filter Member Items */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                          Isi Kelompok ({selectedItems.length}/{cluster.items.length} dicentang)
                        </span>
                        <span className="text-[11px] text-[#9C9388]">
                          Hapus centang pada catatan yang terasa kurang nyambung
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {cluster.items.map((item) => {
                          const isChecked = !excludedSet.has(item.id);
                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                                isChecked
                                  ? 'bg-white dark:bg-[#1E1C1A] border-[#9A3412]/50 dark:border-[#EA580C]/50'
                                  : 'bg-[#F5EFEB]/50 dark:bg-[#151413] border-[#E8E2D8] dark:border-[#2F2B28] opacity-65'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleClusterItem(cluster.id, item.id)}
                                className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-1 transition-colors ${
                                  isChecked
                                    ? 'bg-[#9A3412] dark:bg-[#EA580C] border-[#9A3412] dark:border-[#EA580C] text-white'
                                    : 'border-[#D6CEBE] dark:border-[#443E3A]'
                                }`}
                              >
                                {isChecked && <Check size={11} />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-mono uppercase font-semibold text-[#9A3412] dark:text-[#EA580C]">
                                    {item.kind === 'fragment' ? 'Fragment' : 'Catatan'} · {item.type}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSourceItem(item)}
                                    className="text-[11px] text-[#9C9388] hover:text-[#9A3412] dark:hover:text-[#EA580C] flex items-center gap-1"
                                  >
                                    <span>Baca</span>
                                    <ExternalLink size={10} />
                                  </button>
                                </div>
                                <h4 className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] line-clamp-1 mt-0.5">
                                  {item.title}
                                </h4>
                                <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] line-clamp-2 mt-0.5 leading-relaxed">
                                  {item.excerpt || 'Tanpa pratinjau isi'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Handoff Action ONLY Inside Expanded Exploration */}
                    <div className="pt-3 border-t border-[#E8E2D8] dark:border-[#2F2B28] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-xs text-[#6B635B] dark:text-[#A8A196]">
                        {selectedItems.length < 2
                          ? 'Sisakan minimal 2 catatan/fragments terpilih untuk dibawa ke Synthesis.'
                          : `${selectedItems.length} bahan siap dieksplorasi lebih lanjut di Synthesis Workspace.`}
                      </span>
                      <button
                        type="button"
                        disabled={selectedItems.length < 2}
                        onClick={() =>
                          onSendToSynthesis(
                            selectedItems,
                            summary?.themeTitle || cluster.anchorTitle
                          )
                        }
                        className="px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Sparkles size={13} />
                        <span>Bawa Bahan ke Synthesis</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
