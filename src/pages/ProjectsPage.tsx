import React, { useState, useMemo, useEffect } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { useBackOverlay } from '../hooks/useBackOverlay';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import {
  Note,
  Fragment,
  Project,
  ProjectStatus,
  ProjectSection,
  DiscoverSourceItem,
} from '../types';
import {
  noteToDiscoverItem,
  fragmentToDiscoverItem,
} from '../lib/discoverAi';
import {
  countProjectTotalWords,
  countWordsFromContent,
  getSortedProjectSections,
  projectHasWrittenContent,
  sectionHasWrittenContent,
} from '../lib/projectMaster';
import { cleanTextForEmbedding } from '../lib/cloudflareEmbedding';
import { sanitizeAndNormalizeHtml } from '../lib/tiptapClipboard';
import {
  ProjectMaterialReader,
  ProjectSelectedMaterial,
} from '../components/projects/ProjectMaterialReader';
import { ProjectSectionEditor } from '../components/projects/ProjectSectionEditor';
import { ProjectMasterView } from '../components/projects/ProjectMasterView';
import {
  ProjectFormModal,
  LinkMaterialsModal,
} from '../components/projects/ProjectModals';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import {
  FolderKanban,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  BookOpen,
  Feather,
  Sparkles,
  ArrowLeft,
  Settings2,
  Trash2,
  Search,
  Link2,
  FilePlus2,
  Layers,
  Target,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  FileText,
  Library,
  PenLine,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';

const STATUS_META: Record<
  ProjectStatus,
  { label: string; badgeClass: string }
> = {
  active: {
    label: 'Aktif',
    badgeClass:
      'text-[#9A3412] dark:text-[#EA580C] bg-[#FED7AA]/30 dark:bg-[#431407]/50 border-[#FED7AA] dark:border-[#7C2D12]',
  },
  review: {
    label: 'Meninjau',
    badgeClass:
      'text-[#B45309] dark:text-[#F59E0B] bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
  },
  completed: {
    label: 'Selesai',
    badgeClass:
      'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
  },
  archived: {
    label: 'Arsip',
    badgeClass:
      'text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700',
  },
};

const escapeHtmlText = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const buildInsertHtmlFromMaterial = (selected: ProjectSelectedMaterial): string => {
  if (selected.kind === 'note') {
    const body = sanitizeAndNormalizeHtml(selected.item.content || '', {
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    }).trim();
    if (body) return `${body}<p></p>`;
    return `<p>${escapeHtmlText(selected.item.title || 'Catatan')}</p>`;
  }

  const lines = (selected.item.content || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${escapeHtmlText(l)}</p>`)
    .join('');
  const titleLabel = selected.item.title ? `<p><em>— ${escapeHtmlText(selected.item.title)}</em></p>` : '';
  return `<blockquote>${lines || '<p></p>'}${titleLabel}</blockquote><p></p>`;
};

export const ProjectsPage: React.FC = () => {
  const scrollRef = useScrollRestoration<HTMLDivElement>('projects');
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    projectsTableMissing,
    createProject,
    updateProject,
    deleteProject,
    flushProjectSave,
    addProjectSection,
    updateProjectSection,
    deleteProjectSection,
    moveProjectSection,
    toggleProjectSectionStatus,
    convertMilestonesToSections,
    saveProjectMasterCopyToLibrary,
    linkItemToProject,
    unlinkItemFromProject,
    notes,
    fragments,
    createNote,
    setActiveNoteId,
    setActiveView,
    openFragmentDrawer,
    sendToDiscoverSynthesis,
  } = useNoesis();

  // Top-level Switcher: Studio Kerja vs Katalog Karya (Master)
  const [topTab, setTopTab] = useState<'studio' | 'catalog'>('studio');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Workspace Mode: Studio (write sections + side references) vs Master Utuh
  const [detailMode, setDetailMode] = useState<'studio' | 'master'>('studio');
  const [returnTabAfterDetail, setReturnTabAfterDetail] = useState<'studio' | 'catalog'>('studio');

  // Desktop Left Panel States
  const [desktopLeftTab, setDesktopLeftTab] = useState<'sections' | 'references'>('sections');
  const [desktopRefReaderKey, setDesktopRefReaderKey] = useState<{
    kind: 'note' | 'fragment';
    id: string;
  } | null>(null);

  // Active Section in Studio
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  // Mobile Detail States
  const [mobileDetailTab, setMobileDetailTab] = useState<'sections' | 'references' | 'master'>(
    'sections'
  );
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const [showMobileQuickRefSheet, setShowMobileQuickRefSheet] = useState(false);
  const [mobileQuickRefReaderKey, setMobileQuickRefReaderKey] = useState<{
    kind: 'note' | 'fragment';
    id: string;
  } | null>(null);
  const [mobileRefReaderKey, setMobileRefReaderKey] = useState<{
    kind: 'note' | 'fragment';
    id: string;
  } | null>(null);

  // Insert-to-section signal & toast
  const [insertRequest, setInsertRequest] = useState<{ nonce: number; html: string } | null>(null);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  // Modals & Popovers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Back-button overlays
  useBackOverlay(showCreateModal, () => setShowCreateModal(false), 'projects-create-modal');
  useBackOverlay(Boolean(editingProject), () => setEditingProject(null), 'projects-edit-modal');
  useBackOverlay(showLinkPicker, () => setShowLinkPicker(false), 'projects-link-modal');
  useBackOverlay(Boolean(projectToDelete), () => setProjectToDelete(null), 'projects-delete-modal');
  useBackOverlay(showStatusMenu, () => setShowStatusMenu(false), 'projects-status-menu');
  useBackOverlay(
    Boolean(mobileRefReaderKey),
    () => setMobileRefReaderKey(null),
    'projects-mobile-reader'
  );
  useBackOverlay(
    isMobileEditorOpen,
    () => {
      if (activeProjectId) flushProjectSave(activeProjectId);
      setIsMobileEditorOpen(false);
      setShowMobileQuickRefSheet(false);
      setMobileQuickRefReaderKey(null);
    },
    'projects-mobile-editor'
  );
  useBackOverlay(
    showMobileQuickRefSheet,
    () => {
      setShowMobileQuickRefSheet(false);
      setMobileQuickRefReaderKey(null);
    },
    'projects-mobile-quick-ref'
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const sortedSections = useMemo(
    () => (activeProject ? getSortedProjectSections(activeProject) : []),
    [activeProject]
  );

  const activeSection = useMemo<ProjectSection | null>(() => {
    if (sortedSections.length === 0) return null;
    if (activeSectionId) {
      const found = sortedSections.find((s) => s.id === activeSectionId);
      if (found) return found;
    }
    return sortedSections[0];
  }, [sortedSections, activeSectionId]);

  // Reset ephemeral workspace UI when switching active project
  useEffect(() => {
    setDesktopLeftTab('sections');
    setDesktopRefReaderKey(null);
    setMobileRefReaderKey(null);
    setMobileQuickRefReaderKey(null);
    setShowMobileQuickRefSheet(false);
    setIsMobileEditorOpen(false);
    setNewSectionTitle('');
    setShowStatusMenu(false);
    if (activeProject) {
      const first = getSortedProjectSections(activeProject)[0];
      setActiveSectionId(first ? first.id : null);
    } else {
      setActiveSectionId(null);
    }
  }, [activeProjectId]);

  // Keep activeSectionId valid when sections change
  useEffect(() => {
    if (!activeProject) return;
    if (sortedSections.length === 0) {
      if (activeSectionId !== null) setActiveSectionId(null);
      return;
    }
    if (!activeSectionId || !sortedSections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(sortedSections[0].id);
    }
  }, [activeProject, sortedSections, activeSectionId]);

  // Helper: live word count for project (from sections)
  const getProjectWords = (proj: Project): number => countProjectTotalWords(proj);

  // Filtered Projects for Studio Kerja list
  const filteredStudioProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter === 'all') {
        if (p.status === 'archived') return false;
      } else if (p.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    });
  }, [projects, statusFilter, searchQuery]);

  // Katalog Karya Projects (projects that actually have written text in sections)
  const catalogProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects
      .filter((p) => {
        if (p.status === 'archived') return false;
        if (!projectHasWrittenContent(p)) return false;
        if (catalogFilter === 'completed' && p.status !== 'completed') return false;
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Completed works first, then newest updated
        const aDone = a.status === 'completed' ? 1 : 0;
        const bDone = b.status === 'completed' ? 1 : 0;
        if (aDone !== bDone) return bDone - aDone;
        return (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0);
      });
  }, [projects, catalogFilter, searchQuery]);

  // Linked References for Active Project
  const { linkedNotes, linkedFragments } = useMemo(() => {
    if (!activeProject) {
      return { linkedNotes: [] as Note[], linkedFragments: [] as Fragment[] };
    }
    const noteIdSet = new Set(activeProject.noteIds || []);
    const fragIdSet = new Set(activeProject.fragmentIds || []);
    return {
      linkedNotes: notes.filter((n) => !n.archived && noteIdSet.has(n.id)),
      linkedFragments: fragments.filter((f) => fragIdSet.has(f.id)),
    };
  }, [activeProject, notes, fragments]);

  const resolveMaterial = (
    key: { kind: 'note' | 'fragment'; id: string } | null
  ): ProjectSelectedMaterial | null => {
    if (!key) return null;
    if (key.kind === 'note') {
      const n = linkedNotes.find((item) => item.id === key.id);
      return n ? { kind: 'note', item: n } : null;
    }
    const f = linkedFragments.find((item) => item.id === key.id);
    return f ? { kind: 'fragment', item: f } : null;
  };

  const desktopRefReaderMaterial = resolveMaterial(desktopRefReaderKey);
  const mobileRefReaderMaterial = resolveMaterial(mobileRefReaderKey);
  const mobileQuickRefMaterial = resolveMaterial(mobileQuickRefReaderKey);

  const showTempNotice = (msg: string) => {
    setStudioNotice(msg);
    setTimeout(() => {
      setStudioNotice((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const openProjectInMode = (projectId: string, mode: 'studio' | 'master', sourceTab: 'studio' | 'catalog') => {
    setReturnTabAfterDetail(sourceTab);
    setDetailMode(mode);
    setMobileDetailTab(mode === 'master' ? 'master' : 'sections');
    setActiveProjectId(projectId);
  };

  const handleExitProjectDetail = () => {
    if (activeProject) {
      flushProjectSave(activeProject.id);
    }
    setTopTab(returnTabAfterDetail);
    setActiveProjectId(null);
  };

  const handleEditMaterialInOrigin = (kind: 'note' | 'fragment', id: string) => {
    if (activeProject) flushProjectSave(activeProject.id);
    setMobileRefReaderKey(null);
    setShowMobileQuickRefSheet(false);
    setMobileQuickRefReaderKey(null);
    if (kind === 'note') {
      setActiveNoteId(id);
      setActiveView('editor');
    } else {
      openFragmentDrawer(id);
    }
  };

  const handleCreateNoteInsideProject = () => {
    if (!activeProject) return;
    flushProjectSave(activeProject.id);
    const newNoteId = createNote('thought');
    linkItemToProject(activeProject.id, 'note', newNoteId);
    setActiveNoteId(newNoteId);
    setActiveView('editor');
  };

  const handleSendProjectToSynthesis = () => {
    if (!activeProject) return;
    const discoverItems: DiscoverSourceItem[] = [
      ...linkedNotes.map((n) => noteToDiscoverItem(n)),
      ...linkedFragments.map((f) => fragmentToDiscoverItem(f)),
    ];
    if (discoverItems.length < 2) return;
    flushProjectSave(activeProject.id);
    sendToDiscoverSynthesis(discoverItems, activeProject.title);
  };

  const handleAddSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    const title = newSectionTitle.trim() || `Bagian ${sortedSections.length + 1}`;
    const newSecId = addProjectSection(activeProject.id, title);
    setNewSectionTitle('');
    if (newSecId) {
      setActiveSectionId(newSecId);
    }
  };

  const handleInsertMaterialToActiveSection = (selected: ProjectSelectedMaterial) => {
    if (!activeProject) return;
    const htmlToInsert = buildInsertHtmlFromMaterial(selected);

    if (!activeSection) {
      const newSecId = addProjectSection(activeProject.id, 'Draf Utama', htmlToInsert);
      if (newSecId) setActiveSectionId(newSecId);
      showTempNotice(`"${selected.item.title || 'Bahan'}" disisipkan ke Draf Utama.`);
      return;
    }

    // If editor canvas is currently active (Desktop studio split OR Mobile editor sheet), insert directly into Tiptap cursor
    const isEditorMounted =
      (detailMode === 'studio' && window.innerWidth >= 1024) || isMobileEditorOpen;

    if (isEditorMounted) {
      setInsertRequest({ nonce: Date.now(), html: htmlToInsert });
      setShowMobileQuickRefSheet(false);
      setMobileQuickRefReaderKey(null);
      showTempNotice(`"${selected.item.title || 'Bahan'}" disisipkan ke "${activeSection.title}".`);
    } else {
      const existing = (activeSection.content || '').trim();
      const base = existing === '<p></p>' ? '' : existing;
      updateProjectSection(activeProject.id, activeSection.id, {
        content: `${base}${htmlToInsert}`,
      });
      flushProjectSave(activeProject.id);
      setMobileRefReaderKey(null);
      showTempNotice(`"${selected.item.title || 'Bahan'}" disisipkan ke "${activeSection.title}".`);
    }
  };

  const SupabaseProjectsBanner = () => {
    if (!projectsTableMissing) return null;
    return (
      <div className="p-3 sm:p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
          <span>
            Tabel <strong>projects</strong> perlu SQL schema terbaru di Supabase agar semua bagian tulisan tersinkron antar perangkat. Salin & jalankan ulang SQL Schema di <strong>Settings → Database</strong>.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('settings')}
          className="px-3 py-1.5 rounded-lg bg-amber-700 dark:bg-amber-600 text-white text-[11px] font-medium hover:opacity-90 shrink-0 self-start sm:self-auto"
        >
          Buka Settings
        </button>
      </div>
    );
  };

  // ============================================================================
  // DETAIL WORKSPACE (STUDIO KERJA + SEAMLESS MASTER)
  // ============================================================================
  if (activeProject) {
    const statusMeta = STATUS_META[activeProject.status] || STATUS_META.active;
    const totalSections = sortedSections.length;
    const doneSections = sortedSections.filter((s) => s.status === 'done').length;
    const totalLinkedCount = linkedNotes.length + linkedFragments.length;
    const totalWords = getProjectWords(activeProject);
    const wordPercent =
      activeProject.enableWordGoal && activeProject.targetWordCount > 0
        ? Math.min(100, Math.round((totalWords / activeProject.targetWordCount) * 100))
        : 0;

    // Legacy Milestone Migration Helper Card (only when a legacy project has milestones & 0 sections)
    const renderLegacyMilestoneBanner = () => {
      if (sortedSections.length > 0 || (activeProject.milestones || []).length === 0) return null;
      return (
        <div className="p-3 rounded-xl bg-[#F5EFEB] dark:bg-[#221F1E] border border-[#D6CEBE] dark:border-[#332F2C] space-y-2">
          <p className="text-xs text-[#221F1D] dark:text-[#EDE8E1] leading-relaxed">
            Project ini memiliki <strong>{activeProject.milestones.length} langkah checklist</strong> dari versi sebelumnya. Ubah jadi bagian tulisan agar bisa langsung diisi?
          </p>
          <button
            type="button"
            onClick={() => convertMilestonesToSections(activeProject.id)}
            className="w-full py-2 px-3 rounded-lg bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] transition-colors"
          >
            Ubah Checklist Jadi Bagian Tulisan
          </button>
        </div>
      );
    };

    // Sections List Component (shared between Desktop Left Tab & Mobile Susunan Tab)
    const renderSectionsList = (mode: 'desktop' | 'mobile') => (
      <div
        className={`bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] ${
          mode === 'mobile' ? 'rounded-xl p-3 space-y-2.5' : 'rounded-2xl p-3.5 space-y-3'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
            Susunan Bagian ({doneSections}/{totalSections})
          </h3>
          <span className="text-[11px] font-mono font-medium text-[#9A3412] dark:text-[#EA580C]">
            {activeProject.progress}%
          </span>
        </div>

        {/* Inline Add Section */}
        <form onSubmit={handleAddSectionSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            placeholder="+ Tambah bagian atau bab..."
            className="flex-1 min-w-0 text-xs px-2.5 py-2 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
          />
          <button
            type="submit"
            className="px-2.5 py-2 rounded-lg bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] transition-colors shrink-0"
            title="Tambah Bagian"
          >
            <Plus size={14} />
          </button>
        </form>

        {renderLegacyMilestoneBanner()}

        {sortedSections.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-xs text-[#9C9388] dark:text-[#736C62]">
              Belum ada bagian tulisan. Tambahkan bab/bagian pertamamu di atas.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedSections.map((sec, idx) => {
              const isSelected = mode === 'desktop' && activeSection?.id === sec.id;
              const isDone = sec.status === 'done';
              const secWords = countWordsFromContent(sec.content || '');
              const hasText = sectionHasWrittenContent(sec);

              return (
                <div
                  key={sec.id}
                  onClick={() => {
                    setActiveSectionId(sec.id);
                    if (mode === 'mobile') {
                      setIsMobileEditorOpen(true);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveSectionId(sec.id);
                      if (mode === 'mobile') setIsMobileEditorOpen(true);
                    }
                  }}
                  className={`group p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2 ${
                    isSelected
                      ? 'bg-[#FAF7F2] dark:bg-[#272422] border-[#9A3412] dark:border-[#EA580C] shadow-2xs'
                      : 'bg-white dark:bg-[#221F1E]/60 border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#9A3412]/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProjectSectionStatus(activeProject.id, sec.id);
                    }}
                    className="mt-0.5 shrink-0"
                    aria-label={isDone ? 'Tandai masih draf' : 'Tandai bagian selesai'}
                    title={isDone ? 'Selesai (klik untuk ubah ke Draf)' : 'Draf (klik untuk tandai Selesai)'}
                  >
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle size={16} className="text-[#9C9388]" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono uppercase text-[#9C9388] dark:text-[#736C62]">
                        Bagian {idx + 1} · {secWords.toLocaleString()} kata
                      </span>
                      {mode === 'mobile' && (
                        <ChevronRight size={13} className="text-[#9C9388] shrink-0" />
                      )}
                    </div>
                    <h4
                      className={`font-serif text-sm font-medium line-clamp-1 ${
                        isSelected
                          ? 'text-[#9A3412] dark:text-[#EA580C]'
                          : 'text-[#221F1D] dark:text-[#EDE8E1]'
                      }`}
                    >
                      {sec.title || `Bagian ${idx + 1}`}
                    </h4>
                    {!hasText && (
                      <span className="text-[11px] italic text-[#9C9388]">
                        Masih kosong — ketuk untuk menulis
                      </span>
                    )}
                  </div>

                  {/* Reorder / Delete actions */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-0.5 shrink-0 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveProjectSection(activeProject.id, sec.id, 'up')}
                      aria-label="Naikkan urutan"
                      className="p-1 rounded text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] disabled:opacity-25"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sortedSections.length - 1}
                      onClick={() => moveProjectSection(activeProject.id, sec.id, 'down')}
                      aria-label="Turunkan urutan"
                      className="p-1 rounded text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] disabled:opacity-25"
                    >
                      <ArrowDown size={12} />
                    </button>
                    {sortedSections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteProjectSection(activeProject.id, sec.id)}
                        aria-label="Hapus bagian"
                        className="p-1 rounded text-[#9C9388] hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

    // References List Component (Desktop Left Referensi Tab / Mobile Referensi Tab / Mobile Quick Peek)
    const renderReferencesList = (
      onSelectItem: (kind: 'note' | 'fragment', id: string) => void,
      compact = false,
      allowManagement = true
    ) => (
      <div
        className={`bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] ${
          compact ? 'rounded-xl p-3 space-y-2.5' : 'rounded-2xl p-3.5 space-y-3'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
            Bahan Referensi ({totalLinkedCount})
          </h3>
          {allowManagement && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowLinkPicker(true)}
                className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-[11px] font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] flex items-center gap-1 transition-colors"
              >
                <Link2 size={12} />
                <span>Tautkan</span>
              </button>
              <button
                type="button"
                onClick={handleCreateNoteInsideProject}
                className="px-2.5 py-1.5 rounded-lg bg-[#9A3412] dark:bg-[#EA580C] text-white text-[11px] font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] flex items-center gap-1 transition-colors"
              >
                <FilePlus2 size={12} />
                <span>Catatan</span>
              </button>
            </div>
          )}
        </div>

        {totalLinkedCount === 0 ? (
          <div className="py-5 px-3 text-center rounded-xl border border-dashed border-[#D6CEBE] dark:border-[#332F2C] bg-[#FAF7F2]/60 dark:bg-[#151413]/40 space-y-2">
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
              Belum ada Catatan, Synthesis, atau Fragment yang ditautkan sebagai referensi.
            </p>
            {allowManagement && (
              <button
                type="button"
                onClick={() => setShowLinkPicker(true)}
                className="text-xs font-medium text-[#9A3412] dark:text-[#EA580C] hover:underline"
              >
                + Pilih bahan dari Library & Fragments
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {linkedNotes.map((note) => {
              const isSynthesis = note.type === 'synthesis';
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelectItem('note', note.id)}
                  className="w-full text-left p-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E]/60 hover:border-[#9A3412]/60 dark:hover:border-[#EA580C]/60 transition-all flex items-start gap-2.5"
                >
                  <div
                    className={`mt-0.5 shrink-0 ${
                      isSynthesis
                        ? 'text-[#9A3412] dark:text-[#EA580C]'
                        : 'text-[#6B635B] dark:text-[#A8A196]'
                    }`}
                  >
                    {isSynthesis ? <Sparkles size={14} /> : <BookOpen size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono uppercase text-[#9C9388]">
                      {isSynthesis ? 'Synthesis' : `Catatan · ${note.type}`}
                    </span>
                    <h4 className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] line-clamp-1">
                      {note.title || 'Tanpa Judul'}
                    </h4>
                    {note.excerpt && (
                      <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] line-clamp-1 mt-0.5">
                        {note.excerpt}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-[#9C9388] shrink-0 self-center" />
                </button>
              );
            })}

            {linkedFragments.map((frag) => (
              <button
                key={frag.id}
                type="button"
                onClick={() => onSelectItem('fragment', frag.id)}
                className="w-full text-left p-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E]/60 hover:border-[#9A3412]/60 dark:hover:border-[#EA580C]/60 transition-all flex items-start gap-2.5"
              >
                <div className="mt-0.5 shrink-0 text-[#9A3412] dark:text-[#EA580C]">
                  <Feather size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono uppercase text-[#9C9388]">
                    Fragment · {frag.type}
                  </span>
                  <h4 className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] line-clamp-1">
                    {frag.title || 'Tanpa Judul'}
                  </h4>
                  {frag.content && (
                    <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] line-clamp-1 mt-0.5">
                      {frag.content}
                    </p>
                  )}
                </div>
                <ChevronRight size={14} className="text-[#9C9388] shrink-0 self-center" />
              </button>
            ))}
          </div>
        )}

        {allowManagement && totalLinkedCount >= 2 && (
          <button
            type="button"
            onClick={handleSendProjectToSynthesis}
            className="w-full py-2.5 px-3 rounded-xl border border-[#9A3412]/35 dark:border-[#EA580C]/35 bg-[#FAF7F2] dark:bg-[#272422] text-xs font-medium text-[#9A3412] dark:text-[#EA580C] hover:bg-[#9A3412]/10 dark:hover:bg-[#EA580C]/15 transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} />
            <span>Bawa Bahan ke Synthesis</span>
          </button>
        )}
      </div>
    );

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF7F2] dark:bg-[#151413] relative">
        {/* Toast Notice */}
        {studioNotice && (
          <div className="fixed top-4 right-4 z-50 px-3.5 py-2 rounded-xl bg-[#221F1D] dark:bg-[#EDE8E1] text-white dark:text-[#151413] text-xs font-medium shadow-lg animate-in fade-in duration-150">
            {studioNotice}
          </div>
        )}

        {/* Top Project Workspace Header */}
        <div className="shrink-0 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3">
          <div className="max-w-7xl mx-auto flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  type="button"
                  onClick={handleExitProjectDetail}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] flex items-center gap-1 shrink-0 transition-colors"
                >
                  <ArrowLeft size={13} />
                  <span className="hidden sm:inline">
                    {returnTabAfterDetail === 'catalog' ? 'Katalog Karya' : 'Studio Kerja'}
                  </span>
                </button>

                {/* Quick Status Switcher Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStatusMenu((prev) => !prev)}
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-md border shrink-0 flex items-center gap-1 ${statusMeta.badgeClass}`}
                    title="Ubah status project"
                  >
                    <span>{statusMeta.label}</span>
                    <ChevronDown size={10} />
                  </button>

                  {showStatusMenu && (
                    <div className="absolute left-0 top-full mt-1 w-36 bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl shadow-lg py-1 z-40">
                      {(
                        [
                          { id: 'active', label: 'Aktif' },
                          { id: 'review', label: 'Meninjau' },
                          { id: 'completed', label: 'Selesai' },
                          { id: 'archived', label: 'Arsip' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateProject(activeProject.id, { status: opt.id });
                            setShowStatusMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#FAF7F2] dark:hover:bg-[#272422] ${
                            activeProject.status === opt.id
                              ? 'text-[#9A3412] dark:text-[#EA580C] font-medium'
                              : 'text-[#221F1D] dark:text-[#EDE8E1]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {activeProject.deadline && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[#9C9388] truncate">
                    <Calendar size={11} />
                    <span>{activeProject.deadline}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Desktop Studio vs Master Toggle */}
                <div className="hidden lg:flex items-center p-0.5 rounded-xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
                  <button
                    type="button"
                    onClick={() => {
                      flushProjectSave(activeProject.id);
                      setDetailMode('studio');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                      detailMode === 'studio'
                        ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                        : 'text-[#6B635B] dark:text-[#A8A196]'
                    }`}
                  >
                    <PenLine size={12} />
                    <span>Studio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      flushProjectSave(activeProject.id);
                      setDetailMode('master');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                      detailMode === 'master'
                        ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                        : 'text-[#6B635B] dark:text-[#A8A196]'
                    }`}
                  >
                    <FileText size={12} />
                    <span>Master Utuh</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingProject(activeProject)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] flex items-center gap-1 transition-colors"
                >
                  <Settings2 size={13} />
                  <span className="hidden sm:inline">Atur</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProjectToDelete(activeProject)}
                  aria-label="Hapus project"
                  className="p-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#9C9388] hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="min-w-0">
                <h1 className="font-serif text-lg sm:text-2xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] truncate">
                  {activeProject.title}
                </h1>
                {activeProject.description && (
                  <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-1">
                    {activeProject.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196] shrink-0">
                {activeProject.deadline && (
                  <span className="sm:hidden inline-flex items-center gap-1 text-[#9C9388]">
                    <Calendar size={11} />
                    <span>{activeProject.deadline}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[#9A3412] dark:text-[#EA580C]">
                  <Target size={11} />
                  <span>
                    {totalWords.toLocaleString()}
                    {activeProject.enableWordGoal && activeProject.targetWordCount > 0
                      ? ` / ${activeProject.targetWordCount.toLocaleString()} kata`
                      : ' kata'}
                  </span>
                </span>
                <span>Progres {activeProject.progress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================================
            DESKTOP BODY (lg+)
            ==================================================================== */}
        {detailMode === 'master' ? (
          <div className="hidden lg:flex flex-1 min-h-0 flex-col">
            <ProjectMasterView
              project={activeProject}
              onUpdateSection={updateProjectSection}
              onToggleSectionStatus={toggleProjectSectionStatus}
              onFlushSave={flushProjectSave}
              onSaveCopyToLibrary={() => saveProjectMasterCopyToLibrary(activeProject.id)}
              onOpenLibraryNote={(noteId) => {
                setActiveNoteId(noteId);
                setActiveView('editor');
              }}
              onSwitchToStudio={() => setDetailMode('studio')}
              onAddFirstSection={() => {
                const newId = addProjectSection(activeProject.id, 'Bagian 1');
                if (newId) setActiveSectionId(newId);
                setDetailMode('studio');
              }}
            />
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 min-h-0 max-w-7xl w-full mx-auto px-6 lg:px-8 py-4 gap-5">
            {/* Desktop Left Panel: Susunan vs Referensi (with inline reference reader!) */}
            <div className="w-[350px] xl:w-[390px] shrink-0 flex flex-col min-h-0 gap-3">
              <div className="flex items-center p-1 rounded-xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shrink-0">
                <button
                  type="button"
                  onClick={() => setDesktopLeftTab('sections')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    desktopLeftTab === 'sections'
                      ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                      : 'text-[#6B635B] dark:text-[#A8A196]'
                  }`}
                >
                  <Layers size={13} />
                  <span>Susunan ({totalSections})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDesktopLeftTab('references')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    desktopLeftTab === 'references'
                      ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                      : 'text-[#6B635B] dark:text-[#A8A196]'
                  }`}
                >
                  <BookOpen size={13} />
                  <span>Referensi ({totalLinkedCount})</span>
                </button>
              </div>

              {desktopLeftTab === 'sections' ? (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  <SupabaseProjectsBanner />

                  {/* Progress Card */}
                  <div className="bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6B635B] dark:text-[#A8A196]">
                        Progres Bagian
                      </span>
                      <span className="font-mono font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                        {activeProject.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-[#F5EFEB] dark:bg-[#272422] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#9A3412] dark:bg-[#EA580C] h-full transition-all duration-300"
                        style={{ width: `${activeProject.progress}%` }}
                      />
                    </div>
                    {activeProject.enableWordGoal && activeProject.targetWordCount > 0 && (
                      <div className="pt-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196]">
                          <span>Target Kata</span>
                          <span>
                            {totalWords.toLocaleString()} /{' '}
                            {activeProject.targetWordCount.toLocaleString()} ({wordPercent}%)
                          </span>
                        </div>
                        <div className="w-full bg-[#F5EFEB] dark:bg-[#272422] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${wordPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {renderSectionsList('desktop')}
                </div>
              ) : desktopRefReaderMaterial ? (
                <div className="flex-1 min-h-0">
                  <ProjectMaterialReader
                    selected={desktopRefReaderMaterial}
                    compact
                    onBack={() => setDesktopRefReaderKey(null)}
                    backLabel="Daftar Bahan"
                    onInsertToSection={handleInsertMaterialToActiveSection}
                    onEdit={handleEditMaterialInOrigin}
                    onUnlink={(kind, id) => {
                      unlinkItemFromProject(activeProject.id, kind, id);
                      setDesktopRefReaderKey(null);
                    }}
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {renderReferencesList(
                    (kind, id) => setDesktopRefReaderKey({ kind, id }),
                    false,
                    true
                  )}
                </div>
              )}
            </div>

            {/* Desktop Right Panel: Shared Noesis Tiptap Canvas for Active Section */}
            <div className="flex-1 min-w-0 min-h-0">
              {activeSection ? (
                <ProjectSectionEditor
                  projectId={activeProject.id}
                  section={activeSection}
                  onUpdateSection={updateProjectSection}
                  onToggleStatus={toggleProjectSectionStatus}
                  onFlushSave={flushProjectSave}
                  insertRequest={insertRequest}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-white/70 dark:bg-[#1E1C1A]/60 border border-dashed border-[#D6CEBE] dark:border-[#332F2C] space-y-3">
                  <PenLine size={24} className="text-[#9A3412] dark:text-[#EA580C]" />
                  <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                    Siap Mulai Menulis
                  </h3>
                  <p className="text-xs text-[#6B635B] dark:text-[#A8A196] max-w-sm leading-relaxed">
                    Tambahkan bagian atau bab pertama untuk menyusun tulisanmu di atas kanvas editor Noesis.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = addProjectSection(activeProject.id, 'Draf Utama');
                      if (newId) setActiveSectionId(newId);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Buat Bagian Draf Utama</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            MOBILE BODY (< lg) — Maximized Vertical & Horizontal Padding
            ==================================================================== */}
        <div className="lg:hidden flex-1 flex flex-col min-h-0">
          {/* Compact 3-Tab Switcher on Mobile */}
          <div className="px-2.5 pt-2 pb-1 shrink-0">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
              <button
                type="button"
                onClick={() => setMobileDetailTab('sections')}
                className={`py-1.5 px-1.5 rounded-lg text-xs font-medium transition-colors truncate ${
                  mobileDetailTab === 'sections'
                    ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                    : 'text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                Susunan ({totalSections})
              </button>
              <button
                type="button"
                onClick={() => setMobileDetailTab('references')}
                className={`py-1.5 px-1.5 rounded-lg text-xs font-medium transition-colors truncate ${
                  mobileDetailTab === 'references'
                    ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                    : 'text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                Referensi ({totalLinkedCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  flushProjectSave(activeProject.id);
                  setMobileDetailTab('master');
                }}
                className={`py-1.5 px-1.5 rounded-lg text-xs font-medium transition-colors truncate ${
                  mobileDetailTab === 'master'
                    ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                    : 'text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                Master Utuh
              </button>
            </div>
          </div>

          {mobileDetailTab === 'master' ? (
            <ProjectMasterView
              project={activeProject}
              onUpdateSection={updateProjectSection}
              onToggleSectionStatus={toggleProjectSectionStatus}
              onFlushSave={flushProjectSave}
              onSaveCopyToLibrary={() => saveProjectMasterCopyToLibrary(activeProject.id)}
              onOpenLibraryNote={(noteId) => {
                setActiveNoteId(noteId);
                setActiveView('editor');
              }}
              onAddFirstSection={() => {
                const newId = addProjectSection(activeProject.id, 'Draf Utama');
                if (newId) setActiveSectionId(newId);
                setMobileDetailTab('sections');
                setIsMobileEditorOpen(true);
              }}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2.5">
              <SupabaseProjectsBanner />

              {mobileDetailTab === 'sections' ? (
                <>
                  {/* Compact Progress Card */}
                  <div className="bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl p-3 space-y-1.5">
                    <div className="w-full bg-[#F5EFEB] dark:bg-[#272422] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#9A3412] dark:bg-[#EA580C] h-full transition-all duration-300"
                        style={{ width: `${activeProject.progress}%` }}
                      />
                    </div>
                    {activeProject.enableWordGoal && activeProject.targetWordCount > 0 && (
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196]">
                        <span>Target Kata</span>
                        <span>
                          {totalWords.toLocaleString()} /{' '}
                          {activeProject.targetWordCount.toLocaleString()} ({wordPercent}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {renderSectionsList('mobile')}
                </>
              ) : (
                renderReferencesList(
                  (kind, id) => setMobileRefReaderKey({ kind, id }),
                  true,
                  true
                )
              )}
            </div>
          )}
        </div>

        {/* MOBILE FULLSCREEN SECTION EDITOR SHEET */}
        {isMobileEditorOpen && activeSection && (
          <div className="lg:hidden fixed inset-0 z-40 bg-[#FAF7F2] dark:bg-[#151413] flex flex-col">
            <ProjectSectionEditor
              projectId={activeProject.id}
              section={activeSection}
              onUpdateSection={updateProjectSection}
              onToggleStatus={toggleProjectSectionStatus}
              onFlushSave={flushProjectSave}
              isMobileSheet
              linkedReferencesCount={totalLinkedCount}
              onOpenQuickReference={() => setShowMobileQuickRefSheet(true)}
              onDone={() => {
                flushProjectSave(activeProject.id);
                setIsMobileEditorOpen(false);
              }}
              insertRequest={insertRequest}
            />
          </div>
        )}

        {/* MOBILE QUICK-PEEK REFERENCE SHEET INSIDE SECTION EDITOR */}
        {showMobileQuickRefSheet && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end">
            <div className="w-full h-[86vh] bg-[#FAF7F2] dark:bg-[#151413] rounded-t-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="px-3 py-2.5 border-b border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C]">
                  Intip Referensi · {activeSection?.title || 'Bagian'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileQuickRefSheet(false);
                    setMobileQuickRefReaderKey(null);
                  }}
                  className="p-1.5 rounded-lg text-[#6B635B] dark:text-[#A8A196]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                {mobileQuickRefMaterial ? (
                  <ProjectMaterialReader
                    selected={mobileQuickRefMaterial}
                    compact
                    onBack={() => setMobileQuickRefReaderKey(null)}
                    backLabel="Daftar Bahan"
                    onInsertToSection={handleInsertMaterialToActiveSection}
                    onEdit={handleEditMaterialInOrigin}
                  />
                ) : (
                  <div className="h-full overflow-y-auto">
                    {renderReferencesList(
                      (kind, id) => setMobileQuickRefReaderKey({ kind, id }),
                      true,
                      false
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MOBILE QUICK READER SHEET (from Referensi tab) */}
        {mobileRefReaderMaterial && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end">
            <div className="w-full h-[92vh] bg-[#FAF7F2] dark:bg-[#151413] rounded-t-2xl overflow-hidden shadow-2xl p-2">
              <ProjectMaterialReader
                selected={mobileRefReaderMaterial}
                compact
                onInsertToSection={handleInsertMaterialToActiveSection}
                onEdit={handleEditMaterialInOrigin}
                onUnlink={(kind, id) => {
                  unlinkItemFromProject(activeProject.id, kind, id);
                  setMobileRefReaderKey(null);
                }}
                onClose={() => setMobileRefReaderKey(null)}
              />
            </div>
          </div>
        )}

        {/* Modals */}
        <ProjectFormModal
          isOpen={Boolean(editingProject)}
          editingProject={editingProject}
          onClose={() => setEditingProject(null)}
          onSubmit={(data) => {
            if (!editingProject) return;
            updateProject(editingProject.id, {
              title: data.title,
              description: data.description,
              status: data.status,
              enableWordGoal: data.enableWordGoal,
              targetWordCount: data.targetWordCount,
              deadline: data.deadline || undefined,
            });
            setEditingProject(null);
          }}
        />

        <LinkMaterialsModal
          isOpen={showLinkPicker}
          project={activeProject}
          notes={notes}
          fragments={fragments}
          onClose={() => setShowLinkPicker(false)}
          onToggleLink={(kind, itemId, currentlyLinked) => {
            if (currentlyLinked) {
              unlinkItemFromProject(activeProject.id, kind, itemId);
            } else {
              linkItemToProject(activeProject.id, kind, itemId);
            }
          }}
        />

        <DeleteConfirmModal
          isOpen={Boolean(projectToDelete)}
          itemType="project"
          title="Hapus Project Ini?"
          message={`Project “${projectToDelete?.title || ''}” beserta draf bagian di dalamnya akan dihapus. Catatan dan Fragments yang tertaut tetap aman di Library & Fragments.`}
          confirmText="Ya, Hapus Project"
          onClose={() => setProjectToDelete(null)}
          onConfirm={() => {
            if (projectToDelete) {
              deleteProject(projectToDelete.id);
              setProjectToDelete(null);
            }
          }}
        />
      </div>
    );
  }

  // ============================================================================
  // VIEW A: TOP-LEVEL LIST (STUDIO KERJA + KATALOG KARYA)
  // ============================================================================
  const totalCatalogCount = projects.filter(
    (p) => p.status !== 'archived' && projectHasWrittenContent(p)
  ).length;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-2.5 sm:px-8 lg:px-14 py-3 sm:py-8"
    >
      <div className="max-w-5xl mx-auto space-y-3 sm:space-y-6">
        {/* Header */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-3 sm:pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 sm:gap-4">
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-[#9A3412] dark:text-[#EA580C]">
              Studio Penulisan & Katalog Karya
            </span>
            <h1 className="font-serif text-2xl sm:text-4xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] mt-0.5">
              Projects
            </h1>
            <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-0.5 max-w-xl leading-relaxed">
              Rakit catatan & fragments menjadi tulisan utuh per bagian, lalu himpun hasil finalnya di Katalog Karya.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <Plus size={15} />
            <span>Project Baru</span>
          </button>
        </div>

        <SupabaseProjectsBanner />

        {/* Top View Switcher: Studio Kerja vs Katalog Karya */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="inline-flex items-center p-1 rounded-xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] self-start">
            <button
              type="button"
              onClick={() => setTopTab('studio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                topTab === 'studio'
                  ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                  : 'text-[#6B635B] dark:text-[#A8A196]'
              }`}
            >
              <FolderKanban size={13} />
              <span>Studio Kerja</span>
            </button>
            <button
              type="button"
              onClick={() => setTopTab('catalog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                topTab === 'catalog'
                  ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                  : 'text-[#6B635B] dark:text-[#A8A196]'
              }`}
            >
              <Library size={13} />
              <span>Katalog Karya ({totalCatalogCount})</span>
            </button>
          </div>

          {projects.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C9388]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={topTab === 'catalog' ? 'Cari karya...' : 'Cari project...'}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
              />
            </div>
          )}
        </div>

        {/* Sub-filters */}
        {projects.length > 0 && topTab === 'studio' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'all', label: 'Aktif & Berjalan' },
                { id: 'active', label: 'Aktif' },
                { id: 'review', label: 'Meninjau' },
                { id: 'completed', label: 'Selesai' },
                { id: 'archived', label: 'Arsip' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C]'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {projects.length > 0 && topTab === 'catalog' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'all', label: 'Semua Karya Tertulis' },
                { id: 'completed', label: 'Hanya Karya Selesai' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCatalogFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                  catalogFilter === tab.id
                    ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C]'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* CONTENT: CATALOG VIEW */}
        {topTab === 'catalog' ? (
          catalogProjects.length === 0 ? (
            <div className="p-6 sm:p-10 rounded-2xl bg-[#F5EFEB]/70 dark:bg-[#1E1C1A]/60 border border-dashed border-[#D6CEBE] dark:border-[#332F2C] text-center space-y-2.5">
              <div className="w-11 h-11 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mx-auto">
                <Library size={20} />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Katalog Karya Masih Kosong
              </h2>
              <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] max-w-md mx-auto leading-relaxed">
                Tulisan yang sudah mulai kamu susun di bagian-bagian project akan otomatis tampil di sini sebagai naskah Master Utuh siap baca.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {catalogProjects.map((proj) => {
                const meta = STATUS_META[proj.status] || STATUS_META.active;
                const sorted = getSortedProjectSections(proj);
                const totalWords = getProjectWords(proj);
                const firstFilled = sorted.find((s) => sectionHasWrittenContent(s));
                const previewText = firstFilled
                  ? cleanTextForEmbedding(firstFilled.content).slice(0, 145)
                  : '';

                return (
                  <div
                    key={proj.id}
                    onClick={() => openProjectInMode(proj.id, 'master', 'catalog')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openProjectInMode(proj.id, 'master', 'catalog');
                      }
                    }}
                    className="group p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#9A3412]/60 dark:hover:border-[#EA580C]/60 shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] font-mono text-[#9C9388]">
                          {sorted.length} bagian · {totalWords.toLocaleString()} kata
                        </span>
                      </div>

                      <div>
                        <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors line-clamp-1">
                          {proj.title}
                        </h2>
                        {proj.description && (
                          <p className="text-xs italic text-[#6B635B] dark:text-[#A8A196] line-clamp-1 mt-0.5">
                            {proj.description}
                          </p>
                        )}
                        {previewText && (
                          <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-2 mt-1.5 leading-relaxed">
                            {previewText}...
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 flex items-center justify-between text-[11px] font-mono text-[#9A3412] dark:text-[#EA580C]">
                      <span>
                        Diperbarui{' '}
                        {new Date(proj.updatedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="font-medium flex items-center gap-1">
                        <span>Baca Master Utuh</span>
                        <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : projects.length === 0 ? (
          /* EMPTY STATE: ZERO PROJECTS */
          <div className="p-6 sm:p-10 rounded-2xl bg-[#F5EFEB]/70 dark:bg-[#1E1C1A]/60 border border-dashed border-[#D6CEBE] dark:border-[#332F2C] text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mx-auto">
              <FolderKanban size={20} />
            </div>
            <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Belum Ada Project
            </h2>
            <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] max-w-md mx-auto leading-relaxed">
              Buat project untuk menulis karya, menyusun laporan/skripsi per bab, atau merakit catatan & fragments menjadi dokumen utuh.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Buat Project Pertama</span>
            </button>
          </div>
        ) : filteredStudioProjects.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] text-center text-xs text-[#6B635B] dark:text-[#A8A196]">
            Tidak ada project pada filter ini.
          </div>
        ) : (
          /* STUDIO KERJA GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {filteredStudioProjects.map((proj) => {
              const meta = STATUS_META[proj.status] || STATUS_META.active;
              const activeNoteSet = new Set(notes.filter((n) => !n.archived).map((n) => n.id));
              const activeFragSet = new Set(fragments.map((f) => f.id));
              const noteCount = (proj.noteIds || []).filter((id) => activeNoteSet.has(id)).length;
              const fragCount = (proj.fragmentIds || []).filter((id) => activeFragSet.has(id)).length;
              const sortedSecs = getSortedProjectSections(proj);
              const totalSecs = sortedSecs.length;
              const doneSecs = sortedSecs.filter((s) => s.status === 'done').length;
              const totalMs = (proj.milestones || []).length;
              const doneMs = (proj.milestones || []).filter((m) => m.completed).length;
              const totalWords = getProjectWords(proj);

              return (
                <div
                  key={proj.id}
                  onClick={() => openProjectInMode(proj.id, 'studio', 'studio')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openProjectInMode(proj.id, 'studio', 'studio');
                    }
                  }}
                  className="group p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#9A3412]/60 dark:hover:border-[#EA580C]/60 shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      {proj.deadline && (
                        <span className="text-[11px] text-[#9C9388] font-mono flex items-center gap-1 truncate">
                          <Calendar size={11} />
                          <span>{proj.deadline}</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors line-clamp-1">
                        {proj.title}
                      </h2>
                      {proj.description && (
                        <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-2 mt-1 leading-relaxed">
                          {proj.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196]">
                        <span>
                          {totalSecs > 0
                            ? `${doneSecs}/${totalSecs} bagian selesai`
                            : totalMs > 0
                            ? `${doneMs}/${totalMs} langkah lama`
                            : 'Belum ada bagian'}
                        </span>
                        <span className="font-semibold text-[#221F1D] dark:text-[#EDE8E1]">
                          {proj.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-[#F5EFEB] dark:bg-[#272422] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#9A3412] dark:bg-[#EA580C] h-full transition-all duration-300"
                          style={{ width: `${proj.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#9C9388] dark:text-[#736C62]">
                      <span>
                        {noteCount} Catatan{fragCount > 0 ? ` · ${fragCount} Fragments` : ''}
                      </span>
                      <span className="text-[#9A3412] dark:text-[#EA580C]">
                        {totalWords.toLocaleString()}
                        {proj.enableWordGoal && proj.targetWordCount > 0
                          ? ` / ${proj.targetWordCount.toLocaleString()} kata`
                          : ' kata'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <ProjectFormModal
        isOpen={showCreateModal}
        editingProject={null}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(data) => {
          const newId = createProject({
            title: data.title,
            description: data.description,
            enableWordGoal: data.enableWordGoal,
            targetWordCount: data.targetWordCount,
            deadline: data.deadline,
            initialSections: data.initialSections,
          });
          setShowCreateModal(false);
          openProjectInMode(newId, 'studio', 'studio');
        }}
      />
    </div>
  );
};
