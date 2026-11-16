import React, { useEffect, useState } from 'react';
import {
  Note,
  Fragment,
  Project,
  ProjectOutlineResult,
  ProjectSection,
} from '../../types';
import { requestProjectOutline } from '../../lib/discoverAi';
import { sectionHasWrittenContent } from '../../lib/projectMaster';
import { AiProcessBadge } from '../discover/AiProcessBadge';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  RefreshCw,
  BookOpen,
  Feather,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface EditableOutlineItem {
  id: string;
  selected: boolean;
  title: string;
  summary: string;
  materialRefs: string[];
}

interface ProjectOutlineModalProps {
  isOpen: boolean;
  project: Project;
  sections: ProjectSection[];
  linkedNotes: Note[];
  linkedFragments: Fragment[];
  onClose: () => void;
  onApplyOutline: (
    items: { title: string; initialContent: string }[],
    replaceEmptySections: boolean
  ) => void;
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const ProjectOutlineModal: React.FC<ProjectOutlineModalProps> = ({
  isOpen,
  project,
  sections,
  linkedNotes,
  linkedFragments,
  onClose,
  onApplyOutline,
}) => {
  const [guidance, setGuidance] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectOutlineResult | null>(null);
  const [items, setItems] = useState<EditableOutlineItem[]>([]);
  const [includeGuidanceInBody, setIncludeGuidanceInBody] = useState(false);
  const [replaceEmpty, setReplaceEmpty] = useState(true);

  const hasAnyWrittenSection = sections.some((s) => sectionHasWrittenContent(s));
  const totalMaterials = linkedNotes.length + linkedFragments.length;

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setResult(null);
    setItems([]);
    setGuidance('');
    setIncludeGuidanceInBody(false);
    setReplaceEmpty(!hasAnyWrittenSection);
  }, [isOpen, project.id, hasAnyWrittenSection]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const materialsPayload = [
        ...linkedNotes.map((n) => ({
          kind: 'note' as const,
          title: n.title || 'Tanpa Judul',
          type: n.type || 'thought',
          excerpt: n.excerpt || '',
          content: n.content || '',
          tags: n.tags || [],
        })),
        ...linkedFragments.map((f) => ({
          kind: 'fragment' as const,
          title: f.title || 'Tanpa Judul',
          type: f.type || 'thought',
          excerpt: '',
          content: f.content || '',
          tags: f.tags || [],
        })),
      ];

      const res = await requestProjectOutline({
        projectTitle: project.title,
        projectDescription: project.description,
        existingSections: sections.map((s) => ({
          title: s.title,
          hasContent: sectionHasWrittenContent(s),
        })),
        materials: materialsPayload,
        userGuidance: guidance.trim() || undefined,
      });

      setResult(res);
      setItems(
        res.sections.map((sec, idx) => ({
          id: `outline-${Date.now()}-${idx}`,
          selected: true,
          title: sec.title,
          summary: sec.summary,
          materialRefs: sec.materialRefs || [],
        }))
      );
    } catch (err: any) {
      setError(err?.message || 'Gagal menyusun kerangka project.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedItems = items.filter((item) => item.selected && item.title.trim().length > 0);

  const handleApply = () => {
    if (selectedItems.length === 0) return;
    const formatted = selectedItems.map((item) => ({
      title: item.title.trim(),
      initialContent:
        includeGuidanceInBody && item.summary.trim()
          ? `<p><em>Panduan: ${escapeHtml(item.summary.trim())}</em></p><p></p>`
          : '<p></p>',
    }));
    onApplyOutline(formatted, !hasAnyWrittenSection && replaceEmpty);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl bg-[#FAF7F2] dark:bg-[#1E1C1A] border-t sm:border border-[#E8E2D8] dark:border-[#2F2B28] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center shrink-0">
              <Sparkles size={14} />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] truncate">
                AI Susun Kerangka
              </h3>
              <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] truncate">
                Rancang struktur bab dari tujuan project &amp; {totalMaterials} bahan tertaut.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Context summary */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] space-y-1.5">
            <div className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] line-clamp-1">
              {project.title}
            </div>
            {project.description?.trim() ? (
              <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] line-clamp-2 leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-[11px] italic text-[#9C9388] dark:text-[#736C62]">
                Tujuan project belum diisi — mengisi tujuan di Pengaturan membantu hasil kerangka lebih tajam.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] font-mono text-[#9C9388] dark:text-[#736C62]">
              <span className="inline-flex items-center gap-1">
                <BookOpen size={11} />
                <span>{linkedNotes.length} Catatan</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Feather size={11} />
                <span>{linkedFragments.length} Fragments</span>
              </span>
            </div>
          </div>

          {/* Optional user guidance */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
              Arahan Struktur (Opsional)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Misal: Esai argumentatif 5 bagian, atau format laporan riset..."
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyusun...</span>
                  </>
                ) : result ? (
                  <>
                    <RefreshCw size={13} />
                    <span>Susun Ulang</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Susun Kerangka</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50/90 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results */}
          {result && items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-[#F5EFEB] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#332F2C]">
                <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] leading-relaxed">
                  {result.strategyNote || 'AI mengusulkan susunan bagian berikut. Kamu bisa centang atau ubah judul sebelum diterapkan.'}
                </p>
                {(result.aiTrace || result.modelUsed) && (
                  <div className="shrink-0">
                    <AiProcessBadge
                      featureName="AI Susun Kerangka"
                      modelUsed={result.modelUsed}
                      fallbackUsed={result.fallbackUsed}
                      aiTrace={result.aiTrace}
                      overlayKey="project-outline-ai-trace"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-colors space-y-1.5 ${
                      item.selected
                        ? 'bg-white dark:bg-[#221F1E] border-[#9A3412]/50 dark:border-[#EA580C]/50'
                        : 'bg-[#F5EFEB]/50 dark:bg-[#1A1817] border-[#E8E2D8] dark:border-[#2F2B28] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, selected: !row.selected } : row
                            )
                          )
                        }
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          item.selected
                            ? 'bg-[#9A3412] dark:bg-[#EA580C] border-[#9A3412] dark:border-[#EA580C] text-white'
                            : 'border-[#9C9388] bg-transparent'
                        }`}
                        aria-label={`Pilih bagian ${idx + 1}`}
                      >
                        {item.selected && <Check size={11} strokeWidth={2.5} />}
                      </button>

                      <span className="text-[10px] font-mono text-[#9C9388] shrink-0">
                        {idx + 1}.
                      </span>

                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, title: e.target.value } : row
                            )
                          )
                        }
                        className="flex-1 min-w-0 text-xs sm:text-sm font-serif font-medium bg-transparent text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none border-b border-transparent focus:border-[#9A3412] dark:focus:border-[#EA580C]"
                      />
                    </div>

                    {item.summary && (
                      <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] pl-6 leading-relaxed">
                        {item.summary}
                      </p>
                    )}

                    {item.materialRefs.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-6 pt-0.5">
                        {item.materialRefs.map((refTitle) => (
                          <span
                            key={refTitle}
                            className="px-1.5 py-0.5 rounded bg-[#F5EFEB] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#332F2C] text-[10px] text-[#6B635B] dark:text-[#A8A196] max-w-[200px] truncate"
                          >
                            {refTitle}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Apply Options */}
              <div className="pt-1 space-y-2 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
                <label className="flex items-center gap-2 text-xs text-[#6B635B] dark:text-[#A8A196] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeGuidanceInBody}
                    onChange={(e) => setIncludeGuidanceInBody(e.target.checked)}
                    className="rounded border-[#D6CEBE] text-[#9A3412] focus:ring-[#9A3412]"
                  />
                  <span>Sisipkan ringkasan panduan di awal isi tiap bagian</span>
                </label>

                {!hasAnyWrittenSection && sections.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-[#6B635B] dark:text-[#A8A196] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={replaceEmpty}
                      onChange={(e) => setReplaceEmpty(e.target.checked)}
                      className="rounded border-[#D6CEBE] text-[#9A3412] focus:ring-[#9A3412]"
                    />
                    <span>Gantikan bagian kosong awal ({sections[0]?.title || 'Draf Utama'})</span>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-5 border-t border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-end gap-2 shrink-0 bg-[#FAF7F2] dark:bg-[#1E1C1A]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs text-[#6B635B] dark:text-[#A8A196] hover:underline"
          >
            Batal
          </button>
          {result && (
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedItems.length === 0}
              className="px-4 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-45 transition-colors flex items-center gap-1.5"
            >
              <Plus size={13} />
              <span>Terapkan {selectedItems.length} Bagian</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
