import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { ProjectSection, WritingAssistAction } from '../../types';
import { useVirtualKeyboardOpen } from '../../hooks/useVirtualKeyboardOpen';
import { useBackOverlay } from '../../hooks/useBackOverlay';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';
import { createTiptapClipboardProps } from '../../lib/tiptapClipboard';
import { countWordsFromContent } from '../../lib/projectMaster';
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
  CheckCircle2,
  Circle,
  BookOpen,
  ArrowLeft,
  Check,
  FileText,
  Undo2,
  Redo2,
  Sparkles,
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

interface ProjectSectionEditorProps {
  projectId: string;
  section: ProjectSection;
  onUpdateSection: (
    projectId: string,
    sectionId: string,
    updates: Partial<Pick<ProjectSection, 'title' | 'content' | 'status' | 'order'>>
  ) => void;
  onToggleStatus: (projectId: string, sectionId: string) => void;
  onFlushSave: (projectId: string) => void;
  inlineMaster?: boolean;
  isMobileSheet?: boolean;
  onDone?: () => void;
  onOpenQuickReference?: () => void;
  linkedReferencesCount?: number;
  insertRequest?: { nonce: number; html: string } | null;
  projectTitle?: string;
  previousSectionSnippet?: string;
}

export const ProjectSectionEditor: React.FC<ProjectSectionEditorProps> = ({
  projectId,
  section,
  onUpdateSection,
  onToggleStatus,
  onFlushSave,
  inlineMaster = false,
  isMobileSheet = false,
  onDone,
  onOpenQuickReference,
  linkedReferencesCount = 0,
  insertRequest = null,
  projectTitle,
  previousSectionSnippet,
}) => {
  const proseScrollRef = useScrollRestoration<HTMLDivElement>(
    !inlineMaster ? `project-sec:${projectId}:${section.id}` : null
  );

  const [title, setTitle] = useState(section.title || '');
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showAiSheet, setShowAiSheet] = useState(false);
  const [aiSnapshot, setAiSnapshot] = useState<EditorAiSnapshot | null>(null);
  const [aiAutoRunAction, setAiAutoRunAction] = useState<WritingAssistAction | null>(null);
  const [slashTrigger, setSlashTrigger] = useState<SlashTriggerMatch | null>(null);
  const [desktopSelectionCoords, setDesktopSelectionCoords] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const isKeyboardOpen = useVirtualKeyboardOpen();

  // Anti-race refs matching TiptapEditor pattern
  const projectIdRef = useRef(projectId);
  const sectionIdRef = useRef(section.id);
  const onUpdateRef = useRef(onUpdateSection);
  const onFlushRef = useRef(onFlushSave);
  const isSyncingFromPropRef = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedKeyRef = useRef(`${projectId}::${section.id}`);
  const lastConsumedInsertNonceRef = useRef<number>(0);

  onUpdateRef.current = onUpdateSection;
  onFlushRef.current = onFlushSave;

  useBackOverlay(
    showLinkDialog,
    () => setShowLinkDialog(false),
    `project-sec-link-${section.id}`
  );

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
        placeholder: 'Mulai menulis draf, argumen, atau menyusun bahan ke bagian ini...',
      }),
    ],
    content: section.content || '<p></p>',
    editorProps: {
      attributes: {
        class: `tiptap max-w-none focus:outline-none ${
          inlineMaster ? 'min-h-[160px]' : 'min-h-[360px]'
        } text-[15px] sm:text-[16px] leading-[1.8] text-[#292524] dark:text-[#E7E5E4] font-normal selection:bg-[#9A3412]/15 selection:text-[#9A3412] dark:selection:bg-[#C2410C]/30 dark:selection:text-[#FDBA74]`,
      },
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
      onFlushRef.current(projectIdRef.current);
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      blurTimeoutRef.current = setTimeout(() => {
        if (!ed.isDestroyed && !ed.isFocused) {
          setIsEditorFocused(false);
          setDesktopSelectionCoords(null);
        }
      }, 120);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      setSlashTrigger(detectSlashCommandTrigger(ed));
      if (!ed.state.selection.empty) {
        try {
          const coords = ed.view.coordsAtPos(ed.state.selection.from);
          setDesktopSelectionCoords({ left: coords.left, top: coords.top });
        } catch {
          setDesktopSelectionCoords(null);
        }
      } else {
        setDesktopSelectionCoords(null);
      }
    },
    onUpdate: ({ editor: ed }) => {
      setSlashTrigger(detectSlashCommandTrigger(ed));
      if (ed.state.selection.empty) {
        setDesktopSelectionCoords(null);
      }
      if (isSyncingFromPropRef.current) return;
      const html = ed.getHTML();
      onUpdateRef.current(projectIdRef.current, sectionIdRef.current, { content: html });
    },
  });

  // Switch active section cleanly without writing stale HTML across sections
  useEffect(() => {
    const nextKey = `${projectId}::${section.id}`;
    if (loadedKeyRef.current !== nextKey) {
      onFlushRef.current(projectIdRef.current);
      loadedKeyRef.current = nextKey;
      projectIdRef.current = projectId;
      sectionIdRef.current = section.id;
      setTitle(section.title || '');
      setShowAiSheet(false);
      setAiSnapshot(null);
      setAiAutoRunAction(null);
      setSlashTrigger(null);
      setDesktopSelectionCoords(null);
      if (editor && !editor.isDestroyed) {
        isSyncingFromPropRef.current = true;
        editor.commands.setContent(section.content || '<p></p>');
        isSyncingFromPropRef.current = false;
      }
      return;
    }

    // Same section: sync remote updates safely when not actively typing
    if (editor && !editor.isDestroyed && !editor.isFocused) {
      const incoming = section.content || '<p></p>';
      if (editor.getHTML() !== incoming) {
        isSyncingFromPropRef.current = true;
        editor.commands.setContent(incoming);
        isSyncingFromPropRef.current = false;
      }
    }
    setTitle((prev) => (prev !== section.title ? section.title || '' : prev));
  }, [projectId, section.id, section.content, section.title, editor]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      onFlushRef.current(projectIdRef.current);
    };
  }, []);

  // Handle external snippet insertion from Referensi panel / quick sheet
  useEffect(() => {
    if (!insertRequest || !editor || editor.isDestroyed) return;
    if (insertRequest.nonce === lastConsumedInsertNonceRef.current) return;
    lastConsumedInsertNonceRef.current = insertRequest.nonce;
    editor.chain().focus().insertContent(insertRequest.html).run();
  }, [insertRequest, editor]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTitle = e.target.value;
    setTitle(nextTitle);
    onUpdateRef.current(projectIdRef.current, sectionIdRef.current, { title: nextTitle });
  };

  const handleTitleBlur = () => {
    const clean = title.trim() || 'Bagian Tanpa Judul';
    if (clean !== title) {
      setTitle(clean);
      onUpdateRef.current(projectIdRef.current, sectionIdRef.current, { title: clean });
    }
    onFlushRef.current(projectIdRef.current);
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

  const openAiAssistant = useCallback(
    (autoAction?: WritingAssistAction | null) => {
      if (!editor || editor.isDestroyed) return;
      const snapshot = captureEditorAiSnapshot(editor);
      setSlashTrigger(null);
      setDesktopSelectionCoords(null);
      setAiSnapshot(snapshot);
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
      setAiAutoRunAction(item.action === 'open_prompt' ? null : item.action);
      setShowAiSheet(true);
      editor.commands.blur();
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [editor, slashTrigger]
  );

  const wordCount = useMemo(() => countWordsFromContent(section.content || ''), [section.content]);
  const isDone = section.status === 'done';

  if (!editor) return null;

  const btnPadding = 'p-1.5';
  const mobileBtnPadding = 'p-2 shrink-0';
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  const renderToolbarButtons = (isMobileBar: boolean) => {
    const pad = isMobileBar ? mobileBtnPadding : btnPadding;
    const iconSize = isMobileBar ? 16 : 14;
    return (
      <>
        {/* Undo & Redo at leftmost corner */}
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

        <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-1 shrink-0" />

        {/* Inline AI Writing Companion */}
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

        <span className="w-px h-4 bg-[#E8E2D8] dark:bg-[#332F2C] mx-1 shrink-0" />

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
      </>
    );
  };

  const showMobileToolbar = isKeyboardOpen && isEditorFocused && !showLinkDialog && !showAiSheet;

  return (
    <div
      className={`relative flex flex-col bg-white dark:bg-[#1E1C1A] ${
        inlineMaster
          ? 'rounded-xl border border-[#9A3412]/50 dark:border-[#EA580C]/50 shadow-sm'
          : isMobileSheet
          ? 'h-full'
          : 'h-full rounded-2xl border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs overflow-hidden'
      }`}
    >
      {/* Top Action Header */}
      <div
        className={`flex items-center justify-between gap-2 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2]/80 dark:bg-[#221F1E]/85 shrink-0 ${
          isMobileSheet ? 'px-2.5 py-2' : inlineMaster ? 'px-3 py-2' : 'px-4 py-2.5'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isMobileSheet && onDone && (
            <button
              type="button"
              onClick={() => {
                onFlushRef.current(projectIdRef.current);
                onDone();
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] flex items-center gap-1 shrink-0"
            >
              <ArrowLeft size={13} />
              <span>Kembali</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleStatus(projectId, section.id)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors shrink-0 ${
              isDone
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] hover:border-[#9A3412]'
            }`}
          >
            {isDone ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            <span>{isDone ? 'Selesai' : 'Draf'}</span>
          </button>

          <span className="text-[11px] font-mono text-[#9C9388] dark:text-[#736C62] inline-flex items-center gap-1 truncate">
            <FileText size={11} />
            <span>{wordCount.toLocaleString()} kata</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenQuickReference && (
            <button
              type="button"
              onClick={onOpenQuickReference}
              className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[11px] font-medium text-[#9A3412] dark:text-[#EA580C] flex items-center gap-1"
            >
              <BookOpen size={12} />
              <span>Intip Bahan{linkedReferencesCount > 0 ? ` (${linkedReferencesCount})` : ''}</span>
            </button>
          )}

          {inlineMaster && onDone && (
            <button
              type="button"
              onClick={() => {
                onFlushRef.current(projectIdRef.current);
                onDone();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#9A3412] dark:bg-[#EA580C] text-white text-[11px] font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] flex items-center gap-1 transition-colors"
            >
              <Check size={12} />
              <span>Selesai Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Shared Desktop Formatting Toolbar (same controls & feel as TiptapEditor) */}
      <div className="hidden md:flex items-center justify-between px-4 py-2 border-b border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 bg-[#F5EFEB]/50 dark:bg-[#1E1C1A]/50 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1 bg-white/70 dark:bg-[#272422]/70 border border-[#E8E2D8] dark:border-[#332F2C] rounded-lg p-0.5 shadow-xs">
          {renderToolbarButtons(false)}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#9C9388] dark:text-[#736C62] font-mono shrink-0 ml-2">
          <span>Auto-saved</span>
        </div>
      </div>

      {/* Keyboard-aware Floating Mobile Toolbar */}
      {showMobileToolbar && (
        <div
          className="md:hidden fixed left-0 right-0 bottom-[var(--noesis-kb-offset,0px)] z-50 bg-[#F5EFEB]/95 dark:bg-[#1E1C1A]/95 backdrop-blur-md border-t border-[#E8E2D8] dark:border-[#2F2B28] px-2.5 py-1.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150"
          role="toolbar"
          aria-label="Editor formatting toolbar"
        >
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {renderToolbarButtons(true)}
          </div>
        </div>
      )}

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="absolute top-14 sm:top-20 left-1/2 -translate-x-1/2 z-40 w-[min(20rem,calc(100vw-2rem))] p-3 bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-xl shadow-xl">
          <p className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] mb-2">
            Sisipkan Tautan Web
          </p>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] mb-2"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowLinkDialog(false)}
              className="text-xs px-2 py-1 text-[#6B635B] dark:text-[#A8A196] hover:underline"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSetLink}
              className="text-xs px-3 py-1 bg-[#9A3412] dark:bg-[#EA580C] text-white rounded-md hover:bg-[#78280E]"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Editor Canvas */}
      <div
        ref={proseScrollRef}
        className={`${
          inlineMaster
            ? 'px-3 sm:px-5 py-3 sm:py-4'
            : isMobileSheet
            ? 'flex-1 overflow-y-auto px-3 py-3'
            : 'flex-1 overflow-y-auto px-5 sm:px-8 lg:px-10 py-4 sm:py-6'
        }`}
      >
        <div className={inlineMaster ? 'mb-2' : 'mb-3'}>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            placeholder="Judul Bagian / Bab..."
            className={`w-full font-serif font-medium tracking-tight bg-transparent text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none placeholder:text-[#9C9388]/60 dark:placeholder:text-[#736C62]/60 border-none p-0 ${
              inlineMaster ? 'text-xl sm:text-2xl' : 'text-xl sm:text-3xl'
            }`}
          />
        </div>

        <div className="h-px w-full bg-[#E8E2D8] dark:bg-[#2F2B28] mb-3 sm:mb-4" />

        <EditorContent
          editor={editor}
          className={`cursor-text ${inlineMaster ? 'pb-4' : 'pb-20'}`}
        />
      </div>

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

      {/* AI Inline Writing Companion Sheet */}
      <EditorAiSheet
        isOpen={showAiSheet}
        onClose={() => setShowAiSheet(false)}
        contextKind="project"
        snapshot={aiSnapshot}
        title={title}
        projectTitle={projectTitle}
        sectionTitle={title || section.title}
        previousSectionSnippet={previousSectionSnippet}
        autoRunAction={aiAutoRunAction}
        onConsumeAutoRun={() => setAiAutoRunAction(null)}
        onApply={(html, applyMode) => {
          if (editor && aiSnapshot) {
            applyAiHtmlToEditor(editor, aiSnapshot, html, applyMode);
          }
        }}
        overlayKey={`project-ai-sheet-${projectId}-${section.id}`}
      />
    </div>
  );
};
