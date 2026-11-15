import React from 'react';
import { Sparkles, Plus, X, Check, AlertCircle } from 'lucide-react';
import { TagSuggestionResult } from '../types';
import { AiProcessBadge } from './discover/AiProcessBadge';

interface TagSuggestionsPanelProps {
  error: string | null;
  result: TagSuggestionResult | null;
  pendingTags: string[];
  existingWorkspaceTags: Set<string>;
  onApplyTag: (tag: string) => void;
  onApplyAll: () => void;
  onDismiss: () => void;
  onDismissError: () => void;
  overlayKey?: string;
}

export const TagSuggestionsPanel: React.FC<TagSuggestionsPanelProps> = ({
  error,
  result,
  pendingTags,
  existingWorkspaceTags,
  onApplyTag,
  onApplyAll,
  onDismiss,
  onDismissError,
  overlayKey,
}) => {
  if (!error && !result) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {error && (
        <div className="px-2.5 py-2 rounded-xl bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-[11px] text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="text-red-500/80 hover:text-red-700 dark:hover:text-red-200 shrink-0 p-0.5"
            aria-label="Tutup pesan error"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {result && (
        <div className="p-2.5 rounded-xl bg-white/90 dark:bg-[#221F1E]/90 border border-[#E8E2D8] dark:border-[#2F2B28] space-y-2 animate-in fade-in duration-150">
          {/* Header Row: Title + (!) Log + Apply All + Dismiss */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles size={11} className="text-[#9A3412] dark:text-[#EA580C] shrink-0" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B635B] dark:text-[#A8A196] truncate">
                {pendingTags.length > 0
                  ? 'Saran AI'
                  : result.suggestedTags.length > 0
                  ? 'Saran Diterapkan'
                  : 'Saran AI'}
              </span>
              <AiProcessBadge
                featureName="Saran Tags AI"
                modelUsed={result.modelUsed}
                fallbackUsed={result.fallbackUsed}
                aiTrace={result.aiTrace}
                overlayKey={overlayKey}
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {pendingTags.length > 1 && (
                <button
                  type="button"
                  onClick={onApplyAll}
                  className="text-[10px] font-mono text-[#9A3412] dark:text-[#EA580C] hover:underline font-medium cursor-pointer"
                >
                  Tambah semua
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="p-0.5 rounded text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors cursor-pointer"
                title="Tutup saran"
                aria-label="Tutup saran"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Pending Suggestion Chips */}
          {pendingTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {pendingTags.map((tag) => {
                const isExisting = existingWorkspaceTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onApplyTag(tag)}
                    title={
                      isExisting
                        ? `Tambahkan #${tag} (sudah ada di Library)`
                        : `Tambahkan #${tag} (tag baru)`
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono bg-[#FAF7F2] dark:bg-[#1A1817] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] dark:hover:border-[#EA580C] hover:text-[#9A3412] dark:hover:text-[#EA580C] transition-colors cursor-pointer"
                  >
                    <Plus size={11} className="text-[#9A3412] dark:text-[#EA580C] shrink-0" />
                    <span>#{tag}</span>
                  </button>
                );
              })}
            </div>
          ) : result.suggestedTags.length > 0 ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
              <Check size={12} className="shrink-0" />
              <span>Semua tag saran telah ditambahkan.</span>
            </div>
          ) : (
            <p className="text-[11px] text-[#9C9388] dark:text-[#736C62]">
              Belum ada saran tag baru yang lebih relevan dari tag saat ini.
            </p>
          )}

          {/* Brief Reasoning */}
          {result.reasoning && pendingTags.length > 0 && (
            <p className="text-[10px] text-[#6B635B] dark:text-[#A8A196] leading-snug">
              {result.reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
