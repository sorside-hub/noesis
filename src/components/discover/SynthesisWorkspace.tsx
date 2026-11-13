import React, { useState, useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { useNoesis } from '../../context/NoesisContext';
import {
  DiscoverSourceItem,
  SynthesisResult,
  SynthesisStyle,
} from '../../types';
import {
  noteToDiscoverItem,
  fragmentToDiscoverItem,
  requestSynthesizeDocument,
  parseLegacySynthesisFooterItems,
} from '../../lib/discoverAi';
import {
  Sparkles,
  Search,
  Check,
  Plus,
  X,
  FileText,
  Feather,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  Quote,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export interface SynthesisSeedPayload {
  items: DiscoverSourceItem[];
  topic?: string;
  nonce: number;
}

interface SynthesisWorkspaceProps {
  incomingSeed?: SynthesisSeedPayload | null;
}

export const SynthesisWorkspace: React.FC<SynthesisWorkspaceProps> = ({ incomingSeed }) => {
  const {
    notes,
    fragments,
    approvedConnections,
    performUnifiedSemanticSearch,
    saveSynthesizedNote,
    updateSynthesizedNote,
    synthesisTargetNoteId,
    clearSynthesisTarget,
    setActiveNoteId,
    setActiveView,
  } = useNoesis();

  // Workspace Mode: 'create' (brand new synthesis) vs 'update' (evolve existing synthesis 1 + N -> 1)
  const [workspaceMode, setWorkspaceMode] = useState<'create' | 'update'>('create');
  const [baseSynthesisId, setBaseSynthesisId] = useState<string | null>(null);
  const [hideAlreadyIncludedInManual, setHideAlreadyIncludedInManual] = useState(true);

  // Synthesis Input & Selection States
  const [topicQuery, setTopicQuery] = useState('');
  const [isSearchingMaterials, setIsSearchingMaterials] = useState(false);
  const [searchExecuted, setSearchExecuted] = useState(false);
  const [candidateItems, setCandidateItems] = useState<DiscoverSourceItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Manual Picker Drawer / Panel State
  const [isManualPickerOpen, setIsManualPickerOpen] = useState(false);
  const [manualFilterText, setManualFilterText] = useState('');
  const [manualKindFilter, setManualKindFilter] = useState<'all' | 'note' | 'fragment'>('all');

  // Synthesis Generation & Output States
  const [synthesisStyle, setSynthesisStyle] = useState<SynthesisStyle>('structured');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [synthesisOutput, setSynthesisOutput] = useState<SynthesisResult | null>(null);

  // Editable Output States before saving
  const [draftTitle, setDraftTitle] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [savedUpdateSummary, setSavedUpdateSummary] = useState<{
    isUpdate: boolean;
    prevCount: number;
    newCount: number;
    totalCount: number;
  } | null>(null);

  // Existing non-archived Synthesis documents sorted by latest update
  const synthesisNotes = useMemo(() => {
    return notes
      .filter((n) => !n.archived && n.type === 'synthesis')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notes]);

  const baseSynthesisNote = useMemo(() => {
    if (workspaceMode !== 'update' || !baseSynthesisId) return null;
    return synthesisNotes.find((n) => n.id === baseSynthesisId) || null;
  }, [workspaceMode, baseSynthesisId, synthesisNotes]);

  // Resolve all sources already baked into baseSynthesisNote (Notes via relatedNoteIds, Fragments via approvedConnections + legacy footer)
  const { existingResolvedSources, alreadyIncludedIds } = useMemo(() => {
    if (!baseSynthesisNote) {
      return {
        existingResolvedSources: [] as DiscoverSourceItem[],
        alreadyIncludedIds: new Set<string>(),
      };
    }

    const resolvedMap = new Map<string, DiscoverSourceItem>();

    // 1. Notes recorded in relatedNoteIds
    for (const relId of baseSynthesisNote.relatedNoteIds || []) {
      if (relId === baseSynthesisNote.id) continue;
      const foundNote = notes.find((n) => n.id === relId);
      if (foundNote) {
        resolvedMap.set(foundNote.id, noteToDiscoverItem(foundNote));
      }
    }

    // 2. Fragments linked in approvedConnections
    for (const pairKey of approvedConnections) {
      const parts = pairKey.split('::');
      if (parts.length !== 2) continue;
      const otherId =
        parts[0] === baseSynthesisNote.id
          ? parts[1]
          : parts[1] === baseSynthesisNote.id
          ? parts[0]
          : null;
      if (!otherId || resolvedMap.has(otherId)) continue;
      const foundFrag = fragments.find((f) => f.id === otherId);
      if (foundFrag) {
        resolvedMap.set(foundFrag.id, fragmentToDiscoverItem(foundFrag));
      }
    }

    // 3. Legacy fallback from HTML footer ("Sumber Pengetahuan") for older synthesis docs
    const legacyEntries = parseLegacySynthesisFooterItems(baseSynthesisNote.content || '');
    for (const entry of legacyEntries) {
      const targetTitle = entry.title.toLowerCase();
      if (entry.kind === 'fragment') {
        const frag = fragments.find(
          (f) => !resolvedMap.has(f.id) && (f.title || 'Tanpa Judul').trim().toLowerCase() === targetTitle
        );
        if (frag) resolvedMap.set(frag.id, fragmentToDiscoverItem(frag));
      } else {
        const note = notes.find(
          (n) =>
            n.id !== baseSynthesisNote.id &&
            !resolvedMap.has(n.id) &&
            (n.title || 'Tanpa Judul').trim().toLowerCase() === targetTitle
        );
        if (note) resolvedMap.set(note.id, noteToDiscoverItem(note));
      }
    }

    return {
      existingResolvedSources: Array.from(resolvedMap.values()),
      alreadyIncludedIds: new Set(resolvedMap.keys()),
    };
  }, [baseSynthesisNote, notes, fragments, approvedConnections]);

  // Receive handoff when user clicks "Perbarui Sintesis" from Editor
  useEffect(() => {
    if (!synthesisTargetNoteId) return;
    setWorkspaceMode('update');
    setBaseSynthesisId(synthesisTargetNoteId);
    setSavedNoteId(null);
    setSavedUpdateSummary(null);
    setSynthesisOutput(null);
    setSynthesisError(null);
    setCandidateItems([]);
    setSelectedIds(new Set());
    setSearchExecuted(false);
    setTopicQuery('');
    clearSynthesisTarget();
  }, [synthesisTargetNoteId, clearSynthesisTarget]);

  // Receive seeded items from Connections or Topic Clusters
  useEffect(() => {
    if (!incomingSeed || incomingSeed.items.length === 0) return;

    setWorkspaceMode('create');
    setBaseSynthesisId(null);
    setSavedNoteId(null);
    setSavedUpdateSummary(null);
    setSynthesisOutput(null);
    setSynthesisError(null);
    setSearchExecuted(true);

    if (incomingSeed.topic) {
      setTopicQuery(incomingSeed.topic);
    }

    setCandidateItems((prev) => {
      const map = new Map<string, DiscoverSourceItem>();
      incomingSeed.items.forEach((item) => map.set(item.id, item));
      prev.forEach((item) => {
        if (!map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    setSelectedIds(new Set(incomingSeed.items.map((item) => item.id)));
  }, [incomingSeed]);

  // All available Notes & Fragments unified for manual selection (never include the baseSynthesisNote itself)
  const allLibraryItems = useMemo<DiscoverSourceItem[]>(() => {
    const activeNotes = notes
      .filter((n) => !n.archived && n.id !== baseSynthesisNote?.id)
      .map((n) => noteToDiscoverItem(n));
    const allFrags = fragments.map((f) => fragmentToDiscoverItem(f));
    return [...activeNotes, ...allFrags];
  }, [notes, fragments, baseSynthesisNote?.id]);

  // Extract top real tags from user's archive as quick topic chips
  const topArchiveTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allLibraryItems) {
      for (const tag of item.tags || []) {
        const clean = tag.trim();
        if (clean && clean !== 'synthesis') {
          counts.set(clean, (counts.get(clean) || 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }, [allLibraryItems]);

  // Filtered list inside Manual Picker
  const manualPickerItems = useMemo(() => {
    const filtered = allLibraryItems.filter((item) => {
      if (baseSynthesisNote && hideAlreadyIncludedInManual && alreadyIncludedIds.has(item.id)) {
        return false;
      }
      if (manualKindFilter !== 'all' && item.kind !== manualKindFilter) return false;
      if (manualFilterText.trim()) {
        const q = manualFilterText.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inExcerpt = item.excerpt.toLowerCase().includes(q);
        const inTags = item.tags.some((t) => t.toLowerCase().includes(q));
        return inTitle || inExcerpt || inTags;
      }
      return true;
    });

    if (!baseSynthesisNote) return filtered;
    // Always float un-included items first when updating
    return [...filtered].sort((a, b) => {
      const aIn = alreadyIncludedIds.has(a.id) ? 1 : 0;
      const bIn = alreadyIncludedIds.has(b.id) ? 1 : 0;
      return aIn - bIn;
    });
  }, [
    allLibraryItems,
    manualKindFilter,
    manualFilterText,
    baseSynthesisNote,
    hideAlreadyIncludedInManual,
    alreadyIncludedIds,
  ]);

  // Active selected items list (always excludes baseSynthesisNote & alreadyIncludedIds in update mode)
  const selectedItems = useMemo(() => {
    const map = new Map<string, DiscoverSourceItem>();
    for (const item of candidateItems) map.set(item.id, item);
    for (const item of allLibraryItems) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    const list: DiscoverSourceItem[] = [];
    selectedIds.forEach((id) => {
      if (baseSynthesisNote && (id === baseSynthesisNote.id || alreadyIncludedIds.has(id))) {
        return;
      }
      const found = map.get(id);
      if (found) list.push(found);
    });
    return list;
  }, [candidateItems, allLibraryItems, selectedIds, baseSynthesisNote, alreadyIncludedIds]);

  // Tiptap WYSIWYG editor for editing synthesized document before saving
  const previewEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#9A3412] dark:text-[#EA580C] underline',
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'tiptap prose dark:prose-invert max-w-none focus:outline-none min-h-[260px] text-sm sm:text-[15px] leading-relaxed text-[#292524] dark:text-[#E7E5E4] space-y-3 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-medium [&_h2]:text-[#221F1D] [&_h2]:dark:text-[#EDE8E1] [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:font-serif [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-[#221F1D] [&_h3]:dark:text-[#EDE8E1] [&_h3]:mt-4 [&_h3]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5',
      },
    },
    onUpdate: ({ editor }) => {
      setDraftHtml(editor.getHTML());
    },
  });

  useEffect(() => {
    if (previewEditor && synthesisOutput) {
      previewEditor.commands.setContent(synthesisOutput.htmlContent || '<p></p>');
    }
  }, [synthesisOutput, previewEditor]);

  const handleTopicSearch = async (overrideTopic?: string) => {
    const query = (overrideTopic ?? topicQuery).trim();
    if (!query) return;
    if (overrideTopic !== undefined) setTopicQuery(overrideTopic);

    setIsSearchingMaterials(true);
    setSearchExecuted(true);
    setSynthesisError(null);
    setSavedNoteId(null);
    setSavedUpdateSummary(null);

    try {
      const rawResults = await performUnifiedSemanticSearch(query);
      const filteredResults = baseSynthesisNote
        ? rawResults.filter((item) => item.id !== baseSynthesisNote.id)
        : rawResults;
      setCandidateItems(filteredResults);
      // Pre-select top relevant NEW items (up to 10), skipping items already inside baseSynthesisNote
      const nextSelected = new Set(selectedIds);
      filteredResults
        .filter((item) => !alreadyIncludedIds.has(item.id))
        .slice(0, 10)
        .forEach((item) => nextSelected.add(item.id));
      setSelectedIds(nextSelected);
    } catch (err: any) {
      setSynthesisError(err?.message || 'Gagal mencari bahan catatan.');
    } finally {
      setIsSearchingMaterials(false);
    }
  };

  const toggleItemSelection = (item: DiscoverSourceItem) => {
    if (baseSynthesisNote && (item.id === baseSynthesisNote.id || alreadyIncludedIds.has(item.id))) {
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
    // Ensure manually toggled items are also visible in candidateItems list
    setCandidateItems((prev) => {
      if (prev.some((p) => p.id === item.id)) return prev;
      return [item, ...prev];
    });
  };

  const minRequiredItems = baseSynthesisNote ? 1 : 2;

  const handleRunSynthesis = async () => {
    if (selectedItems.length < minRequiredItems) return;

    setIsSynthesizing(true);
    setSynthesisError(null);
    setSavedNoteId(null);
    setSavedUpdateSummary(null);

    try {
      const result = await requestSynthesizeDocument({
        topic: topicQuery.trim() || undefined,
        style: synthesisStyle,
        items: selectedItems,
        existingSynthesis: baseSynthesisNote
          ? {
              id: baseSynthesisNote.id,
              title: baseSynthesisNote.title,
              htmlContent: baseSynthesisNote.content,
              tags: baseSynthesisNote.tags,
            }
          : undefined,
      });

      setSynthesisOutput(result);
      setDraftTitle(result.title || baseSynthesisNote?.title || 'Dokumen Sintesis');
      setDraftHtml(result.htmlContent || '');
      const mergedTags = baseSynthesisNote
        ? Array.from(
            new Set([
              ...(baseSynthesisNote.tags || []),
              ...(result.suggestedTags || []),
            ])
          )
        : result.suggestedTags || [];
      setDraftTags(mergedTags);
    } catch (err: any) {
      setSynthesisError(err?.message || 'Gagal menyusun sintesis dokumen.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (!synthesisOutput) return;
    if (baseSynthesisNote) {
      const mergedMap = new Map<string, DiscoverSourceItem>();
      existingResolvedSources.forEach((s) => mergedMap.set(s.id, s));
      selectedItems.forEach((s) => mergedMap.set(s.id, s));
      const allResolved = Array.from(mergedMap.values());

      const ok = updateSynthesizedNote({
        targetNoteId: baseSynthesisNote.id,
        title: draftTitle,
        htmlContent: draftHtml,
        tags: draftTags,
        newSourceItems: selectedItems,
        allResolvedSourceItems: allResolved,
      });
      if (ok) {
        setSavedUpdateSummary({
          isUpdate: true,
          prevCount: existingResolvedSources.length,
          newCount: selectedItems.length,
          totalCount: allResolved.length,
        });
        setSavedNoteId(baseSynthesisNote.id);
      }
      return;
    }

    const newId = saveSynthesizedNote({
      title: draftTitle,
      htmlContent: draftHtml,
      tags: draftTags,
      sourceItems: selectedItems,
    });
    setSavedUpdateSummary({
      isUpdate: false,
      prevCount: 0,
      newCount: selectedItems.length,
      totalCount: selectedItems.length,
    });
    setSavedNoteId(newId);
  };

  const handleAddDraftTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (cleaned && !draftTags.includes(cleaned)) {
      setDraftTags((prev) => [...prev, cleaned]);
    }
    setNewTagInput('');
  };

  const handleResetSynthesis = () => {
    setSynthesisOutput(null);
    setSavedNoteId(null);
    setSavedUpdateSummary(null);
    setSynthesisError(null);
    setDraftTitle('');
    setDraftHtml('');
    setDraftTags([]);
  };

  const handleResetAllMaterials = () => {
    setCandidateItems([]);
    setSelectedIds(new Set());
    setTopicQuery('');
    setSearchExecuted(false);
    handleResetSynthesis();
  };

  const handleSwitchMode = (nextMode: 'create' | 'update') => {
    if (nextMode === workspaceMode) return;
    setWorkspaceMode(nextMode);
    if (nextMode === 'update') {
      setBaseSynthesisId(synthesisNotes[0]?.id || null);
    } else {
      setBaseSynthesisId(null);
    }
    handleResetAllMaterials();
  };

  const handleSelectBaseSynthesis = (id: string) => {
    setBaseSynthesisId(id);
    handleResetAllMaterials();
  };

  const selectedNotesCount = selectedItems.filter((i) => i.kind === 'note').length;
  const selectedFragmentsCount = selectedItems.filter((i) => i.kind === 'fragment').length;
  const totalMergedPreviewCount = baseSynthesisNote
    ? existingResolvedSources.length + selectedItems.length
    : selectedItems.length;

  return (
    <div className="space-y-6">
      {/* Saved Success Banner */}
      {savedNoteId ? (
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                {savedUpdateSummary?.isUpdate
                  ? 'Dokumen Sintesis Berhasil Diperbarui'
                  : 'Dokumen Sintesis Tersimpan ke Library'}
              </h2>
              <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed">
                {savedUpdateSummary?.isUpdate ? (
                  <>
                    <strong>“{draftTitle}”</strong> telah diperbarui di tempat dengan{' '}
                    <strong>+{savedUpdateSummary.newCount} materi baru</strong> (total sekarang{' '}
                    <strong>{savedUpdateSummary.totalCount} sumber tertaut</strong>) tanpa menduplikasi dokumen. Semua catatan aslimu tetap utuh.
                  </>
                ) : (
                  <>
                    <strong>“{draftTitle}”</strong> telah disimpan sebagai pengetahuan baru dan otomatis tertaut ke{' '}
                    {selectedNotesCount} catatan sumber
                    {selectedFragmentsCount > 0 ? ` serta merujuk ${selectedFragmentsCount} fragments` : ''}. Semua catatan aslimu tetap utuh.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setActiveNoteId(savedNoteId);
                setActiveView('editor');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Feather size={14} />
              <span>Buka di Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('library')}
              className="px-4 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#272422] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C] transition-colors flex items-center gap-1.5"
            >
              <BookOpen size={14} />
              <span>Lihat di Library</span>
            </button>
            <button
              type="button"
              onClick={handleResetAllMaterials}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>
                {savedUpdateSummary?.isUpdate ? 'Perbarui Sintesis Lagi' : 'Buat Sintesis Baru'}
              </span>
            </button>
          </div>
        </div>
      ) : synthesisOutput ? (
        /* ============================================================
           REVIEW & EDIT SYNTHESIS RESULT BEFORE SAVING
           ============================================================ */
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetSynthesis}
              className="text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#9A3412] dark:hover:text-[#EA580C] flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Kembali ke Pilihan Bahan ({selectedItems.length})</span>
            </button>

            <span className="text-[11px] font-mono text-[#9C9388] dark:text-[#736C62]">
              Tinjau & edit seperlunya sebelum menyimpan ke Library
            </span>
          </div>

          {/* Synthesis Insight Callout */}
          {synthesisOutput.synthesisNotes && (
            <div className="p-4 rounded-2xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-start gap-3">
              <Sparkles size={16} className="text-[#9A3412] dark:text-[#EA580C] shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] leading-relaxed">
                <span className="font-medium text-[#221F1D] dark:text-[#EDE8E1]">Keterkaitan Sumber: </span>
                {synthesisOutput.synthesisNotes}
              </div>
            </div>
          )}

          {/* Editable Document Container */}
          <div className="p-4 sm:p-6 md:p-8 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-5">
            {/* Title Input */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
                Judul Dokumen
              </label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Judul dokumen sintesis..."
                className="w-full font-serif text-xl sm:text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] bg-transparent border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-2 focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
              />
            </div>

            {/* Tags Editor */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono text-[#9C9388] mr-1">#synthesis</span>
              {draftTags
                .filter((t) => t !== 'synthesis')
                .map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono bg-[#F5EFEB] dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] border border-[#E8E2D8] dark:border-[#2F2B28]"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => setDraftTags((prev) => prev.filter((t) => t !== tag))}
                      className="text-[#9C9388] hover:text-red-500"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              <form onSubmit={handleAddDraftTag} className="inline-flex items-center">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="+ tambah tag"
                  className="text-xs font-mono px-2 py-0.5 w-28 bg-transparent border-b border-dashed border-[#D6CEBE] dark:border-[#443E3A] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412]"
                />
              </form>
            </div>

            {/* Lightweight Tiptap Formatting Toolbar */}
            {previewEditor && (
              <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-[#FAF7F2] dark:bg-[#151413] border border-[#E8E2D8] dark:border-[#2F2B28]">
                {[
                  {
                    icon: Bold,
                    label: 'Bold',
                    active: previewEditor.isActive('bold'),
                    action: () => previewEditor.chain().focus().toggleBold().run(),
                  },
                  {
                    icon: Italic,
                    label: 'Italic',
                    active: previewEditor.isActive('italic'),
                    action: () => previewEditor.chain().focus().toggleItalic().run(),
                  },
                  {
                    icon: Heading2,
                    label: 'Heading 2',
                    active: previewEditor.isActive('heading', { level: 2 }),
                    action: () => previewEditor.chain().focus().toggleHeading({ level: 2 }).run(),
                  },
                  {
                    icon: Heading3,
                    label: 'Heading 3',
                    active: previewEditor.isActive('heading', { level: 3 }),
                    action: () => previewEditor.chain().focus().toggleHeading({ level: 3 }).run(),
                  },
                  {
                    icon: List,
                    label: 'List',
                    active: previewEditor.isActive('bulletList'),
                    action: () => previewEditor.chain().focus().toggleBulletList().run(),
                  },
                  {
                    icon: Quote,
                    label: 'Quote',
                    active: previewEditor.isActive('blockquote'),
                    action: () => previewEditor.chain().focus().toggleBlockquote().run(),
                  },
                ].map((btn) => {
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={btn.action}
                      title={btn.label}
                      className={`p-1.5 rounded-lg transition-colors ${
                        btn.active
                          ? 'bg-[#9A3412] dark:bg-[#EA580C] text-white'
                          : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
                      }`}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Rich Document Editor */}
            <div className="pt-1">
              <EditorContent editor={previewEditor} />
            </div>

            {/* Attribution Footer Preview */}
            <div className="pt-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388]">
                {baseSynthesisNote
                  ? `Total Sumber Tertaut (${existingResolvedSources.length} lama + ${selectedItems.length} baru = ${totalMergedPreviewCount})`
                  : `Catatan Sumber yang Akan Tertaut (${selectedItems.length})`}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {baseSynthesisNote &&
                  existingResolvedSources.map((item) => (
                    <span
                      key={`old-${item.id}`}
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-[#F5EFEB] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#9C9388] dark:text-[#736C62]"
                    >
                      <span className="font-mono text-[10px] mr-1">
                        {item.kind === 'fragment' ? 'Fragment' : 'Catatan'}
                      </span>
                      {item.title}
                    </span>
                  ))}
                {selectedItems.map((item) => (
                  <span
                    key={item.id}
                    className={`px-2.5 py-1 rounded-lg text-[11px] border ${
                      baseSynthesisNote
                        ? 'bg-violet-50/70 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900/50 text-[#221F1D] dark:text-[#EDE8E1]'
                        : 'bg-[#FAF7F2] dark:bg-[#272422] border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#9A3412] dark:text-[#EA580C] mr-1">
                      {baseSynthesisNote ? '+ Baru · ' : ''}
                      {item.kind === 'fragment' ? 'Fragment' : 'Catatan'}
                    </span>
                    {item.title}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Save Action Footer */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase tracking-wider bg-violet-50 dark:bg-violet-950/40 text-[#6D28D9] dark:text-[#A78BFA] border border-violet-200 dark:border-violet-900/50">
                <Sparkles size={11} />
                <span>Synthesis</span>
              </span>
              <span className="text-xs text-[#6B635B] dark:text-[#A8A196]">
                {baseSynthesisNote
                  ? `Memperbarui “${baseSynthesisNote.title || 'Dokumen Sintesis'}” di tempat`
                  : 'Otomatis masuk ke tab Synthesis di Library'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleRunSynthesis}
                disabled={isSynthesizing}
                className="px-3.5 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Susun Ulang</span>
              </button>
              <button
                type="button"
                onClick={handleSaveToLibrary}
                className="px-5 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors flex items-center gap-2 shadow-xs"
              >
                <Check size={14} />
                <span>
                  {baseSynthesisNote ? 'Simpan Pembaruan Sintesis' : 'Simpan ke Library'}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================
           MODE SELECTOR + TOPIC SEARCH / MANUAL PICKER + CURATION
           ============================================================ */
        <>
          {/* Mode Toggle + Base Synthesis Picker (shown whenever user has existing synthesis docs) */}
          {synthesisNotes.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] block">
                    Mode Sintesis
                  </span>
                  <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5">
                    {workspaceMode === 'update'
                      ? 'Tambahkan catatan baru ke dokumen sintesis lama tanpa mulai dari nol (1 + N → 1).'
                      : 'Gabungkan catatan atau fragment menjadi satu dokumen sintesis baru.'}
                  </p>
                </div>

                <div className="flex items-center p-1 bg-[#F5EFEB] dark:bg-[#151413] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('create')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      workspaceMode === 'create'
                        ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                        : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                    }`}
                  >
                    <Plus size={13} />
                    <span>Sintesis Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('update')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      workspaceMode === 'update'
                        ? 'bg-white dark:bg-[#272422] text-[#6D28D9] dark:text-[#A78BFA] shadow-2xs'
                        : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                    }`}
                  >
                    <Sparkles size={12} />
                    <span>Perbarui Sintesis Lama</span>
                  </button>
                </div>
              </div>

              {workspaceMode === 'update' && (
                <div className="pt-3 border-t border-[#E8E2D8] dark:border-[#2F2B28] space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <label className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] shrink-0">
                      Dokumen Induk:
                    </label>
                    <select
                      value={baseSynthesisNote?.id || ''}
                      onChange={(e) => handleSelectBaseSynthesis(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#151413] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#6D28D9] dark:focus:border-[#A78BFA]"
                    >
                      {synthesisNotes.map((sn) => (
                        <option key={sn.id} value={sn.id}>
                          {sn.title || 'Dokumen Sintesis'} ({sn.relatedNoteIds?.length || 0} catatan tertaut)
                        </option>
                      ))}
                    </select>
                  </div>

                  {baseSynthesisNote && (
                    <div className="p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/80 dark:border-violet-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                            <Sparkles size={10} />
                            <span>Fondasi Aktif</span>
                          </span>
                          <span className="text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196]">
                            · {existingResolvedSources.length} sumber sudah tergabung di dalamnya
                          </span>
                        </div>
                        <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-1 mt-0.5">
                          {baseSynthesisNote.excerpt || 'Siap diperbarui dengan materi tambahan.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNoteId(baseSynthesisNote.id);
                          setActiveView('editor');
                        }}
                        className="text-[11px] font-medium text-[#6D28D9] dark:text-[#A78BFA] hover:underline shrink-0 self-start sm:self-center"
                      >
                        Buka di Editor
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Topic Search Card + Manual Picker Trigger */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  {baseSynthesisNote
                    ? 'Pilih Materi Baru Untuk Ditambahkan'
                    : 'Mulai Penggabungan Pengetahuan'}
                </h2>
                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5">
                  {baseSynthesisNote
                    ? 'Cari lewat topik atau pilih manual catatan & fragments baru. Sumber yang sudah masuk ditandai otomatis.'
                    : 'Masukkan topik untuk menjaring catatan & fragments relevan, atau pilih langsung secara manual.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualPickerOpen((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0 ${
                  isManualPickerOpen
                    ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C]'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
                }`}
              >
                <Plus size={14} />
                <span>{isManualPickerOpen ? 'Tutup Pemilih Manual' : 'Pilih Bahan Manual'}</span>
              </button>
            </div>

            {/* Topic Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTopicSearch();
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1 flex items-center">
                <Search size={16} className="absolute left-3.5 text-[#9C9388] pointer-events-none" />
                <input
                  type="text"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  placeholder="Contoh: fokus kerja mendalam, stoikisme, atau desain sistem belajar..."
                  className="w-full text-sm pl-10 pr-9 py-2.5 sm:py-3 rounded-xl bg-[#F5EFEB] dark:bg-[#151413] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] transition-colors"
                />
                {topicQuery && (
                  <button
                    type="button"
                    onClick={() => setTopicQuery('')}
                    className="absolute right-3 text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!topicQuery.trim() || isSearchingMaterials}
                className="px-5 py-2.5 sm:py-3 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-xs"
              >
                {isSearchingMaterials ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                <span>{isSearchingMaterials ? 'Mencari...' : 'Cari Bahan'}</span>
              </button>
            </form>

            {/* Real Archive Tag Chips */}
            {topArchiveTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-mono text-[#9C9388] mr-1">Topik di arsipmu:</span>
                {topArchiveTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTopicSearch(tag)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196] hover:border-[#9A3412] hover:text-[#9A3412] dark:hover:text-[#EA580C] transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Inline Manual Note & Fragment Picker */}
            {isManualPickerOpen && (
              <div className="pt-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] space-y-3 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-2.5 text-[#9C9388]" />
                    <input
                      type="text"
                      value={manualFilterText}
                      onChange={(e) => setManualFilterText(e.target.value)}
                      placeholder="Filter judul, isi, atau tag dari catatan & fragments..."
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#151413] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {baseSynthesisNote && alreadyIncludedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setHideAlreadyIncludedInManual((prev) => !prev)}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors ${
                          hideAlreadyIncludedInManual
                            ? 'border-[#6D28D9] dark:border-[#A78BFA] bg-violet-50/70 dark:bg-violet-950/30 text-[#6D28D9] dark:text-[#A78BFA]'
                            : 'border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]'
                        }`}
                      >
                        {hideAlreadyIncludedInManual ? 'Hanya Materi Baru' : 'Tampilkan Semua'}
                      </button>
                    )}

                    <div className="flex items-center p-1 bg-[#F5EFEB] dark:bg-[#151413] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] self-start">
                      {[
                        { id: 'all', label: 'Semua' },
                        { id: 'note', label: 'Catatan' },
                        { id: 'fragment', label: 'Fragments' },
                      ].map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => setManualKindFilter(k.id as 'all' | 'note' | 'fragment')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            manualKindFilter === k.id
                              ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                              : 'text-[#6B635B] dark:text-[#A8A196]'
                          }`}
                        >
                          {k.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {manualPickerItems.length === 0 ? (
                  <p className="text-xs text-[#9C9388] py-6 text-center">
                    {baseSynthesisNote && hideAlreadyIncludedInManual
                      ? 'Tidak ada materi baru yang cocok (semua materi yang cocok sudah masuk ke sintesis ini).'
                      : 'Tidak ada catatan atau fragment yang cocok.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {manualPickerItems.map((item) => {
                      const isIncluded = Boolean(baseSynthesisNote && alreadyIncludedIds.has(item.id));
                      const isSelected = !isIncluded && selectedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isIncluded}
                          onClick={() => toggleItemSelection(item)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                            isIncluded
                              ? 'border-[#E8E2D8]/70 dark:border-[#2F2B28]/70 bg-[#F5EFEB]/50 dark:bg-[#151413]/50 opacity-65 cursor-not-allowed'
                              : isSelected
                              ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#FAF7F2] dark:bg-[#272422]'
                              : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] hover:border-[#D6CEBE]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isIncluded
                                ? 'bg-[#6D28D9]/20 dark:bg-[#A78BFA]/20 border-[#6D28D9]/40 text-[#6D28D9] dark:text-[#A78BFA]'
                                : isSelected
                                ? 'bg-[#9A3412] dark:bg-[#EA580C] border-[#9A3412] dark:border-[#EA580C] text-white'
                                : 'border-[#D6CEBE] dark:border-[#443E3A]'
                            }`}
                          >
                            {(isSelected || isIncluded) && <Check size={11} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono">
                              <span className="truncate">
                                <span className="uppercase text-[#9A3412] dark:text-[#EA580C] font-semibold">
                                  {item.kind === 'fragment' ? 'Fragment' : 'Catatan'}
                                </span>
                                <span className="text-[#9C9388]"> · {item.type}</span>
                              </span>
                              {isIncluded && (
                                <span className="px-1.5 py-0.5 rounded bg-violet-100/70 dark:bg-violet-950/40 text-[#6D28D9] dark:text-[#A78BFA] text-[9px] shrink-0">
                                  Sudah masuk
                                </span>
                              )}
                            </div>
                            <div className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] line-clamp-1 mt-0.5">
                              {item.title}
                            </div>
                            <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] line-clamp-1 mt-0.5">
                              {item.excerpt || 'Tanpa isi'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Notice */}
          {synthesisError && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
              <span>{synthesisError}</span>
              <button
                type="button"
                onClick={() => setSynthesisError(null)}
                className="p-1 hover:opacity-75"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Search Candidates / Selected Materials Basket */}
          {(searchExecuted || selectedIds.size > 0 || candidateItems.length > 0) && (
            <div className="space-y-5">
              {/* Curation Header */}
              <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                      {baseSynthesisNote ? 'Kurasi Materi Tambahan' : 'Kurasi Bahan Sintesis'}
                    </h3>
                    <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
                      {selectedItems.length > 0
                        ? baseSynthesisNote
                          ? `${selectedNotesCount} catatan & ${selectedFragmentsCount} fragments baru dipilih untuk dilebur ke “${baseSynthesisNote.title || 'Dokumen Sintesis'}”.`
                          : `${selectedNotesCount} catatan & ${selectedFragmentsCount} fragments terpilih untuk disatukan.`
                        : baseSynthesisNote
                        ? 'Centang minimal 1 catatan atau fragment baru di bawah ini.'
                        : 'Centang minimal 2 catatan atau fragments di bawah ini.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] text-xs text-[#6B635B] dark:text-[#A8A196] hover:text-red-600 transition-colors"
                      >
                        Kosongkan Pilihan
                      </button>
                    )}
                  </div>
                </div>

                {/* Combined List of Found Candidates + Selected Items */}
                {(() => {
                  const displayMap = new Map<string, DiscoverSourceItem>();
                  candidateItems.forEach((item) => displayMap.set(item.id, item));
                  selectedItems.forEach((item) => {
                    if (!displayMap.has(item.id)) displayMap.set(item.id, item);
                  });
                  const displayList = Array.from(displayMap.values());

                  if (displayList.length === 0) {
                    return (
                      <div className="py-10 text-center space-y-2 border border-dashed border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl">
                        <p className="text-sm font-serif italic text-[#6B635B] dark:text-[#A8A196]">
                          Tidak ditemukan catatan atau fragments yang relevan untuk topik ini.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsManualPickerOpen(true)}
                          className="text-xs font-medium text-[#9A3412] dark:text-[#EA580C] hover:underline"
                        >
                          Coba pilih catatan secara manual
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {displayList.map((item) => {
                        const isIncluded = Boolean(baseSynthesisNote && alreadyIncludedIds.has(item.id));
                        const isSelected = !isIncluded && selectedIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItemSelection(item)}
                            className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                              isIncluded
                                ? 'border-[#E8E2D8]/70 dark:border-[#2F2B28]/70 bg-[#F5EFEB]/50 dark:bg-[#151413]/50 opacity-65 cursor-not-allowed'
                                : isSelected
                                ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#FAF7F2] dark:bg-[#272422] shadow-2xs cursor-pointer'
                                : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] hover:border-[#D6CEBE] cursor-pointer'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-1 transition-colors ${
                                isIncluded
                                  ? 'bg-[#6D28D9]/20 dark:bg-[#A78BFA]/20 border-[#6D28D9]/40 text-[#6D28D9] dark:text-[#A78BFA]'
                                  : isSelected
                                  ? 'bg-[#9A3412] dark:bg-[#EA580C] border-[#9A3412] dark:border-[#EA580C] text-white'
                                  : 'border-[#D6CEBE] dark:border-[#443E3A]'
                              }`}
                            >
                              {(isSelected || isIncluded) && <Check size={11} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                                <span className="uppercase font-semibold text-[#9A3412] dark:text-[#EA580C]">
                                  {item.kind === 'fragment' ? 'Fragment' : 'Catatan'} · {item.type}
                                </span>
                                {isIncluded && (
                                  <span className="px-1.5 py-0.5 rounded bg-violet-100/70 dark:bg-violet-950/40 text-[#6D28D9] dark:text-[#A78BFA] text-[9px] shrink-0">
                                    Sudah masuk
                                  </span>
                                )}
                              </div>
                              <h4 className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] line-clamp-1 mt-0.5">
                                {item.title}
                              </h4>
                              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-2 mt-1 leading-relaxed">
                                {item.excerpt || 'Tanpa isi'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Output Format & Generate CTA */}
                {selectedItems.length > 0 && (
                  <div className="pt-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] space-y-4">
                    <div>
                      <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] block mb-2">
                        Pilih Format Dokumen Hasil
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        {[
                          {
                            id: 'structured',
                            label: 'Master Note Terstruktur',
                            desc: 'Sub-bab tematik, sudut pandang, & simpulan utuh.',
                          },
                          {
                            id: 'essay',
                            label: 'Esai Mengalir',
                            desc: 'Narasi reflektif dengan alur baca yang halus.',
                          },
                          {
                            id: 'brief',
                            label: 'Ringkasan Inti',
                            desc: 'Poin-poin argumen kunci yang padat & langsung.',
                          },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSynthesisStyle(opt.id as SynthesisStyle)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              synthesisStyle === opt.id
                                ? 'border-[#9A3412] bg-[#FAF7F2] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                                : 'border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#221F1E]'
                            }`}
                          >
                            <div className="text-xs font-medium">{opt.label}</div>
                            <div className="text-[10px] text-[#9C9388] mt-0.5 leading-snug">
                              {opt.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-[#6B635B] dark:text-[#A8A196]">
                        {selectedItems.length < minRequiredItems
                          ? baseSynthesisNote
                            ? 'Pilih minimal 1 materi baru untuk memperbarui sintesis.'
                            : 'Pilih minimal 2 bahan agar bisa disintesis.'
                          : baseSynthesisNote
                          ? `${existingResolvedSources.length} sumber lama + ${selectedItems.length} materi baru → 1 dokumen terpadu.`
                          : `${selectedItems.length} bahan siap digabungkan menjadi 1 dokumen baru.`}
                      </span>
                      <button
                        type="button"
                        onClick={handleRunSynthesis}
                        disabled={selectedItems.length < minRequiredItems || isSynthesizing}
                        className="px-5 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-xs"
                      >
                        {isSynthesizing ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>
                              {baseSynthesisNote ? 'Memperbarui Dokumen...' : 'Menyusun Dokumen...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>
                              {baseSynthesisNote ? 'Perbarui Dokumen Sintesis' : 'Susun Dokumen Utuh'}
                            </span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty Guidance Card when no search/selection yet */}
          {!searchExecuted && selectedIds.size === 0 && !isManualPickerOpen && (
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F5EFEB]/70 dark:bg-[#1E1C1A]/60 border border-dashed border-[#D6CEBE] dark:border-[#332F2C] text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mx-auto">
                <FileText size={18} />
              </div>
              <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                {baseSynthesisNote
                  ? 'Siap Memperbarui Dokumen Sintesis Ini'
                  : 'Gabungkan Catatan Tercecer Jadi Satu Pengetahuan Matang'}
              </h3>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] max-w-lg mx-auto leading-relaxed">
                {baseSynthesisNote
                  ? 'Cari lewat topik atau klik “Pilih Bahan Manual” di atas untuk memilih catatan & fragment baru yang ingin dilebur ke dalam dokumen sintesis induk tanpa kehilangan struktur sebelumnya.'
                  : 'Ketik topik di atas atau pilih manual dari arsipmu. Noesis akan mencari keterkaitan antar catatan & fragments lalu menyusunnya menjadi dokumen baru di Library tanpa menghapus catatan aslinya.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
