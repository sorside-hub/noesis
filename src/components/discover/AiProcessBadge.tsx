import React, { useState, useId } from 'react';
import {
  Info,
  AlertCircle,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
} from 'lucide-react';
import { AiExecutionTrace } from '../../types';
import { useBackOverlay } from '../../hooks/useBackOverlay';

interface AiProcessBadgeProps {
  featureName: string;
  modelUsed?: string;
  fallbackUsed?: boolean;
  aiTrace?: AiExecutionTrace;
  overlayKey?: string;
}

const formatDuration = (ms?: number): string => {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) return '';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} dtk`;
};

export const AiProcessBadge: React.FC<AiProcessBadgeProps> = ({
  featureName,
  modelUsed,
  fallbackUsed,
  aiTrace,
  overlayKey,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const autoId = useId();
  useBackOverlay(isOpen, () => setIsOpen(false), overlayKey || `ai-process-${autoId}`);

  const resolvedModel = aiTrace?.modelUsed || modelUsed;
  const isFallback = Boolean(aiTrace?.fallbackUsed ?? fallbackUsed);
  const isRetriedPrimary = Boolean(aiTrace?.retriedPrimary && !isFallback);

  if (!resolvedModel && !aiTrace) return null;

  const badgeButtonClasses = isFallback
    ? 'text-amber-700 dark:text-amber-300 bg-amber-500/12 border-amber-500/35 hover:bg-amber-500/20'
    : isRetriedPrimary
    ? 'text-[#9A3412] dark:text-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 border-[#9A3412]/25 dark:border-[#EA580C]/30 hover:bg-[#9A3412]/15'
    : 'text-[#6B635B] dark:text-[#A8A196] bg-[#FAF7F2] dark:bg-[#272422] border-[#E8E2D8] dark:border-[#2F2B28] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:border-[#D6CEBE] dark:hover:border-[#443E3A]';

  const triggerLabel = isFallback
    ? `Model Fallback (${resolvedModel}) — Klik untuk lihat log proses AI`
    : isRetriedPrimary
    ? `Model Utama setelah retry (${resolvedModel}) — Klik untuk lihat log proses AI`
    : `Model Utama (${resolvedModel}) — Klik untuk lihat info proses AI`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title={triggerLabel}
        aria-label={triggerLabel}
        className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-mono transition-colors shrink-0 cursor-pointer ${badgeButtonClasses}`}
      >
        {isFallback ? <AlertCircle size={12} /> : <Info size={12} />}
        {isFallback && <span className="font-medium leading-none">Fallback</span>}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Log Proses AI — ${featureName}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isFallback
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C]'
                  }`}
                >
                  {isFallback ? <AlertCircle size={15} /> : <Cpu size={15} />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif text-sm font-semibold text-[#221F1D] dark:text-[#EDE8E1] truncate">
                    Info Model &amp; Proses AI
                  </h3>
                  <p className="text-[11px] font-mono text-[#9C9388] dark:text-[#736C62] truncate">
                    {featureName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup popup"
                className="p-1 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Summary Status Box */}
              <div className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-[#151413] border border-[#E8E2D8] dark:border-[#2F2B28] space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-lg border ${
                      isFallback
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                    }`}
                  >
                    {isFallback ? <AlertCircle size={11} /> : <CheckCircle2 size={11} />}
                    <span>{isFallback ? 'Diproses oleh Model Fallback' : 'Diproses oleh Model Utama'}</span>
                  </span>

                  {aiTrace?.totalDurationMs !== undefined && (
                    <span className="text-[11px] font-mono text-[#9C9388] dark:text-[#736C62]">
                      Total: {formatDuration(aiTrace.totalDurationMs)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6B635B] dark:text-[#A8A196]">Model aktif</span>
                    <code className="font-mono text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1]">
                      {resolvedModel}
                    </code>
                  </div>
                  {aiTrace?.primaryModel && isFallback && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#6B635B] dark:text-[#A8A196]">Model utama</span>
                      <code className="font-mono text-[11px] text-[#9C9388] dark:text-[#736C62]">
                        {aiTrace.primaryModel}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {/* Fallback Warning Note */}
              {isFallback && (
                <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  Model utama gagal setelah mencoba ulang, sehingga sistem otomatis memakai model cadangan. Jika hasil terasa kurang mendalam, kamu bisa mengulangi proses untuk mencoba kembali dengan model utama.
                </div>
              )}

              {/* Step-by-Step Timeline */}
              {aiTrace?.steps && aiTrace.steps.length > 0 ? (
                <div className="space-y-2">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
                    Urutan Proses ({aiTrace.steps.length} langkah)
                  </span>
                  <div className="space-y-2">
                    {aiTrace.steps.map((s) => {
                      const StepIcon =
                        s.status === 'success'
                          ? CheckCircle2
                          : s.status === 'failed'
                          ? XCircle
                          : Clock;
                      const iconColor =
                        s.status === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : s.status === 'failed'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400';

                      return (
                        <div
                          key={s.step}
                          className="p-2.5 rounded-xl bg-[#FAF7F2]/70 dark:bg-[#151413]/70 border border-[#E8E2D8] dark:border-[#2F2B28] flex items-start gap-2.5"
                        >
                          <StepIcon size={14} className={`${iconColor} shrink-0 mt-0.5`} />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                                {s.label}
                              </span>
                              {s.durationMs !== undefined && (
                                <span className="text-[10px] font-mono text-[#9C9388] dark:text-[#736C62] shrink-0">
                                  {formatDuration(s.durationMs)}
                                </span>
                              )}
                            </div>
                            {s.model && (
                              <div className="text-[10px] font-mono text-[#6B635B] dark:text-[#A8A196]">
                                Model: {s.model}
                              </div>
                            )}
                            {s.detail && (
                              <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] leading-snug break-words">
                                {s.detail}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[#9C9388] dark:text-[#736C62] leading-relaxed">
                  Riwayat langkah terperinci belum tersedia untuk hasil analisis lama yang tersimpan sebelumnya. Jalankan ulang analisis untuk merekam log percobaan &amp; fallback lengkap.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
