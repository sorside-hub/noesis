import React, { useMemo, useState } from 'react';
import { Project, ProjectSection } from '../../types';
import {
  compileProjectMasterMarkdown,
  compileProjectMasterPlainText,
  countProjectTotalWords,
  countWordsFromContent,
  getSortedProjectSections,
  sectionHasWrittenContent,
} from '../../lib/projectMaster';
import { ProjectSectionEditor } from './ProjectSectionEditor';
import {
  Copy,
  Check,
  Download,
  BookMarked,
  Edit3,
  FileText,
  Layers,
  CheckCircle2,
  Circle,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface ProjectMasterViewProps {
  project: Project;
  onUpdateSection: (
    projectId: string,
    sectionId: string,
    updates: Partial<Pick<ProjectSection, 'title' | 'content' | 'status' | 'order'>>
  ) => void;
  onToggleSectionStatus: (projectId: string, sectionId: string) => void;
  onFlushSave: (projectId: string) => void;
  onSaveCopyToLibrary: () => string | null;
  onOpenLibraryNote?: (noteId: string) => void;
  onSwitchToStudio?: () => void;
  onAddFirstSection?: () => void;
}

export const ProjectMasterView: React.FC<ProjectMasterViewProps> = ({
  project,
  onUpdateSection,
  onToggleSectionStatus,
  onFlushSave,
  onSaveCopyToLibrary,
  onOpenLibraryNote,
  onSwitchToStudio,
  onAddFirstSection,
}) => {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [copiedPlain, setCopiedPlain] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  const sortedSections = useMemo(() => getSortedProjectSections(project), [project]);
  const totalWords = useMemo(() => countProjectTotalWords(project), [project]);

  const handleCopyPlainText = async () => {
    const text = compileProjectMasterPlainText(project);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPlain(true);
      setTimeout(() => setCopiedPlain(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleDownloadMarkdown = () => {
    const md = compileProjectMasterMarkdown(project);
    const slug = (project.title || 'noesis-project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'master-karya'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveToLibrary = () => {
    const noteId = onSaveCopyToLibrary();
    if (noteId) {
      setSavedNoteId(noteId);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-6">
      <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
        {/* Top Master Action & Export Bar */}
        <div className="bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#9A3412] dark:text-[#EA580C] font-medium">
              <FileText size={11} />
              <span>Master Utuh</span>
            </span>
            <span>
              {sortedSections.length} bagian · {totalWords.toLocaleString()} kata
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onSwitchToStudio && (
              <button
                type="button"
                onClick={onSwitchToStudio}
                className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-[11px] font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] flex items-center gap-1 transition-colors"
              >
                <Layers size={12} />
                <span>Edit di Studio</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyPlainText}
              disabled={sortedSections.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[11px] font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              {copiedPlain ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>{copiedPlain ? 'Tersalin!' : 'Salin Lengkap'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              disabled={sortedSections.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[11px] font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <Download size={12} />
              <span>Unduh .md</span>
            </button>

            <button
              type="button"
              onClick={handleSaveToLibrary}
              disabled={sortedSections.length === 0}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#9A3412] dark:bg-[#EA580C] text-white text-[11px] font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-40 flex items-center gap-1 transition-colors shadow-2xs"
            >
              <BookMarked size={12} />
              <span>Simpan ke Library</span>
            </button>
          </div>
        </div>

        {/* Saved Copy Confirmation Banner */}
        {savedNoteId && (
          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Salinan Master berhasil disimpan sebagai catatan mandiri di Library.</span>
            </span>
            {onOpenLibraryNote && (
              <button
                type="button"
                onClick={() => onOpenLibraryNote(savedNoteId)}
                className="px-2.5 py-1 rounded-lg bg-emerald-700 dark:bg-emerald-600 text-white text-[11px] font-medium hover:opacity-90 flex items-center gap-1"
              >
                <span>Buka di Library</span>
                <ExternalLink size={11} />
              </button>
            )}
          </div>
        )}

        {/* Seamless Master Document Paper */}
        <article className="bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl sm:rounded-2xl p-3.5 sm:p-8 lg:p-10 shadow-xs space-y-6">
          <header className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-4 sm:pb-6 space-y-2">
            <h1 className="font-serif text-2xl sm:text-4xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
              {project.title}
            </h1>
            {project.description?.trim() && (
              <p className="text-xs sm:text-sm italic text-[#6B635B] dark:text-[#A8A196] leading-relaxed">
                {project.description}
              </p>
            )}
            <p className="text-[11px] text-[#9C9388] dark:text-[#736C62] font-mono pt-1">
              Klik tombol Edit pada bagian mana saja untuk menyempurnakan tulisan langsung di tempat.
            </p>
          </header>

          {sortedSections.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196]">
                Belum ada bagian atau bab yang ditulis pada project ini.
              </p>
              {onAddFirstSection && (
                <button
                  type="button"
                  onClick={onAddFirstSection}
                  className="px-4 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Tambah Bagian Pertama</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {sortedSections.map((sec, index) => {
                const isEditingHere = editingSectionId === sec.id;
                const hasBody = sectionHasWrittenContent(sec);
                const secWords = countWordsFromContent(sec.content || '');
                const isDone = sec.status === 'done';

                if (isEditingHere) {
                  const prevSec = index > 0 ? sortedSections[index - 1] : undefined;
                  return (
                    <section key={sec.id} className="scroll-mt-4">
                      <ProjectSectionEditor
                        projectId={project.id}
                        section={sec}
                        onUpdateSection={onUpdateSection}
                        onToggleStatus={onToggleSectionStatus}
                        onFlushSave={onFlushSave}
                        inlineMaster
                        projectTitle={project.title}
                        previousSectionSnippet={prevSec?.content}
                        onDone={() => setEditingSectionId(null)}
                      />
                    </section>
                  );
                }

                return (
                  <section
                    key={sec.id}
                    className="group relative rounded-xl border border-transparent hover:border-[#E8E2D8] dark:hover:border-[#2F2B28] hover:bg-[#FAF7F2]/40 dark:hover:bg-[#221F1E]/30 transition-colors p-2 sm:p-3 -mx-2 sm:-mx-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-0.5">
                          <span>Bagian {index + 1}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            {isDone ? (
                              <CheckCircle2
                                size={10}
                                className="text-emerald-600 dark:text-emerald-400"
                              />
                            ) : (
                              <Circle size={10} />
                            )}
                            <span>{isDone ? 'Selesai' : 'Draf'}</span>
                          </span>
                          <span>·</span>
                          <span>{secWords.toLocaleString()} kata</span>
                        </div>
                        <h2
                          onClick={() => setEditingSectionId(sec.id)}
                          className="font-serif text-xl sm:text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] cursor-pointer hover:text-[#9A3412] dark:hover:text-[#EA580C] transition-colors"
                        >
                          {sec.title || `Bagian ${index + 1}`}
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingSectionId(sec.id)}
                        className="px-2.5 py-1 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[11px] font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#9A3412] dark:hover:text-[#EA580C] hover:border-[#9A3412] flex items-center gap-1 shrink-0 sm:opacity-70 sm:group-hover:opacity-100 transition-all"
                      >
                        <Edit3 size={11} />
                        <span>Edit</span>
                      </button>
                    </div>

                    {hasBody ? (
                      <div
                        onDoubleClick={() => setEditingSectionId(sec.id)}
                        className="tiptap text-[15px] sm:text-[16px] leading-[1.8] text-[#292524] dark:text-[#E7E5E4]"
                        dangerouslySetInnerHTML={{ __html: sec.content }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingSectionId(sec.id)}
                        className="text-xs italic text-[#9C9388] dark:text-[#736C62] hover:text-[#9A3412] dark:hover:text-[#EA580C] py-2 block text-left"
                      >
                        (Bagian ini masih kosong — klik untuk mulai menulis)
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </div>
  );
};
