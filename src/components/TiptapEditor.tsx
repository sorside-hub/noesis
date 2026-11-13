import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useNoesis } from '../context/NoesisContext';
import { ManualNoteType, NoteType } from '../types';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Star,
  Share2,
  MoreVertical,
  ChevronLeft,
  Trash2,
  PanelRight,
  PanelRightClose,
  Plus,
  X,
  ArrowUpRight,
  Sliders,
  Archive,
  BarChart2,
  FileText,
  Sparkles,
  Database,
  Feather,
} from 'lucide-react';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { fetchAllVectorEmbeddings, VectorMapResult } from '../lib/supabase';
import { computeRelatedNoteSuggestions } from '../lib/discoverAi';
import { useVirtualKeyboardOpen } from '../hooks/useVirtualKeyboardOpen';

interface TiptapEditorProps {
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

export const TiptapEditor: React.FC<TiptapEditorProps> = () => {
  const {
    activeNote,
    updateNote,
    deleteNote,
    discardNoteIfEmpty,
    toggleFavoriteNote,
    toggleArchiveNote,
    linkRelatedNote,
    unlinkRelatedNote,
    notes,
    fragments,
    approvedConnections,
    unlinkDiscoverConnection,
    openFragmentDrawer,
    setActiveNoteId,
    setActiveView,
    startUpdateSynthesis,
    createNote,
    manualEmbedNote,
    manualRemoveEmbedNote,
    isCloudflareConnected,
    isSupabaseConnected,
  } = useNoesis();

  const [title, setTitle] = useState(activeNote?.title || '');
  const [isEmbeddingLoading, setIsEmbeddingLoading] = useState(false);
  const [embedNotice, setEmbedNotice] = useState<string | null>(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const isKeyboardOpen = useVirtualKeyboardOpen();
  const activeNoteIdRef = React.useRef(activeNote?.id);
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeNoteIdRef.current = activeNote?.id;
  }, [activeNote?.id]);

  // When switching notes or leaving the editor, if previous note was empty, discard it automatically
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      if (activeNoteIdRef.current) {
        discardNoteIfEmpty(activeNoteIdRef.current);
      }
    };
  }, []);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showMobileInspector, setShowMobileInspector] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Inspector states
  const [newTagInput, setNewTagInput] = useState('');
  const [sourceInput, setSourceInput] = useState(activeNote?.source || '');
  const [searchRelatedQuery, setSearchRelatedQuery] = useState('');
  const [showLinkSearchDropdown, setShowLinkSearchDropdown] = useState(false);
  const [vectorMap, setVectorMap] = useState<VectorMapResult | null>(null);

  // Lazy-load stored vector map when opening Link Note dropdown so Saran Terkait can use BGE-M3 vectors
  useEffect(() => {
    if (!showLinkSearchDropdown || vectorMap !== null || !isSupabaseConnected) return;
    fetchAllVectorEmbeddings()
      .then((res) => {
        if (res) setVectorMap(res);
      })
      .catch(console.warn);
  }, [showLinkSearchDropdown, vectorMap, isSupabaseConnected]);

  // Sync title and source when activeNote changes
  useEffect(() => {
    if (activeNote) {
      setTitle(activeNote.title);
      setSourceInput(activeNote.source || '');
    }
  }, [activeNote?.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#9A3412] dark:text-[#EA580C] underline decoration-[#9A3412]/40 hover:decoration-[#9A3412]',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your thoughts, observations, or draft an essay...',
      }),
    ],
    content: activeNote?.content || '',
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[460px] text-[16px] leading-[1.85] text-[#292524] dark:text-[#E7E5E4] font-normal selection:bg-[#9A3412]/15 selection:text-[#9A3412] dark:selection:bg-[#C2410C]/30 dark:selection:text-[#FDBA74]',
      },
    },
    onFocus: () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      setIsEditorFocused(true);
    },
    onBlur: ({ editor: ed }) => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      blurTimeoutRef.current = setTimeout(() => {
        if (!ed.isDestroyed && !ed.isFocused) {
          setIsEditorFocused(false);
        }
      }, 120);
    },
    onUpdate: ({ editor }) => {
      if (activeNote) {
        const html = editor.getHTML();
        const text = editor.getText();
        updateNote(activeNote.id, {
          content: html,
          excerpt: text.slice(0, 140) + (text.length > 140 ? '...' : ''),
        });
      }
    },
  });

  // When activeNote changes externally, update editor content
  useEffect(() => {
    if (editor && activeNote && editor.getHTML() !== activeNote.content) {
      editor.commands.setContent(activeNote.content || '<p></p>');
    }
  }, [activeNote?.id, editor]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (activeNote) {
      updateNote(activeNote.id, { title: newTitle });
    }
  };

  const handleTriggerEmbed = async () => {
    if (!activeNote) return;
    setIsEmbeddingLoading(true);
    setEmbedNotice(null);
    const ok = await manualEmbedNote(activeNote.id);
    setIsEmbeddingLoading(false);
    if (ok) {
      setEmbedNotice('Embedding bge-m3 tersimpan!');
    } else {
      setEmbedNotice(
        isCloudflareConnected
          ? 'Gagal generate embedding'
          : 'Konfigurasi Cloudflare AI diperlukan di .env'
      );
    }
    setTimeout(() => setEmbedNotice(null), 3500);
  };

  const handleRemoveEmbed = async () => {
    if (!activeNote) return;
    setIsEmbeddingLoading(true);
    await manualRemoveEmbedNote(activeNote.id);
    setIsEmbeddingLoading(false);
    setEmbedNotice('Embedding vektor dihapus');
    setTimeout(() => setEmbedNotice(null), 3000);
  };

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkUrl('');
    setShowLinkDialog(false);
  }, [editor, linkUrl]);

  const handleInsertMockImage = () => {
    if (!editor) return;
    const caption = imageCaption.trim() || 'Archival Study, Noesis Library';
    const figureHtml = `
      <figure class="my-6 border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl p-3 bg-[#FAF7F2] dark:bg-[#1E1C1A]">
        <div class="h-44 sm:h-56 w-full rounded-lg bg-[#ECE4DC] dark:bg-[#272422] flex flex-col items-center justify-center text-[#6B635B] dark:text-[#A8A196]">
          <span class="text-sm font-serif italic">${caption}</span>
          <span class="text-xs uppercase tracking-widest text-[#9C9388] mt-1 font-mono">Visual Plate · Fig. 1</span>
        </div>
        <figcaption class="text-xs font-serif italic text-center mt-2 text-[#6B635B] dark:text-[#A8A196]">${caption}</figcaption>
      </figure>
      <p></p>
    `;
    editor.chain().focus().insertContent(figureHtml).run();
    setImageCaption('');
    setShowImageDialog(false);
  };

  const handleShareNote = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2200);
    setShowActionMenu(false);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote || !newTagInput.trim()) return;
    const cleanTag = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!activeNote.tags.includes(cleanTag)) {
      updateNote(activeNote.id, { tags: [...activeNote.tags, cleanTag] });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeNote) return;
    updateNote(activeNote.id, {
      tags: activeNote.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleSaveSource = () => {
    if (!activeNote) return;
    updateNote(activeNote.id, { source: sourceInput.trim() || undefined });
  };

  const handleTypeChange = (newType: ManualNoteType) => {
    if (!activeNote || activeNote.type === 'synthesis') return;
    updateNote(activeNote.id, { type: newType });
  };

  // Format date helper: "09/11/2026" (DD/MM/YYYY)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Related notes computations
  const relatedNotes = useMemo(() => {
    if (!activeNote || !activeNote.relatedNoteIds) return [];
    return notes.filter((n) => activeNote.relatedNoteIds.includes(n.id));
  }, [activeNote, notes]);

  const unlinkedNotes = useMemo(() => {
    if (!activeNote) return [];
    return notes.filter(
      (n) => n.id !== activeNote.id && !activeNote.relatedNoteIds?.includes(n.id)
    );
  }, [activeNote, notes]);

  const filteredUnlinkedNotes = useMemo(() => {
    if (!searchRelatedQuery.trim()) return unlinkedNotes;
    const q = searchRelatedQuery.toLowerCase();
    return unlinkedNotes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [unlinkedNotes, searchRelatedQuery]);

  // Optional click-to-link suggestions (top 4 closest unlinked notes)
  const suggestedRelatedNotes = useMemo(() => {
    if (!activeNote || unlinkedNotes.length === 0) return [];
    return computeRelatedNoteSuggestions(activeNote, unlinkedNotes, vectorMap, 4);
  }, [activeNote, unlinkedNotes, vectorMap]);

  // Fragments linked to this Note via approved Discover connections
  const relatedFragments = useMemo(() => {
    if (!activeNote || approvedConnections.length === 0) return [];
    const linkedFragIds = new Set<string>();
    for (const pairKey of approvedConnections) {
      const [idA, idB] = pairKey.split('::');
      if (idA === activeNote.id) linkedFragIds.add(idB);
      else if (idB === activeNote.id) linkedFragIds.add(idA);
    }
    return fragments.filter((f) => linkedFragIds.has(f.id));
  }, [activeNote, approvedConnections, fragments]);

  if (!activeNote || !editor) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FAF7F2] dark:bg-[#151413]">
        <div className="w-14 h-14 rounded-2xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mb-4 shadow-2xs">
          <Feather size={24} />
        </div>
        <h3 className="font-serif text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] mb-1.5">
          {notes.length === 0 ? 'Belum Ada Catatan' : 'Pilih Catatan untuk Diedit'}
        </h3>
        <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] max-w-sm mb-6 leading-relaxed font-normal">
          {notes.length === 0
            ? 'Mulai tuangkan pemikiran, ide, atau kutipan pertamamu ke dalam catatan baru.'
            : 'Pilih salah satu catatan dari daftar atau buat catatan baru untuk mulai menulis.'}
        </p>
        <button
          onClick={() => {
            const newId = createNote();
            setActiveNoteId(newId);
          }}
          className="px-5 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-2"
        >
          <Feather size={14} />
          <span>Tulis Catatan Baru</span>
        </button>
      </div>
    );
  }

  const getTypeStyle = (t: NoteType) => {
    switch (t) {
      case 'reference':
        return 'text-[#1E3A8A] dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50';
      case 'thought':
        return 'text-[#9A3412] dark:text-[#EA580C] bg-[#FED7AA]/30 dark:bg-[#431407]/40 border-[#FED7AA] dark:border-[#431407]';
      case 'idea':
        return 'text-[#B45309] dark:text-[#F59E0B] bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50';
      case 'synthesis':
        return 'text-[#6D28D9] dark:text-[#A78BFA] bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/50';
    }
  };

  return (
    <div
      className="flex-1 flex h-full bg-[#FAF7F2] dark:bg-[#151413] relative overflow-hidden"
      onClick={() => setShowActionMenu(false)}
    >
      {/* Main Center Canvas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2]/90 dark:bg-[#151413]/90 backdrop-blur-sm z-10 shrink-0">
          {/* Left: Library Back Navigation & Note Type */}
          <div className="flex items-center gap-2 text-xs truncate">
            <button
              onClick={() => {
                if (activeNote) {
                  discardNoteIfEmpty(activeNote.id);
                }
                setActiveView('library');
              }}
              className="flex items-center gap-1 font-medium text-[#9A3412] dark:text-[#EA580C] hover:underline"
              title="Return to Library"
            >
              <ChevronLeft size={16} />
              <span>Library</span>
            </button>

            <span className="text-[#9C9388]">/</span>

            <span
              className={`inline-flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded border ${getTypeStyle(
                activeNote.type || 'thought'
              )}`}
            >
              {activeNote.type === 'synthesis' && <Sparkles size={10} />}
              <span>{activeNote.type || 'thought'}</span>
            </span>
          </div>

          {/* Right: Embedding Status Dot, Favorite, Document Actions Menu, and Drawer Toggle */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Embedding Status Indicator Dot (Left of Favorite Star) */}
            {(() => {
              const getEmbedStatus = () => {
                if (!activeNote.embeddedAt) {
                  return {
                    label: 'Not Embedded',
                    dotClass: 'bg-stone-400 dark:bg-stone-500',
                    pulse: false,
                    tooltip: 'Status Embedding: Belum Ter-embed',
                  };
                }
                const isOutdated =
                  activeNote.updatedAt &&
                  new Date(activeNote.updatedAt).getTime() - new Date(activeNote.embeddedAt).getTime() > 3000;
                if (isOutdated) {
                  return {
                    label: 'Needs Update',
                    dotClass: 'bg-amber-500 shadow-xs shadow-amber-500/50',
                    pulse: true,
                    tooltip: 'Status Embedding: Butuh Update (Disunting)',
                  };
                }
                return {
                  label: 'Synced & Embedded',
                  dotClass: 'bg-emerald-500 shadow-xs shadow-emerald-500/50',
                  pulse: false,
                  tooltip: 'Status Embedding: Synced & Embedded (Up-to-date)',
                };
              };
              const status = getEmbedStatus();

              return (
                <button
                  type="button"
                  onClick={handleTriggerEmbed}
                  disabled={isEmbeddingLoading}
                  title={`${status.tooltip} — Klik untuk ${activeNote.embeddedAt ? 're-sync' : 'embed'}`}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors text-[#6B635B] dark:text-[#A8A196] group cursor-pointer"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${status.dotClass} ${
                      isEmbeddingLoading ? 'animate-ping' : status.pulse ? 'animate-pulse' : ''
                    }`}
                  />
                  <span className="hidden sm:inline text-[11px] font-mono text-[#9C9388] dark:text-[#736C62] group-hover:text-[#221F1D] dark:group-hover:text-[#EDE8E1] transition-colors">
                    {status.label}
                  </span>
                </button>
              );
            })()}

            {/* 1. Favorite Star (Berdiri Sendiri) */}
            <button
              onClick={() => toggleFavoriteNote(activeNote.id)}
              aria-label="Toggle favorite"
              title={activeNote.favorite ? 'Favorited' : 'Add to Favorites'}
              className={`p-1.5 rounded-lg transition-colors ${
                activeNote.favorite
                  ? 'text-[#B45309] dark:text-[#F59E0B] bg-[#FED7AA]/30 dark:bg-[#431407]/40'
                  : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
              }`}
            >
              <Star size={16} fill={activeNote.favorite ? 'currentColor' : 'none'} />
            </button>

            {/* 2. Document Actions Menu */}
            <div className="relative">
              <button
                onClick={() => setShowActionMenu((prev) => !prev)}
                aria-label="Document actions"
                title="Document Actions"
                className="p-1.5 rounded-lg text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
              >
                <MoreVertical size={16} />
              </button>

              {showActionMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-[#9C9388] border-b border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 mb-1">
                    Document Actions
                  </div>

                  {activeNote.type === 'synthesis' && (
                    <button
                      onClick={() => {
                        setShowActionMenu(false);
                        startUpdateSynthesis(activeNote.id);
                      }}
                      className="w-full px-3 py-1.5 text-xs flex items-center gap-2 text-[#6D28D9] dark:text-[#A78BFA] hover:bg-violet-50 dark:hover:bg-violet-950/30 text-left transition-colors font-medium"
                    >
                      <Sparkles size={14} />
                      <span>Perbarui Sintesis</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      toggleArchiveNote(activeNote.id);
                      setShowActionMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-xs flex items-center gap-2 text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                  >
                    <Archive size={14} />
                    <span>{activeNote.archived ? 'Unarchive Note' : 'Archive Note'}</span>
                  </button>

                  <button
                    onClick={handleShareNote}
                    className="w-full px-3 py-1.5 text-xs flex items-center gap-2 text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] text-left transition-colors"
                  >
                    <Share2 size={14} />
                    <span>Share / Copy Link</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowActionMenu(false);
                      setShowDeleteModal(true);
                    }}
                    className="w-full px-3 py-1.5 text-xs flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-left transition-colors border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 mt-1"
                  >
                    <Trash2 size={14} />
                    <span>Delete Note</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Document Inspector Panel Toggle */}
            <button
              onClick={() => setShowInspector((prev) => !prev)}
              aria-label="Metadata"
              title="Metadata"
              className={`hidden md:flex p-1.5 rounded-lg transition-colors ${
                showInspector
                  ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                  : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
              }`}
            >
              <Sliders size={16} />
            </button>

            {/* Mobile Inspector Trigger */}
            <button
              onClick={() => setShowMobileInspector(true)}
              aria-label="Metadata"
              title="Metadata"
              className="md:hidden p-1.5 rounded-lg text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC]"
            >
              <Sliders size={16} />
            </button>
          </div>
        </div>

        {/* Link Copied Toast */}
        {copiedNotification && (
          <div className="absolute top-14 right-6 z-30 text-xs bg-[#221F1D] text-white px-3 py-1.5 rounded-lg shadow-lg animate-in fade-in duration-200">
            Note link copied to clipboard
          </div>
        )}

        {/* Desktop Minimal Formatting Toolbar (Hidden on Mobile) */}
        {(() => {
          const btnPadding = 'p-1.5';
          const mobileBtnPadding = 'p-2 shrink-0';
          const keepFocus = (e: React.MouseEvent) => e.preventDefault();
          const renderToolbarButtons = (isMobileBar: boolean) => {
            const pad = isMobileBar ? mobileBtnPadding : btnPadding;
            const iconSize = isMobileBar ? 16 : 14;
            return (
              <>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  aria-label="Bold"
                  className={`${pad} rounded text-xs font-semibold transition-colors ${
                    editor.isActive('bold')
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <Bold size={iconSize} />
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  aria-label="Italic"
                  className={`${pad} rounded text-xs transition-colors ${
                    editor.isActive('italic')
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <Italic size={iconSize} />
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  aria-label="Underline"
                  className={`${pad} rounded text-xs transition-colors ${
                    editor.isActive('underline')
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <UnderlineIcon size={iconSize} />
                </button>

                <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-1 shrink-0" />

                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  aria-label="Heading 1"
                  className={`${pad} rounded text-xs font-serif transition-colors ${
                    editor.isActive('heading', { level: 1 })
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <Heading1 size={iconSize} />
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  aria-label="Heading 2"
                  className={`${pad} rounded text-xs font-serif transition-colors ${
                    editor.isActive('heading', { level: 2 })
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <Heading2 size={iconSize} />
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  aria-label="Heading 3"
                  className={`${pad} rounded text-xs font-serif transition-colors ${
                    editor.isActive('heading', { level: 3 })
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <Heading3 size={iconSize} />
                </button>

                <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-1 shrink-0" />

                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  aria-label="Blockquote"
                  className={`${pad} rounded text-xs transition-colors ${
                    editor.isActive('blockquote')
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <Quote size={iconSize} />
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  aria-label="Bullet list"
                  className={`${pad} rounded text-xs transition-colors ${
                    editor.isActive('bulletList')
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <List size={iconSize} />
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  aria-label="Numbered list"
                  className={`${pad} rounded text-xs transition-colors ${
                    editor.isActive('orderedList')
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <ListOrdered size={iconSize} />
                </button>

                <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-1 shrink-0" />

                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => setShowLinkDialog(true)}
                  aria-label="Add link"
                  className={`${pad} rounded text-xs transition-colors ${
                    editor.isActive('link')
                      ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413]'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C]'
                  }`}
                >
                  <LinkIcon size={iconSize} />
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => setShowImageDialog(true)}
                  aria-label="Insert image"
                  className={`${pad} rounded text-xs text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C] transition-colors`}
                >
                  <ImageIcon size={iconSize} />
                </button>
              </>
            );
          };

          const showMobileToolbar =
            isKeyboardOpen &&
            isEditorFocused &&
            !showMobileInspector &&
            !showLinkDialog &&
            !showImageDialog;

          return (
            <>
              <div className="hidden md:flex items-center justify-between px-4 sm:px-6 py-2 border-b border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 bg-[#F5EFEB]/50 dark:bg-[#1E1C1A]/50 shrink-0 overflow-x-auto">
                <div className="flex items-center gap-1 bg-white/70 dark:bg-[#272422]/70 border border-[#E8E2D8] dark:border-[#332F2C] rounded-lg p-0.5 shadow-xs">
                  {renderToolbarButtons(false)}
                </div>

                <div className="hidden md:flex items-center gap-2 text-[11px] text-[#9C9388] dark:text-[#736C62] font-mono">
                  <span>Auto-saved</span>
                </div>
              </div>

              {showMobileToolbar && (
                <div
                  className="md:hidden fixed left-0 right-0 bottom-[var(--noesis-kb-offset,0px)] z-40 bg-[#F5EFEB]/95 dark:bg-[#1E1C1A]/95 backdrop-blur-md border-t border-[#E8E2D8] dark:border-[#2F2B28] px-2.5 py-1.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150"
                  role="toolbar"
                  aria-label="Editor formatting toolbar"
                >
                  <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {renderToolbarButtons(true)}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Link Dialog Modal */}
        {showLinkDialog && (
          <div className="absolute top-16 sm:top-24 left-1/2 -translate-x-1/2 z-30 w-[min(20rem,calc(100vw-2rem))] p-3 bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl shadow-xl">
            <p className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] mb-2">Insert Web Hyperlink</p>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/essay"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] mb-2"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowLinkDialog(false)}
                className="text-xs px-2 py-1 text-[#6B635B] dark:text-[#A8A196] hover:underline"
              >
                Cancel
              </button>
              <button
                onClick={handleSetLink}
                className="text-xs px-3 py-1 bg-[#9A3412] text-white rounded-md hover:bg-[#78280E]"
              >
                Apply Link
              </button>
            </div>
          </div>
        )}

        {/* Image Plate Modal */}
        {showImageDialog && (
          <div className="absolute top-16 sm:top-24 left-1/2 -translate-x-1/2 z-30 w-[min(22rem,calc(100vw-2rem))] p-3 bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl shadow-xl">
            <p className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] mb-1">Insert Archival Visual Plate</p>
            <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] mb-2">
              Add a study illustration or photograph figure placeholder into this essay.
            </p>
            <input
              type="text"
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              placeholder="Caption (e.g., The Solitary Library of Montaigne)"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImageDialog(false)}
                className="text-xs px-2 py-1 text-[#6B635B] dark:text-[#A8A196] hover:underline"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertMockImage}
                className="text-xs px-3 py-1 bg-[#9A3412] text-white rounded-md hover:bg-[#78280E]"
              >
                Insert Plate
              </button>
            </div>
          </div>
        )}

        {/* Prose Editor Scrollable Area - Ultra Clean Canvas without Bottom Bar */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-12 md:px-16 lg:px-24 py-6 sm:py-8 max-w-4xl mx-auto w-full">
          {/* Title Input */}
          <div className="mb-4">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="Untitled Note"
              className="w-full font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight bg-transparent text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none placeholder:text-[#9C9388]/60 dark:placeholder:text-[#736C62]/60 border-none p-0"
            />
          </div>

          <div className="h-px w-full bg-[#E8E2D8] dark:bg-[#2F2B28] my-6" />

          {/* Tiptap Canvas */}
          <EditorContent editor={editor} className="cursor-text pb-24" />
        </div>
      </div>

      {/* Desktop Collapsible Inspector Panel (Metadata: Note type, source, tags, related note, statistic note) */}
      {showInspector && (
        <aside className="hidden md:flex w-80 border-l border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB]/85 dark:bg-[#1A1817]/85 flex-col h-full shrink-0 select-none overflow-y-auto animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders size={15} className="text-[#9A3412] dark:text-[#EA580C]" />
              <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Metadata
              </h3>
            </div>
            <button
              onClick={() => setShowInspector(false)}
              className="p-1 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]"
            >
              <PanelRightClose size={16} />
            </button>
          </div>

          {/* Drawer Content: Strictly 5 Sections */}
          <div className="p-5 space-y-6">
            {/* 1. Note Type */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
                Note Type
              </label>
              {activeNote.type === 'synthesis' ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                      <Sparkles size={12} />
                      <span>Synthesis</span>
                    </span>
                    <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">
                      Otomatis dari Discover
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => startUpdateSynthesis(activeNote.id)}
                    className="w-full py-2 px-3 rounded-xl bg-[#6D28D9] dark:bg-[#7C3AED] text-white text-xs font-medium hover:bg-[#5B21B6] dark:hover:bg-[#6D28D9] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Sparkles size={13} />
                    <span>Perbarui dengan Materi Baru</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-[#221F1E] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
                  {(['thought', 'reference', 'idea'] as ManualNoteType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`py-1.5 px-2 text-xs font-mono uppercase tracking-wider rounded-lg transition-colors ${
                        activeNote.type === t
                          ? 'bg-[#221F1D] text-white dark:bg-[#EDE8E1] dark:text-[#151413] shadow-xs'
                          : 'text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Source / Provenance */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
                Source
              </label>
              <input
                type="text"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                onBlur={handleSaveSource}
                placeholder="e.g. Seneca, Epistulae Morales or Book URL"
                className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            {/* 3. Tags Manager */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
                Tags
              </label>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {activeNote.tags.length === 0 ? (
                  <span className="text-xs text-[#9C9388] italic">No tags assigned</span>
                ) : (
                  activeNote.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]"
                    >
                      <span>#{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-500 font-bold ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              <form onSubmit={handleAddTag} className="flex gap-1.5">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Add new tag..."
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-[#9A3412] text-white rounded-lg text-xs hover:bg-[#78280E]"
                >
                  <Plus size={13} />
                </button>
              </form>
            </div>

            {/* 4. Related Note & Connected Fragments */}
            <div className="space-y-3 pt-3 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
                  Related Note ({relatedNotes.length + relatedFragments.length})
                </label>
                <button
                  onClick={() => setShowLinkSearchDropdown((prev) => !prev)}
                  className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus size={12} />
                  <span>Link Note</span>
                </button>
              </div>

              {showLinkSearchDropdown && (
                <div className="p-2.5 bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl shadow-md space-y-2">
                  <input
                    type="text"
                    value={searchRelatedQuery}
                    onChange={(e) => setSearchRelatedQuery(e.target.value)}
                    placeholder="Search note to link..."
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#332F2C] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                    autoFocus
                  />

                  {/* Optional Click-to-Link Suggestions */}
                  {!searchRelatedQuery.trim() && suggestedRelatedNotes.length > 0 && (
                    <div className="space-y-1 pb-1.5 border-b border-[#E8E2D8] dark:border-[#2F2B28]">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C] flex items-center gap-1 px-1">
                        <Sparkles size={10} />
                        <span>Saran Terkait</span>
                      </div>
                      {suggestedRelatedNotes.map(({ note: noteItem, reason }) => (
                        <div
                          key={`sug-${noteItem.id}`}
                          onClick={() => {
                            linkRelatedNote(activeNote.id, noteItem.id);
                            setShowLinkSearchDropdown(false);
                            setSearchRelatedQuery('');
                          }}
                          className="p-1.5 rounded-lg bg-[#FAF7F2] dark:bg-[#151413] hover:bg-[#F5EFEB] dark:hover:bg-[#272422] cursor-pointer text-xs flex items-center justify-between gap-2"
                        >
                          <span className="font-serif truncate text-[#221F1D] dark:text-[#EDE8E1]">
                            {noteItem.title || 'Untitled Note'}
                          </span>
                          <span className="text-[9px] font-mono text-[#9C9388] shrink-0">
                            {reason === 'vector' ? 'Mirip makna' : 'Mirip konsep'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {filteredUnlinkedNotes.length === 0 ? (
                      <p className="text-[11px] text-[#9C9388] p-1.5 italic">No matching notes</p>
                    ) : (
                      filteredUnlinkedNotes.map((noteItem) => (
                        <div
                          key={noteItem.id}
                          onClick={() => {
                            linkRelatedNote(activeNote.id, noteItem.id);
                            setShowLinkSearchDropdown(false);
                            setSearchRelatedQuery('');
                          }}
                          className="p-1.5 rounded-lg hover:bg-[#F5EFEB] dark:hover:bg-[#272422] cursor-pointer text-xs flex items-center justify-between gap-2"
                        >
                          <span className="font-serif truncate">{noteItem.title || 'Untitled Note'}</span>
                          <span className="text-[10px] font-mono text-[#9C9388] uppercase shrink-0">
                            {noteItem.type}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {relatedNotes.length === 0 && relatedFragments.length === 0 ? (
                  <p className="text-xs text-[#9C9388] italic p-2 bg-white/50 dark:bg-[#221F1E]/50 rounded-xl border border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 text-center">
                    No related note linked.
                  </p>
                ) : (
                  <>
                    {relatedNotes.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between gap-2 group"
                      >
                        <div
                          onClick={() => setActiveNoteId(item.id)}
                          className="cursor-pointer flex-1 truncate"
                          title="Jump to note"
                        >
                          <h5 className="font-serif text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] truncate group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors">
                            {item.title}
                          </h5>
                          <span className="text-[10px] font-mono text-[#9C9388] uppercase">
                            {item.type}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setActiveNoteId(item.id)}
                            className="p-1 text-[#9C9388] hover:text-[#9A3412]"
                            title="Open Note"
                          >
                            <ArrowUpRight size={13} />
                          </button>
                          <button
                            onClick={() => unlinkRelatedNote(activeNote.id, item.id)}
                            className="p-1 text-[#9C9388] hover:text-red-600"
                            title="Unlink note"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {relatedFragments.map((frag) => (
                      <div
                        key={frag.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between gap-2 group"
                      >
                        <div
                          onClick={() => openFragmentDrawer(frag.id)}
                          className="cursor-pointer flex-1 truncate"
                          title="Open fragment"
                        >
                          <h5 className="font-serif text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] truncate group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors">
                            {frag.title}
                          </h5>
                          <span className="text-[10px] font-mono text-[#9A3412] dark:text-[#EA580C] uppercase">
                            Fragment · {frag.type}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openFragmentDrawer(frag.id)}
                            className="p-1 text-[#9C9388] hover:text-[#9A3412]"
                            title="Open Fragment"
                          >
                            <ArrowUpRight size={13} />
                          </button>
                          <button
                            onClick={() => unlinkDiscoverConnection(activeNote.id, frag.id)}
                            className="p-1 text-[#9C9388] hover:text-red-600"
                            title="Unlink fragment"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* 6. Semantic Embedding (bge-m3) */}
            <div className="pt-3 border-t border-[#E8E2D8] dark:border-[#2F2B28] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] flex items-center gap-1">
                  <Sparkles size={12} className="text-[#9A3412] dark:text-[#EA580C]" />
                  <span>Embedding (bge-m3)</span>
                </label>
                <span className="text-[10px] font-mono text-[#9C9388]">1024-dim</span>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">Status Vector:</span>
                {(() => {
                  if (!activeNote.embeddedAt) {
                    return (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono border bg-stone-100 dark:bg-stone-800/60 text-[#9C9388] border-stone-200 dark:border-stone-700">
                        Not Embedded
                      </span>
                    );
                  }
                  const isOutdated =
                    new Date(activeNote.updatedAt).getTime() -
                      new Date(activeNote.embeddedAt).getTime() >
                    3000;
                  if (isOutdated) {
                    return (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40">
                        Needs Update
                      </span>
                    );
                  }
                  return (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40">
                      Synced & Embedded
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTriggerEmbed}
                  disabled={isEmbeddingLoading}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#9A3412] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Sparkles size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                  <span>{isEmbeddingLoading ? 'Embedding...' : activeNote.embeddedAt ? 'Re-sync Embed' : 'Embed Note'}</span>
                </button>

                {activeNote.embeddedAt && (
                  <button
                    type="button"
                    onClick={handleRemoveEmbed}
                    disabled={isEmbeddingLoading}
                    className="py-1.5 px-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-xs text-[#9C9388] hover:text-red-600 transition-colors"
                    title="Hapus vector embedding"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {embedNotice && (
                <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                  {embedNotice}
                </p>
              )}
            </div>

            {/* 7. Timestamps (Created & Updated) */}
            <div className="pt-3 border-t border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between text-[11px] font-mono text-[#9C9388] dark:text-[#736C62]">
              <span>Created {formatDate(activeNote.createdAt)}</span>
              <span>·</span>
              <span>Updated {formatDate(activeNote.updatedAt)}</span>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Drawer Metadata (Bottom Sheet Modal) */}
      {showMobileInspector && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FAF7F2] dark:bg-[#1E1C1A] border-t border-[#E8E2D8] dark:border-[#2F2B28] rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-3">
              <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Metadata
              </h3>
              <button
                onClick={() => setShowMobileInspector(false)}
                className="p-1 text-[#9C9388]"
              >
                <X size={18} />
              </button>
            </div>

            {/* 1. Note Type */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1.5">
                Note Type
              </label>
              {activeNote.type === 'synthesis' ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                      <Sparkles size={12} />
                      <span>Synthesis</span>
                    </span>
                    <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">
                      Otomatis dari Discover
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileInspector(false);
                      startUpdateSynthesis(activeNote.id);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#6D28D9] dark:bg-[#7C3AED] text-white text-xs font-medium hover:bg-[#5B21B6] dark:hover:bg-[#6D28D9] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Sparkles size={13} />
                    <span>Perbarui dengan Materi Baru</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {(['thought', 'reference', 'idea'] as ManualNoteType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`py-2 text-xs font-mono uppercase tracking-wider rounded-xl border text-center ${
                        activeNote.type === t
                          ? 'border-[#9A3412] bg-[#9A3412] text-white'
                          : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Source */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1.5">
                Source
              </label>
              <input
                type="text"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                onBlur={handleSaveSource}
                placeholder="Author, title, or citation"
                className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1]"
              />
            </div>

            {/* 3. Tags */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1.5">
                Tags
              </label>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {activeNote.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28]"
                  >
                    <span>#{tag}</span>
                    <button onClick={() => handleRemoveTag(tag)} className="text-red-500 font-bold ml-0.5">
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddTag} className="flex gap-1.5">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="New tag..."
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-[#9A3412] text-white rounded-lg text-xs"
                >
                  <Plus size={13} />
                </button>
              </form>
            </div>

            {/* 4. Related Note & Connected Fragments */}
            <div className="space-y-2.5 pt-2 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388]">
                  Related Note ({relatedNotes.length + relatedFragments.length})
                </label>
                <button
                  type="button"
                  onClick={() => setShowLinkSearchDropdown((prev) => !prev)}
                  className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus size={12} />
                  <span>Link Note</span>
                </button>
              </div>

              {showLinkSearchDropdown && (
                <div className="p-2.5 bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl space-y-2">
                  <input
                    type="text"
                    value={searchRelatedQuery}
                    onChange={(e) => setSearchRelatedQuery(e.target.value)}
                    placeholder="Search note to link..."
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#332F2C] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />

                  {!searchRelatedQuery.trim() && suggestedRelatedNotes.length > 0 && (
                    <div className="space-y-1 pb-1.5 border-b border-[#E8E2D8] dark:border-[#2F2B28]">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C] flex items-center gap-1 px-1">
                        <Sparkles size={10} />
                        <span>Saran Terkait</span>
                      </div>
                      {suggestedRelatedNotes.map(({ note: noteItem, reason }) => (
                        <div
                          key={`m-sug-${noteItem.id}`}
                          onClick={() => {
                            linkRelatedNote(activeNote.id, noteItem.id);
                            setShowLinkSearchDropdown(false);
                            setSearchRelatedQuery('');
                          }}
                          className="p-1.5 rounded-lg bg-[#FAF7F2] dark:bg-[#151413] text-xs flex items-center justify-between gap-2"
                        >
                          <span className="font-serif truncate text-[#221F1D] dark:text-[#EDE8E1]">
                            {noteItem.title || 'Untitled Note'}
                          </span>
                          <span className="text-[9px] font-mono text-[#9C9388] shrink-0">
                            {reason === 'vector' ? 'Mirip makna' : 'Mirip konsep'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {filteredUnlinkedNotes.length === 0 ? (
                      <p className="text-[11px] text-[#9C9388] p-1.5 italic">No matching notes</p>
                    ) : (
                      filteredUnlinkedNotes.map((noteItem) => (
                        <div
                          key={`m-opt-${noteItem.id}`}
                          onClick={() => {
                            linkRelatedNote(activeNote.id, noteItem.id);
                            setShowLinkSearchDropdown(false);
                            setSearchRelatedQuery('');
                          }}
                          className="p-1.5 rounded-lg hover:bg-[#F5EFEB] dark:hover:bg-[#272422] text-xs flex items-center justify-between gap-2"
                        >
                          <span className="font-serif truncate">{noteItem.title || 'Untitled Note'}</span>
                          <span className="text-[10px] font-mono text-[#9C9388] uppercase shrink-0">
                            {noteItem.type}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {relatedNotes.length === 0 && relatedFragments.length === 0 ? (
                  <p className="text-xs text-[#9C9388] italic p-2 bg-white/50 dark:bg-[#221F1E]/50 rounded-xl border border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 text-center">
                    No related note linked.
                  </p>
                ) : (
                  <>
                    {relatedNotes.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-lg bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between gap-2 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveNoteId(item.id);
                            setShowMobileInspector(false);
                          }}
                          className="font-serif truncate text-left flex-1 text-[#221F1D] dark:text-[#EDE8E1]"
                        >
                          {item.title}
                        </button>
                        <button
                          onClick={() => unlinkRelatedNote(activeNote.id, item.id)}
                          className="text-[#9C9388] hover:text-red-600 shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}

                    {relatedFragments.map((frag) => (
                      <div
                        key={frag.id}
                        className="p-2 rounded-lg bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between gap-2 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowMobileInspector(false);
                            openFragmentDrawer(frag.id);
                          }}
                          className="text-left flex-1 truncate"
                        >
                          <span className="font-serif block truncate text-[#221F1D] dark:text-[#EDE8E1]">
                            {frag.title}
                          </span>
                          <span className="text-[10px] font-mono text-[#9A3412] dark:text-[#EA580C] uppercase">
                            Fragment
                          </span>
                        </button>
                        <button
                          onClick={() => unlinkDiscoverConnection(activeNote.id, frag.id)}
                          className="text-[#9C9388] hover:text-red-600 shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* 6. Semantic Embedding (bge-m3) */}
            <div className="pt-2 border-t border-[#E8E2D8] dark:border-[#2F2B28] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] flex items-center gap-1">
                  <Sparkles size={12} className="text-[#9A3412] dark:text-[#EA580C]" />
                  <span>Embedding (bge-m3)</span>
                </label>
                <span className="text-[10px] font-mono text-[#9C9388]">1024-dim</span>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">Status Vector:</span>
                {(() => {
                  if (!activeNote.embeddedAt) {
                    return (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono border bg-stone-100 dark:bg-stone-800/60 text-[#9C9388] border-stone-200 dark:border-stone-700">
                        Not Embedded
                      </span>
                    );
                  }
                  const isOutdated =
                    new Date(activeNote.updatedAt).getTime() -
                      new Date(activeNote.embeddedAt).getTime() >
                    3000;
                  if (isOutdated) {
                    return (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40">
                        Needs Update
                      </span>
                    );
                  }
                  return (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40">
                      Synced & Embedded
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTriggerEmbed}
                  disabled={isEmbeddingLoading}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#FAF7F2] dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#9A3412] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Sparkles size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                  <span>{isEmbeddingLoading ? 'Embedding...' : activeNote.embeddedAt ? 'Re-sync Embed' : 'Embed Note'}</span>
                </button>

                {activeNote.embeddedAt && (
                  <button
                    type="button"
                    onClick={handleRemoveEmbed}
                    disabled={isEmbeddingLoading}
                    className="py-2 px-3 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-xs text-[#9C9388] hover:text-red-600 transition-colors"
                    title="Hapus vector embedding"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {embedNotice && (
                <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                  {embedNotice}
                </p>
              )}
            </div>

            {/* 7. Timestamps (Created & Updated) */}
            <div className="pt-2 border-t border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between text-[11px] font-mono text-[#9C9388] dark:text-[#736C62]">
              <span>Created {formatDate(activeNote.createdAt)}</span>
              <span>·</span>
              <span>Updated {formatDate(activeNote.updatedAt)}</span>
            </div>

            <button
              onClick={() => setShowMobileInspector(false)}
              className="w-full py-2.5 bg-[#9A3412] text-white rounded-xl text-xs font-medium hover:bg-[#78280E]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          if (activeNote) {
            deleteNote(activeNote.id);
            setShowDeleteModal(false);
            setActiveView('library');
          }
        }}
        itemType="note"
      />
    </div>
  );
};
