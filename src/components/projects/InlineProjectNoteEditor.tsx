import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Note, WritingAssistAction } from '../../types';
import { useNoesis } from '../../context/NoesisContext';
import { cleanTextForEmbedding } from '../../lib/cloudflareEmbedding';
import { useVirtualKeyboardOpen } from '../../hooks/useVirtualKeyboardOpen';
import { useBackOverlay } from '../../hooks/useBackOverlay';
import { createTiptapClipboardProps } from '../../lib/tiptapClipboard';
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
  Sparkles,
  BookOpen,
  ArrowLeft,
  Check,
  FileText,
  Undo2,
  Redo2,
  MessageSquareText,
  Maximize2,
  X,
} from 'lucide-react';
import {
  EditorAiSheet,
  SlashCommandMenu,
  SlashCommandItem,
  SlashTriggerMatch,
  EditorAiSnapshot,
  captureEditorAiSnapshot,
  applyAiHtmlToEditor,
  detectSlashCommandTrigger,
} from '../EditorAiAssistant';

interface InlineProjectNoteEditorProps {
  note: Note;
  compact?: boolean;
  onDone: () => void;
  onOpenFullEditor?: (noteId: string) => void;
  onBack?: () => void;
  backLabel?: string;
  onClose?: () => void;
  autoFocusTitle?: boolean;
}

const countWords = (rawHtml: string): number => {
  const cleaned = cleanTextForEmbedding(rawHtml || '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
};

export const InlineProjectNoteEditor: React.FC<InlineProjectNoteEditorProps> = ({
  note,
  compact = false,
  onDone,
  onOpenFullEditor,
  onBack,
  backLabel = 'Daftar Bahan',
  onClose,
  autoFocusTitle = false,
}) => {
  const { updateNote, flushNoteSave, flushNoteOnExit } = useNoesis();

  const [title, setTitle] = useState(note.title || '');
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [showAiSheet, setShowAiSheet] = useState(false);
  const showAiSheetRef = useRef(false);
  showAiSheetRef.current = showAiSheet;
  const [aiInitialTab, setAiInitialTab] = useState<'edit' | 'ask'>('edit');
  const [aiSnapshot, setAiSnapshot] = useState<EditorAiSnapshot | null>(null);
  const [aiAutoRunAction, setAiAutoRunAction] = useState<WritingAssistAction | null>(null);
  const [slashTrigger, setSlashTrigger] = useState<SlashTriggerMatch | null>(null);
  const [desktopSelectionCoords, setDesktopSelectionCoords] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const isKeyboardOpen = useVirtualKeyboardOpen();
  const proseScrollRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Anti-race refs matching TiptapEditor & ProjectSectionEditor patterns
  const noteIdRef = useRef(note.id);
  const loadedNoteIdRef = useRef(note.id);
  const isSyncingFromPropRef = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateNoteRef = useRef(updateNote);
  updateNoteRef.current = updateNote;
  const flushNoteSaveRef = useRef(flushNoteSave);
  flushNoteSaveRef.current = flushNoteSave;
  const flushNoteOnExitRef = useRef(flushNoteOnExit);
  flushNoteOnExitRef.current = flushNoteOnExit;

  useBackOverlay(showLinkDialog, () => setShowLinkDialog(false), `project-inline-note-link-${note.id}`);
  useBackOverlay(showImageDialog, () => setShowImageDialog(false), `project-inline-note-img-${note.id}`);

  const clipboardProps = useMemo(
    () => createTiptapClipboardProps({ minHeadingLevel: 1, maxHeadingLevel: 3 }),
    []
  );

  const editor = useEditor({
    enableCoreExtensions: {
      clipboardTextSerializer: false,
    },
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
          class:
            'text-[#9A3412] dark:text-[#EA580C] underline decoration-[#9A3412]/40 hover:decoration-[#9A3412]',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your thoughts, observations, or draft an essay...',
      }),
    ],
    content: note.content || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'tiptap max-w-none focus:outline-none min-h-[200px] md:min-h-[300px] text-[15px] leading-[1.8] text-[#292524] dark:text-[#E7E5E4] font-normal selection:bg-[#9A3412]/15 selection:text-[#9A3412] dark:selection:bg-[#C2410C]/30 dark:selection:text-[#FDBA74]',
      },
      scrollThreshold: { top: 24, right: 0, bottom: 32, left: 0 },
      scrollMargin: { top: 24, right: 0, bottom: 32, left: 0 },
      ...clipboardProps,
    },
    onFocus: () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      setIsEditorFocused(true);
    },
    onBlur: ({ editor: ed }) => {
      if (noteIdRef.current) {
        flushNoteSaveRef.current(noteIdRef.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      blurTimeoutRef.current = setTimeout(() => {
        if (!ed.isDestroyed && !ed.isFocused) {
          setIsEditorFocused(false);
          setDesktopSelectionCoords(null);
        }
      }, 140);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const nextSlash = detectSlashCommandTrigger(ed);
      setSlashTrigger((prev) => {
        if (!prev && !nextSlash) return prev;
        if (
          prev &&
          nextSlash &&
          prev.from === nextSlash.from &&
          prev.to === nextSlash.to &&
          prev.query === nextSlash.query
        ) {
          return prev;
        }
        return nextSlash;
      });
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && !ed.state.selection.empty) {
        try {
          const coords = ed.view.coordsAtPos(ed.state.selection.from);
          setDesktopSelectionCoords({ left: coords.left, top: coords.top });
        } catch {
          setDesktopSelectionCoords(null);
        }
      } else {
        setDesktopSelectionCoords((prev) => (prev === null ? prev : null));
      }
      if (showAiSheetRef.current) {
        setAiSnapshot(captureEditorAiSnapshot(ed));
      }
    },
    onUpdate: ({ editor: ed }) => {
      setSlashTrigger(detectSlashCommandTrigger(ed));
      if (ed.state.selection.empty) {
        setDesktopSelectionCoords(null);
      }
      if (isSyncingFromPropRef.current) return;
      const currentId = noteIdRef.current;
      if (currentId) {
        const html = ed.getHTML();
        const text = ed.getText();
        updateNoteRef.current(currentId, {
          content: html,
          excerpt: text.slice(0, 140) + (text.length > 140 ? '...' : ''),
        });
      }
    },
  });

  // Switch active note cleanly or sync external changes
  useEffect(() => {
    if (loadedNoteIdRef.current !== note.id) {
      const prevId = loadedNoteIdRef.current;
      if (prevId) {
        void flushNoteOnExitRef.current(prevId, true);
      }
      loadedNoteIdRef.current = note.id;
      noteIdRef.current = note.id;
      setTitle(note.title || '');
      setShowAiSheet(false);
      setAiSnapshot(null);
      setAiAutoRunAction(null);
      setSlashTrigger(null);
      setDesktopSelectionCoords(null);
      setShowLinkDialog(false);
      setShowImageDialog(false);
      if (editor && !editor.isDestroyed) {
        isSyncingFromPropRef.current = true;
        editor.commands.setContent(note.content || '<p></p>');
        isSyncingFromPropRef.current = false;
      }
      return;
    }

    noteIdRef.current = note.id;
    if (editor && !editor.isDestroyed && !editor.isFocused) {
      const incoming = note.content || '<p></p>';
      if (editor.getHTML() !== incoming) {
        isSyncingFromPropRef.current = true;
        editor.commands.setContent(incoming);
        isSyncingFromPropRef.current = false;
      }
    }
    if (
      typeof document === 'undefined' ||
      document.activeElement !== titleInputRef.current
    ) {
      setTitle((prev) => (prev !== (note.title || '') ? note.title || '' : prev));
    }
  }, [note.id, note.content, note.title, editor]);

  // Desktop-only auto-focus title when creating a brand new note inline
  useEffect(() => {
    if (!autoFocusTitle) return;
    if (typeof window === 'undefined' || window.innerWidth < 768) return;
    const t = setTimeout(() => {
      titleInputRef.current?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [autoFocusTitle, note.id]);

  // Flush & trigger auto-embed on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      if (noteIdRef.current) {
        void flushNoteOnExitRef.current(noteIdRef.current, true);
      }
    };
  }, []);

  useEffect(() => {
    if (!slashTrigger) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSlashTrigger(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slashTrigger]);

  // Keep caret comfortably visible inside scroll container when mobile keyboard opens/resizes
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    if (!isKeyboardOpen || !isEditorFocused || !editor || editor.isDestroyed) return;

    const container = proseScrollRef.current;
    if (!container) return;

    const adjustCaretVisibility = () => {
      if (!editor || editor.isDestroyed || !editor.isFocused) return;
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.head);
        const rect = container.getBoundingClientRect();
        const bottomMargin = 28;
        const topMargin = 20;
        if (coords.bottom > rect.bottom - bottomMargin) {
          container.scrollTop += coords.bottom - (rect.bottom - bottomMargin);
        } else if (coords.top < rect.top + topMargin) {
          container.scrollTop -= rect.top + topMargin - coords.top;
        }
      } catch {
        // Ignore transient selection coords errors
      }
    };

    const raf = requestAnimationFrame(adjustCaretVisibility);
    const timer = setTimeout(adjustCaretVisibility, 200);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', adjustCaretVisibility);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      vv?.removeEventListener('resize', adjustCaretVisibility);
    };
  }, [isKeyboardOpen, isEditorFocused, editor]);

  const openAiAssistant = useCallback(
    (autoAction?: WritingAssistAction | null, tab: 'edit' | 'ask' = 'edit') => {
      if (!editor || editor.isDestroyed) return;
      const snapshot = captureEditorAiSnapshot(editor);
      setSlashTrigger(null);
      setDesktopSelectionCoords(null);
      setAiSnapshot(snapshot);
      setAiInitialTab(tab);
      setAiAutoRunAction(autoAction ?? null);
      setShowAiSheet(true);
      editor.commands.blur();
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [editor]
  );

  const handleSlashSelect = useCallback(
    (item: SlashCommandItem) => {
      if (!editor || editor.isDestroyed || !slashTrigger) return;
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashTrigger.from, to: slashTrigger.to })
        .run();
      const snapshot = captureEditorAiSnapshot(editor);
      setSlashTrigger(null);
      setDesktopSelectionCoords(null);
      setAiSnapshot(snapshot);
      if (item.action === 'open_ask') {
        setAiInitialTab('ask');
        setAiAutoRunAction(null);
      } else {
        setAiInitialTab('edit');
        setAiAutoRunAction(item.action === 'open_prompt' ? null : item.action);
      }
      setShowAiSheet(true);
      editor.commands.blur();
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [editor, slashTrigger]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    updateNoteRef.current(note.id, { title: newTitle });
  };

  const handleTitleBlur = () => {
    if (title !== note.title) {
      updateNoteRef.current(note.id, { title });
    }
    flushNoteSaveRef.current(note.id);
  };

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl.trim()) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run();
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

  const handleFinishInlineEdit = () => {
    if (title !== note.title) {
      updateNoteRef.current(note.id, { title });
    }
    void flushNoteOnExitRef.current(note.id, true);
    onDone();
  };

  const handleOpenFull = () => {
    if (title !== note.title) {
      updateNoteRef.current(note.id, { title });
    }
    flushNoteSaveRef.current(note.id);
    onOpenFullEditor?.(note.id);
  };

  const wordCount = useMemo(() => countWords(note.content || ''), [note.content]);
  const isSynthesis = note.type === 'synthesis';

  if (!editor) return null;

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
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo"
          title="Undo"
          className={`${pad} rounded text-xs transition-colors text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C] disabled:opacity-35 disabled:pointer-events-none`}
        >
          <Undo2 size={iconSize} />
        </button>
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo"
          title="Redo"
          className={`${pad} rounded text-xs transition-colors text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#332F2C] disabled:opacity-35 disabled:pointer-events-none`}
        >
          <Redo2 size={iconSize} />
        </button>

        <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-0.5 shrink-0" />

        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => openAiAssistant()}
          aria-label="AI Pendamping Menulis"
          title="AI Pendamping Menulis (atau ketik / di baris baru)"
          className={`${
            isMobileBar ? 'px-2.5 py-1.5 shrink-0' : 'px-2 py-1'
          } rounded text-xs font-medium transition-colors inline-flex items-center gap-1 text-[#9A3412] dark:text-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 hover:bg-[#9A3412]/15 dark:hover:bg-[#EA580C]/25 cursor-pointer`}
        >
          <Sparkles size={isMobileBar ? 14 : 13} />
          <span className="text-[11px] leading-none">AI</span>
        </button>

        <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-0.5 shrink-0" />

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

        <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-0.5 shrink-0" />

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

        <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-0.5 shrink-0" />

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

        <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-0.5 shrink-0" />

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
    isKeyboardOpen && isEditorFocused && !showLinkDialog && !showImageDialog && !showAiSheet;

  return (
    <div
      className={`relative flex flex-col h-full min-h-0 bg-white dark:bg-[#1E1C1A] ${
        compact
          ? 'rounded-xl border border-[#9A3412]/50 dark:border-[#EA580C]/50 shadow-xs'
          : 'rounded-2xl border border-[#9A3412]/50 dark:border-[#EA580C]/50 shadow-xs'
      } overflow-hidden`}
    >
      {/* Top Action Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2]/85 dark:bg-[#221F1E]/90 shrink-0 ${
          compact ? 'px-3 py-2' : 'px-4 sm:px-5 py-2.5'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                if (title !== note.title) {
                  updateNoteRef.current(note.id, { title });
                }
                void flushNoteOnExitRef.current(note.id, true);
                onBack();
              }}
              className="px-2 py-1 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[11px] font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={12} />
              <span>{backLabel}</span>
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider font-medium ${
              isSynthesis
                ? 'bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C] border-[#9A3412]/25 dark:border-[#EA580C]/30'
                : 'bg-[#FAF7F2] dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] border-[#E8E2D8] dark:border-[#2F2B28]'
            }`}
          >
            {isSynthesis ? <Sparkles size={11} /> : <BookOpen size={11} />}
            <span>{isSynthesis ? 'Synthesis' : `Catatan · ${note.type}`}</span>
          </span>
          <span className="text-[11px] font-mono text-[#9C9388] dark:text-[#736C62] flex items-center gap-1">
            <FileText size={11} />
            <span>{wordCount.toLocaleString()} kata</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (showAiSheet && aiInitialTab === 'ask') {
                setShowAiSheet(false);
              } else {
                openAiAssistant(null, 'ask');
              }
            }}
            aria-label="Ask Noesis Copilot"
            title="Ask Noesis (Copilot)"
            className={`px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              showAiSheet && aiInitialTab === 'ask'
                ? 'bg-[#9A3412] dark:bg-[#EA580C] text-white'
                : 'text-[#9A3412] dark:text-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 hover:bg-[#9A3412]/15 dark:hover:bg-[#EA580C]/25'
            }`}
          >
            <MessageSquareText size={12} />
            <span className="text-[11px] font-medium leading-none">Ask</span>
          </button>

          {onOpenFullEditor && (
            <button
              type="button"
              onClick={handleOpenFull}
              title="Buka Editor Penuh (Metadata, Tags & Related Notes)"
              className="px-2 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[#221F1D] dark:text-[#EDE8E1] text-[11px] font-medium hover:border-[#9A3412] transition-colors flex items-center gap-1"
            >
              <Maximize2 size={11} />
              <span>{compact ? 'Penuh' : 'Editor Penuh'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFinishInlineEdit}
            className="px-2.5 py-1.5 rounded-lg bg-[#9A3412] dark:bg-[#EA580C] text-white text-[11px] font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors flex items-center gap-1 shadow-2xs"
          >
            <Check size={12} />
            <span>Selesai</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                if (title !== note.title) {
                  updateNoteRef.current(note.id, { title });
                }
                void flushNoteOnExitRef.current(note.id, true);
                onClose();
              }}
              aria-label="Tutup pratinjau"
              className="p-1.5 rounded-lg text-[#6B635B] dark:text-[#A8A196] hover:bg-[#E8E2D8]/50 dark:hover:bg-[#2F2B28]"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Formatting Toolbar (same controls & feel as TiptapEditor, wraps neatly in narrow split pane) */}
      <div className="hidden md:flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 bg-[#F5EFEB]/50 dark:bg-[#1E1C1A]/50 shrink-0">
        <div className="flex flex-wrap items-center gap-0.5 bg-white/70 dark:bg-[#272422]/70 border border-[#E8E2D8] dark:border-[#332F2C] rounded-lg p-0.5 shadow-xs">
          {renderToolbarButtons(false)}
        </div>
      </div>

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-[min(19rem,calc(100%-1.5rem))] p-3 bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl shadow-xl">
          <p className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] mb-2">
            Insert Web Hyperlink
          </p>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com/essay"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] mb-2"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowLinkDialog(false)}
              className="text-xs px-2 py-1 text-[#6B635B] dark:text-[#A8A196] hover:underline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSetLink}
              className="text-xs px-3 py-1 bg-[#9A3412] dark:bg-[#EA580C] text-white rounded-md hover:bg-[#78280E]"
            >
              Apply Link
            </button>
          </div>
        </div>
      )}

      {/* Image Plate Modal */}
      {showImageDialog && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-[min(20rem,calc(100%-1.5rem))] p-3 bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl shadow-xl">
          <p className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] mb-1">
            Insert Archival Visual Plate
          </p>
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
              type="button"
              onClick={() => setShowImageDialog(false)}
              className="text-xs px-2 py-1 text-[#6B635B] dark:text-[#A8A196] hover:underline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsertMockImage}
              className="text-xs px-3 py-1 bg-[#9A3412] dark:bg-[#EA580C] text-white rounded-md hover:bg-[#78280E]"
            >
              Insert Plate
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Editor Canvas */}
      <div
        ref={proseScrollRef}
        className={`noesis-editor-scroll flex-1 min-h-0 overflow-y-auto ${
          compact ? 'px-3.5 py-3.5' : 'px-5 sm:px-7 py-4 sm:py-5'
        }`}
      >
        <div className="mb-2.5">
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            placeholder="Untitled Note"
            className={`w-full font-serif font-medium tracking-tight bg-transparent text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none placeholder:text-[#9C9388]/60 dark:placeholder:text-[#736C62]/60 border-none p-0 ${
              compact ? 'text-xl' : 'text-2xl sm:text-3xl'
            }`}
          />
        </div>

        <div className="h-px w-full bg-[#E8E2D8] dark:bg-[#2F2B28] mb-3" />

        <EditorContent editor={editor} className="cursor-text pb-6 md:pb-16" />
      </div>

      {/* Mobile Formatting Toolbar: Static flex footer pinned cleanly above virtual keyboard */}
      {showMobileToolbar && (
        <div
          onMouseDown={keepFocus}
          className="md:hidden shrink-0 z-20 bg-[#F5EFEB] dark:bg-[#1E1C1A] border-t border-[#E8E2D8] dark:border-[#2F2B28] px-2.5 py-1.5"
          role="toolbar"
          aria-label="Editor formatting toolbar"
        >
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {renderToolbarButtons(true)}
          </div>
        </div>
      )}

      {/* Desktop-only Floating AI Selection Pill */}
      {desktopSelectionCoords && !showAiSheet && isEditorFocused && (
        <div
          style={{
            left:
              typeof window !== 'undefined'
                ? Math.max(12, Math.min(desktopSelectionCoords.left, window.innerWidth - 160))
                : desktopSelectionCoords.left,
            top: Math.max(58, desktopSelectionCoords.top - 42),
          }}
          className="hidden md:flex fixed z-30 animate-in fade-in duration-100"
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openAiAssistant()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-lg text-xs font-medium text-[#9A3412] dark:text-[#EA580C] hover:border-[#9A3412] dark:hover:border-[#EA580C] transition-colors cursor-pointer"
          >
            <Sparkles size={13} />
            <span>AI Pendamping</span>
          </button>
        </div>
      )}

      {/* Slash Command Menu (/...) */}
      {!showAiSheet && (
        <SlashCommandMenu
          trigger={slashTrigger}
          onSelect={handleSlashSelect}
          onClose={() => setSlashTrigger(null)}
        />
      )}

      {/* AI Inline Writing Companion + Ask Noesis Copilot Sheet */}
      <EditorAiSheet
        isOpen={showAiSheet}
        onClose={() => setShowAiSheet(false)}
        contextKind="note"
        noteId={note.id}
        initialTab={aiInitialTab}
        snapshot={aiSnapshot}
        getLatestSnapshot={() =>
          editor && !editor.isDestroyed ? captureEditorAiSnapshot(editor) : null
        }
        title={title}
        noteType={note.type}
        autoRunAction={aiAutoRunAction}
        onConsumeAutoRun={() => setAiAutoRunAction(null)}
        onApply={(html, applyMode, targetSnapshot) => {
          const snap = targetSnapshot || aiSnapshot;
          if (editor && snap) {
            applyAiHtmlToEditor(editor, snap, html, applyMode);
          }
        }}
        overlayKey={`project-inline-note-ai-${note.id}`}
      />
    </div>
  );
};
