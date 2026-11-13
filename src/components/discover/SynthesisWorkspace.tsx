import React, { useState, useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { useNoesis } from '../../context/NoesisContext';
import {
  DiscoverSourceItem,
  NoteType,
  SynthesisResult,
  SynthesisStyle,
} from '../../types';
import {
  noteToDiscoverItem,
  fragmentToDiscoverItem,
  requestSynthesizeDocument,
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
    performUnifiedSemanticSearch,
    saveSynthesizedNote,
    setActiveNoteId,
    setActiveView,
  } = useNoesis();

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
  const [targetNoteType, setTargetNoteType] = useState<NoteType>('thought');
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  // Receive seeded items from Connections or Topic Clusters
  useEffect(() => {
    if (!incomingSeed || incomingSeed.items.length === 0) return;

    setSavedNoteId(null);
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

  // All available Notes & Fragments unified for manual selection
  const allLibraryItems = useMemo<DiscoverSourceItem[]>(() => {
    const activeNotes = notes
      .filter((n) => !n.archived)
      .map((n) => noteToDiscoverItem(n));
    const allFrags = fragments.map((f) => fragmentToDiscoverItem(f));
    return [...activeNotes, ...allFrags];
  }, [notes, fragments]);

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
    return allLibraryItems.filter((item) => {
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
  }, [allLibraryItems, manualKindFilter, manualFilterText]);

  // Active selected items list (preserve order from candidates + any manually picked items)
  const selectedItems = useMemo(() => {
    const map = new Map<string, DiscoverSourceItem>();
    for (const item of candidateItems) map.set(item.id, item);
    for (const item of allLibraryItems) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    const list: DiscoverSourceItem[] = [];
    selectedIds.forEach((id) => {
      const found = map.get(id);
      if (found) list.push(found);
    });
    return list;
  }, [candidateItems, allLibraryItems, selectedIds]);

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

    try {
      const results = await performUnifiedSemanticSearch(query);
      setCandidateItems(results);
      // Pre-select top relevant items (up to 10) while preserving any manually chosen ones
      const nextSelected = new Set(selectedIds);
      results.slice(0, 10).forEach((item) => nextSelected.add(item.id));
      setSelectedIds(nextSelected);
    } catch (err: any) {
      setSynthesisError(err?.message || 'Gagal mencari bahan catatan.');
    } finally {
      setIsSearchingMaterials(false);
    }
  };

  const toggleItemSelection = (item: DiscoverSourceItem) => {
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

  const handleRunSynthesis = async () => {
    if (selectedItems.length < 2) return;

    setIsSynthesizing(true);
    setSynthesisError(null);
    setSavedNoteId(null);

    try {
      const result = await requestSynthesizeDocument({
        topic: topicQuery.trim() || undefined,
        style: synthesisStyle,
        items: selectedItems,
      });

      setSynthesisOutput(result);
      setDraftTitle(result.title || 'Dokumen Sintesis');
      setDraftHtml(result.htmlContent || '');
      setDraftTags(result.suggestedTags || []);
    } catch (err: any) {
      setSynthesisError(err?.message || 'Gagal menyusun sintesis dokumen.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (!synthesisOutput) return;
    const newId = saveSynthesizedNote({
      title: draftTitle,
      htmlContent: draftHtml,
      tags: draftTags,
      sourceItems: selectedItems,
      type: targetNoteType,
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

  const selectedNotesCount = selectedItems.filter((i) => i.kind === 'note').length;
  const selectedFragmentsCount = selectedItems.filter((i) => i.kind === 'fragment').length;

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
                Dokumen Sintesis Tersimpan ke Library
              </h2>
              <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed">
                <strong>“{draftTitle}”</strong> telah disimpan sebagai pengetahuan baru dan otomatis tertaut ke{' '}
                {selectedNotesCount} catatan sumber
                {selectedFragmentsCount > 0 ? ` serta merujuk ${selectedFragmentsCount} fragments` : ''}. Semua catatan aslimu tetap utuh.
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
              <span>Buat Sintesis Baru</span>
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
                Catatan Sumber yang Akan Tertaut ({selectedItems.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedItems.map((item) => (
                  <span
                    key={item.id}
                    className="px-2.5 py-1 rounded-lg text-[11px] bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]"
                  >
                    <span className="font-mono text-[10px] text-[#9A3412] dark:text-[#EA580C] mr-1">
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B635B] dark:text-[#A8A196]">Simpan sebagai:</span>
              <div className="flex items-center p-1 bg-[#F5EFEB] dark:bg-[#151413] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
                {(['thought', 'idea', 'reference'] as NoteType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetNoteType(t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors ${
                      targetNoteType === t
                        ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                        : 'text-[#6B635B] dark:text-[#A8A196]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
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
                <span>Simpan ke Library</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================
           TOPIC SEARCH / MANUAL PICKER + CURATION
           ============================================================ */
        <>
          {/* Topic Search Card + Manual Picker Trigger */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Mulai Penggabungan Pengetahuan
                </h2>
                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5">
                  Masukkan topik untuk menjaring catatan & fragments relevan, atau pilih langsung secara manual.
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

                {manualPickerItems.length === 0 ? (
                  <p className="text-xs text-[#9C9388] py-6 text-center">
                    Tidak ada catatan atau fragment yang cocok.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {manualPickerItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItemSelection(item)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                            isSelected
                              ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#FAF7F2] dark:bg-[#272422]'
                              : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] hover:border-[#D6CEBE]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isSelected
                                ? 'bg-[#9A3412] dark:bg-[#EA580C] border-[#9A3412] dark:border-[#EA580C] text-white'
                                : 'border-[#D6CEBE] dark:border-[#443E3A]'
                            }`}
                          >
                            {isSelected && <Check size={11} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono">
                              <span className="uppercase text-[#9A3412] dark:text-[#EA580C] font-semibold">
                                {item.kind === 'fragment' ? 'Fragment' : 'Catatan'}
                              </span>
                              <span className="text-[#9C9388]">· {item.type}</span>
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
                      Kurasi Bahan Sintesis
                    </h3>
                    <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
                      {selectedItems.length > 0
                        ? `${selectedNotesCount} catatan & ${selectedFragmentsCount} fragments terpilih untuk disatukan.`
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
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItemSelection(item)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                              isSelected
                                ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#FAF7F2] dark:bg-[#272422] shadow-2xs'
                                : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] hover:border-[#D6CEBE]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-1 transition-colors ${
                                isSelected
                                  ? 'bg-[#9A3412] dark:bg-[#EA580C] border-[#9A3412] dark:border-[#EA580C] text-white'
                                  : 'border-[#D6CEBE] dark:border-[#443E3A]'
                              }`}
                            >
                              {isSelected && <Check size={11} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                                <span className="uppercase font-semibold text-[#9A3412] dark:text-[#EA580C]">
                                  {item.kind === 'fragment' ? 'Fragment' : 'Catatan'} · {item.type}
                                </span>
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
                        {selectedItems.length < 2
                          ? 'Pilih minimal 2 bahan agar bisa disintesis.'
                          : `${selectedItems.length} bahan siap digabungkan menjadi 1 dokumen baru.`}
                      </span>
                      <button
                        type="button"
                        onClick={handleRunSynthesis}
                        disabled={selectedItems.length < 2 || isSynthesizing}
                        className="px-5 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-xs"
                      >
                        {isSynthesizing ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Menyusun Dokumen...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>Susun Dokumen Utuh</span>
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
                Gabungkan Catatan Tercecer Jadi Satu Pengetahuan Matang
              </h3>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] max-w-lg mx-auto leading-relaxed">
                Ketik topik di atas atau pilih manual dari arsipmu. Noesis akan mencari keterkaitan antar catatan & fragments lalu menyusunnya menjadi dokumen baru di Library tanpa menghapus catatan aslinya.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
