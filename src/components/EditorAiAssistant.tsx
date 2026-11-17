import React, { useEffect, useState, useRef, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Sparkles,
  X,
  Loader2,
  Send,
  Check,
  Copy,
  RefreshCw,
  ArrowDownToLine,
  Replace,
  AlertCircle,
  MessageSquareText,
  Wand2,
  Minimize2,
  Maximize2,
  ListChecks,
  Lightbulb,
  FileText,
  PenLine,
  AtSign,
  BookmarkPlus,
  Trash2,
  FilePlus2,
  ExternalLink,
  FileCode2,
} from 'lucide-react';
import {
  CopilotChatMessage,
  CopilotContextAttachment,
  WritingAssistAction,
  WritingAssistMode,
  WritingAssistResult,
} from '../types';
import { useNoesis } from '../context/NoesisContext';
import { requestAskNoesis, requestWritingAssist } from '../lib/discoverAi';
import {
  clearCopilotMessages,
  loadCopilotMessages,
  loadCopilotSession,
  sanitizeCopilotMessages,
  saveCopilotMessages,
} from '../lib/copilotStorage';
import {
  deleteCopilotChatFromSupabase,
  fetchCopilotChatFromSupabase,
  upsertCopilotChatToSupabase,
} from '../lib/supabase';
import { AiProcessBadge } from './discover/AiProcessBadge';
import { useBackOverlay } from '../hooks/useBackOverlay';

export interface EditorAiSnapshot {
  mode: WritingAssistMode;
  from: number;
  to: number;
  selectedText: string;
  surroundingBefore: string;
  surroundingAfter: string;
  documentExcerpt: string;
  fullText?: string;
}

export interface SlashTriggerMatch {
  from: number;
  to: number;
  query: string;
  coords: { left: number; top: number; bottom: number };
}

const stripUnsafeHtml = (raw: string): string => {
  if (!raw) return '';
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
};

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const formatInlineMarkdown = (escapedLine: string): string => {
  return escapedLine
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
};

export const copilotMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length <= 2 ? 'h3' : 'h4';
      out.push(`<${level}>${formatInlineMarkdown(escapeHtml(headingMatch[2]))}</${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        `<blockquote><p>${quoteLines
          .map((l) => formatInlineMarkdown(escapeHtml(l)))
          .join('<br />')}</p></blockquote>`
      );
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      out.push(
        `<ul>${items
          .map((item) => `<li>${formatInlineMarkdown(escapeHtml(item))}</li>`)
          .join('')}</ul>`
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      out.push(
        `<ol>${items
          .map((item) => `<li>${formatInlineMarkdown(escapeHtml(item))}</li>`)
          .join('')}</ol>`
      );
      continue;
    }

    // Paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4}\s+|>\s?|[-*•]\s+|\d+[.)]\s+)/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      out.push(
        `<p>${paraLines
          .map((l) => formatInlineMarkdown(escapeHtml(l)))
          .join('<br />')}</p>`
      );
    }
  }

  return out.join('');
};

export const captureEditorAiSnapshot = (editor: Editor): EditorAiSnapshot => {
  const { from, to, empty } = editor.state.selection;
  const doc = editor.state.doc;
  const maxSize = doc.content.size;
  const safeFrom = Math.max(0, Math.min(from, maxSize));
  const safeTo = Math.max(safeFrom, Math.min(to, maxSize));

  const selectedText = !empty
    ? doc.textBetween(safeFrom, safeTo, '\n\n', ' ').trim()
    : '';

  const beforeStart = Math.max(0, safeFrom - 2800);
  const afterEnd = Math.min(maxSize, safeTo + 1200);
  const surroundingBefore = doc.textBetween(beforeStart, safeFrom, '\n\n', ' ').trim();
  const surroundingAfter = doc.textBetween(safeTo, afterEnd, '\n\n', ' ').trim();

  const fullText = editor.getText().trim();
  const documentExcerpt =
    fullText.length <= 5500
      ? fullText
      : `${fullText.slice(0, 3500)}\n\n[...]\n\n${fullText.slice(-1500)}`;

  return {
    mode: selectedText.length > 0 ? 'selection' : 'cursor',
    from: safeFrom,
    to: safeTo,
    selectedText,
    surroundingBefore,
    surroundingAfter,
    documentExcerpt,
    fullText,
  };
};

export const applyAiHtmlToEditor = (
  editor: Editor,
  snapshot: EditorAiSnapshot,
  html: string,
  applyMode: 'replace' | 'insert_below' | 'insert_cursor'
) => {
  const cleanHtml = stripUnsafeHtml(html).trim();
  if (!cleanHtml || editor.isDestroyed) return;

  const maxSize = editor.state.doc.content.size;

  if (applyMode === 'replace') {
    const from = Math.max(0, Math.min(snapshot.from, maxSize));
    const to = Math.max(from, Math.min(snapshot.to, maxSize));
    editor.chain().focus().insertContentAt({ from, to }, cleanHtml).run();
    return;
  }

  if (applyMode === 'insert_below') {
    const safeTo = Math.max(0, Math.min(snapshot.to, maxSize));
    const $to = editor.state.doc.resolve(safeTo);
    const blockEndPos =
      $to.depth >= 1
        ? Math.min($to.after(1), maxSize)
        : safeTo;
    editor.chain().focus().insertContentAt(blockEndPos, cleanHtml).run();
    return;
  }

  // insert_cursor
  const pos = Math.max(0, Math.min(snapshot.from, maxSize));
  editor.chain().focus().insertContentAt(pos, cleanHtml).run();
};

export const detectSlashCommandTrigger = (editor: Editor): SlashTriggerMatch | null => {
  if (!editor || editor.isDestroyed) return null;
  const { selection } = editor.state;
  if (!selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;

  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\n', ' ');
  const match = textBeforeCursor.match(/(?:^|\s)(\/([a-zA-Z]{0,12}))$/);
  if (!match) return null;

  const slashToken = match[1]; // e.g. "/" or "/lanjut"
  const query = (match[2] || '').toLowerCase();
  const to = selection.from;
  const from = to - slashToken.length;

  try {
    const coords = editor.view.coordsAtPos(to);
    return {
      from,
      to,
      query,
      coords: { left: coords.left, top: coords.top, bottom: coords.bottom },
    };
  } catch {
    return {
      from,
      to,
      query,
      coords: { left: 24, top: 120, bottom: 144 },
    };
  }
};

export interface SlashCommandItem {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  action: WritingAssistAction | 'open_prompt' | 'open_ask';
}

const SLASH_ITEMS: SlashCommandItem[] = [
  {
    id: 'open_ask',
    label: 'Tanya Ask Noesis (Copilot)',
    hint: 'Diskusi argumen, cari celah logika, & @mention catatan',
    keywords: ['ai', 'ask', 'tanya', 'copilot', 'noesis', 'uji', 'kritik'],
    action: 'open_ask',
  },
  {
    id: 'continue',
    label: 'Lanjutkan menulis',
    hint: 'Teruskan paragraf dari posisi kursor',
    keywords: ['ai', 'lanjut', 'lanjutkan', 'continue', 'tulis'],
    action: 'continue',
  },
  {
    id: 'ideas',
    label: 'Ide & sudut pandang',
    hint: 'Opsi arah argumen atau contoh lanjutan',
    keywords: ['ai', 'ide', 'ideas', 'kerangka', 'outline', 'poin'],
    action: 'ideas',
  },
  {
    id: 'summarize',
    label: 'Ringkas tulisan',
    hint: 'Buat ringkasan padat dari isi saat ini',
    keywords: ['ai', 'ringkas', 'rangkum', 'summary', 'summarize'],
    action: 'summarize',
  },
  {
    id: 'open_prompt',
    label: 'Edit / Tulis AI bebas...',
    hint: 'Buka instruksi edit cepat di panel AI',
    keywords: ['ai', 'edit', 'prompt', 'bantu', 'custom'],
    action: 'open_prompt',
  },
];

interface SlashCommandMenuProps {
  trigger: SlashTriggerMatch | null;
  onSelect: (item: SlashCommandItem) => void;
  onClose: () => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  trigger,
  onSelect,
  onClose,
}) => {
  if (!trigger) return null;

  const q = trigger.query;
  const filtered = q
    ? SLASH_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keywords.some((kw) => kw.startsWith(q))
      )
    : SLASH_ITEMS;

  if (filtered.length === 0) return null;

  const safeLeft =
    typeof window !== 'undefined'
      ? Math.max(12, Math.min(trigger.coords.left, window.innerWidth - 276))
      : 24;
  const preferAbove =
    typeof window !== 'undefined' && trigger.coords.bottom > window.innerHeight - 260;
  const desktopTop = preferAbove
    ? Math.max(60, trigger.coords.top - 236)
    : trigger.coords.bottom + 8;

  return (
    <>
      {/* Backdrop click to dismiss silently */}
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />

      {/* Desktop floating menu near cursor; Mobile fixed safely above keyboard toolbar */}
      <div
        style={
          typeof window !== 'undefined' && window.innerWidth >= 768
            ? { left: safeLeft, top: desktopTop }
            : undefined
        }
        className="fixed z-40 left-3 right-3 bottom-[calc(var(--noesis-kb-offset,0px)+54px)] md:bottom-auto md:right-auto md:w-72 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xl overflow-hidden animate-in fade-in duration-100"
      >
        <div className="px-2.5 py-1.5 border-b border-[#E8E2D8]/80 dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C]">
            <Sparkles size={10} />
            <span>AI Perintah Cepat</span>
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] p-0.5"
            aria-label="Tutup menu slash"
          >
            <X size={12} />
          </button>
        </div>

        <div className="p-1 divide-y divide-[#E8E2D8]/40 dark:divide-[#2F2B28]/40">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item)}
              className="w-full px-2.5 py-2 text-left rounded-lg hover:bg-[#FAF7F2] dark:hover:bg-[#272422] transition-colors flex items-start gap-2 cursor-pointer"
            >
              {item.action === 'open_ask' ? (
                <MessageSquareText
                  size={13}
                  className="text-[#9A3412] dark:text-[#EA580C] shrink-0 mt-0.5"
                />
              ) : (
                <Sparkles
                  size={13}
                  className="text-[#9A3412] dark:text-[#EA580C] shrink-0 mt-0.5"
                />
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] truncate">
                  {item.label}
                </div>
                <div className="text-[10px] text-[#9C9388] dark:text-[#736C62] truncate">
                  {item.hint}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

interface EditorAiSheetProps {
  isOpen: boolean;
  onClose: () => void;
  contextKind: 'note' | 'project';
  snapshot: EditorAiSnapshot | null;
  getLatestSnapshot?: () => EditorAiSnapshot | null;
  noteId?: string;
  initialTab?: 'edit' | 'ask';
  title?: string;
  noteType?: string;
  projectTitle?: string;
  sectionTitle?: string;
  previousSectionSnippet?: string;
  autoRunAction?: WritingAssistAction | null;
  onConsumeAutoRun?: () => void;
  onApply: (
    html: string,
    applyMode: 'replace' | 'insert_below' | 'insert_cursor',
    targetSnapshot?: EditorAiSnapshot
  ) => void;
  overlayKey: string;
}

const SELECTION_PRESETS: {
  id: WritingAssistAction;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: 'polish', label: 'Rapikan', icon: Wand2 },
  { id: 'shorten', label: 'Persingkat', icon: Minimize2 },
  { id: 'expand', label: 'Perluas', icon: Maximize2 },
  { id: 'bullets', label: 'Jadikan Poin', icon: ListChecks },
  { id: 'critique', label: 'Uji Argumen', icon: MessageSquareText },
];

const CURSOR_PRESETS: {
  id: WritingAssistAction;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: 'continue', label: 'Lanjutkan', icon: PenLine },
  { id: 'ideas', label: 'Ide Lanjutan', icon: Lightbulb },
  { id: 'summarize', label: 'Ringkas Tulisan', icon: FileText },
];

const ASK_QUICK_STARTERS: { label: string; prompt: string }[] = [
  {
    label: 'Kelemahan argumen?',
    prompt:
      'Apakah ada kelemahan logika, asumsi tersembunyi, atau klaim yang kurang kuat dalam tulisan ini?',
  },
  {
    label: 'Sudut pandang kontra',
    prompt:
      'Sebagai devil’s advocate, apa argumen kontra terkuat terhadap pemikiran yang aku tulis di sini?',
  },
  {
    label: 'Cek alur & kejelasan',
    prompt:
      'Bagian mana dari tulisan ini yang alurnya terasa lompat, kurang jelas, atau berpotensi bikin pembaca salah paham?',
  },
  {
    label: 'Pertanyaan pendalaman',
    prompt:
      'Ajukan 3 pertanyaan tajam yang bisa membantuku memperdalam atau menajamkan catatan ini.',
  },
];

export const EditorAiSheet: React.FC<EditorAiSheetProps> = ({
  isOpen,
  onClose,
  contextKind,
  snapshot,
  getLatestSnapshot,
  noteId,
  initialTab = 'edit',
  title,
  noteType,
  projectTitle,
  sectionTitle,
  previousSectionSnippet,
  autoRunAction,
  onConsumeAutoRun,
  onApply,
  overlayKey,
}) => {
  const {
    notes,
    fragments,
    createFragment,
    createNoteFromCopilot,
    setActiveNoteId,
    setActiveView,
    authUser,
    isSupabaseConnected,
  } = useNoesis();

  const [activeTab, setActiveTab] = useState<'edit' | 'ask'>(initialTab);

  // Edit tab state
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WritingAssistResult | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    action: WritingAssistAction;
    custom?: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Ask Noesis Copilot state (persisted locally + synced via Supabase copilot_chats)
  const sessionKey = noteId ? `note:${noteId}` : overlayKey;
  const [chatMessages, setChatMessages] = useState<CopilotChatMessage[]>(() =>
    loadCopilotMessages(sessionKey)
  );
  const [askInput, setAskInput] = useState('');
  const [isAskLoading, setIsAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<CopilotContextAttachment[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [savedFragmentMsgId, setSavedFragmentMsgId] = useState<string | null>(null);
  const [savedNoteByMsgId, setSavedNoteByMsgId] = useState<Record<string, string>>({});
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false);
  const [selectionDismissed, setSelectionDismissed] = useState(false);

  const requestSeqRef = useRef(0);
  const askSeqRef = useRef(0);
  const sessionSyncSeqRef = useRef(0);
  const lastSelectedTextRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const askInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useBackOverlay(isOpen && !isLoading && !isAskLoading, onClose, overlayKey);

  const persistChatUpdate = (nextMessages: CopilotChatMessage[], targetKey = sessionKey) => {
    const nowIso = new Date().toISOString();
    const clean = sanitizeCopilotMessages(nextMessages);
    saveCopilotMessages(targetKey, clean, nowIso);
    if (isSupabaseConnected && authUser && clean.length > 0) {
      void upsertCopilotChatToSupabase(targetKey, clean, nowIso);
    }
  };

  // Reset selection dismissal only when highlighted text actually changes
  useEffect(() => {
    const currentSel = snapshot?.selectedText?.trim() || '';
    if (currentSel !== lastSelectedTextRef.current) {
      lastSelectedTextRef.current = currentSel;
      setSelectionDismissed(false);
    }
  }, [snapshot?.selectedText]);

  // Auto-reset Hapus Chat confirmation after 3 seconds
  useEffect(() => {
    if (!confirmDeleteChat) return;
    const timer = setTimeout(() => setConfirmDeleteChat(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDeleteChat]);

  // Load local session immediately when switching between notes/sections, then sync with Supabase
  useEffect(() => {
    setChatMessages(loadCopilotMessages(sessionKey));
    setAttachments([]);
    setAskError(null);
    setShowMentionPicker(false);
    setMentionQuery('');
    setConfirmDeleteChat(false);
    setSavedNoteByMsgId({});
  }, [sessionKey]);

  useEffect(() => {
    if (!isSupabaseConnected || !authUser || !sessionKey) return;
    if (!isOpen && activeTab !== 'ask') return;

    const seq = ++sessionSyncSeqRef.current;
    const syncRemote = async () => {
      const local = loadCopilotSession(sessionKey);
      const remote = await fetchCopilotChatFromSupabase(sessionKey);
      if (sessionSyncSeqRef.current !== seq) return;

      const localTs = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteTs = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

      if (remote.messages && remote.messages.length > 0 && (!local || remoteTs > localTs)) {
        const cleanRemote = sanitizeCopilotMessages(remote.messages);
        saveCopilotMessages(sessionKey, cleanRemote, remote.updatedAt);
        setChatMessages(cleanRemote);
      } else if (
        local &&
        local.messages.length > 0 &&
        !remote.tableMissing &&
        (!remote.messages || remote.messages.length === 0 || localTs > remoteTs)
      ) {
        void upsertCopilotChatToSupabase(
          sessionKey,
          sanitizeCopilotMessages(local.messages),
          local.updatedAt
        );
      }
    };

    void syncRemote();
  }, [sessionKey, isOpen, activeTab, isSupabaseConnected, authUser]);

  // Listen for live Supabase realtime updates on copilot_chats from other devices
  useEffect(() => {
    if (!isSupabaseConnected || !authUser || !sessionKey) return;

    const handleCopilotSync = async (e: Event) => {
      const detail = (e as CustomEvent<{ sessionKey?: string }>).detail;
      if (!detail?.sessionKey || detail.sessionKey !== sessionKey) return;

      const remote = await fetchCopilotChatFromSupabase(sessionKey);
      if (remote.tableMissing) return;

      if (remote.messages === null) {
        clearCopilotMessages(sessionKey);
        setChatMessages([]);
        return;
      }

      const local = loadCopilotSession(sessionKey);
      const localTs = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteTs = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      if (!local || remoteTs >= localTs) {
        const cleanRemote = sanitizeCopilotMessages(remote.messages);
        saveCopilotMessages(sessionKey, cleanRemote, remote.updatedAt);
        setChatMessages(cleanRemote);
      }
    };

    window.addEventListener('noesis-copilot-sync', handleCopilotSync);
    return () => window.removeEventListener('noesis-copilot-sync', handleCopilotSync);
  }, [sessionKey, isSupabaseConnected, authUser]);

  // Auto-scroll chat to latest message when Ask tab is visible
  useEffect(() => {
    if (!isOpen || activeTab !== 'ask') return;
    const el = chatScrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [isOpen, activeTab, chatMessages.length, isAskLoading]);

  // Reset transient UI state whenever drawer opens fresh
  useEffect(() => {
    if (!isOpen) {
      requestSeqRef.current += 1;
      askSeqRef.current += 1;
      setIsLoading(false);
      setIsAskLoading(false);
      return;
    }

    setActiveTab(autoRunAction ? 'edit' : initialTab);
    setError(null);
    setResult(null);
    setLastRequest(null);
    setCustomPrompt('');
    setIsCopied(false);
    setAskError(null);
    setShowMentionPicker(false);

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const isTouchOrMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth < 768 || window.matchMedia?.('(pointer: coarse)').matches);

    if (!autoRunAction && !isTouchOrMobile) {
      const timer = setTimeout(() => {
        if (initialTab === 'ask') {
          askInputRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      }, 90);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialTab, autoRunAction]);

  // Candidate archive notes & fragments for @mention attachment
  const mentionCandidates = useMemo<CopilotContextAttachment[]>(() => {
    const q = mentionQuery.trim().toLowerCase();
    const noteItems: CopilotContextAttachment[] = notes
      .filter((n) => !n.archived && n.id !== noteId)
      .map((n) => ({
        id: n.id,
        kind: 'note',
        title: n.title || 'Catatan Tanpa Judul',
        type: n.type,
        content: n.content || '',
      }));
    const fragItems: CopilotContextAttachment[] = fragments.map((f) => ({
      id: f.id,
      kind: 'fragment',
      title: f.title || 'Fragment Tanpa Judul',
      type: f.type,
      content: f.content || '',
    }));

    const attachedIds = new Set(attachments.map((a) => a.id));
    const merged = [...noteItems, ...fragItems].filter((item) => !attachedIds.has(item.id));
    if (!q) return merged.slice(0, 14);
    return merged
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q)
      )
      .slice(0, 14);
  }, [notes, fragments, noteId, attachments, mentionQuery]);

  const runAssist = async (action: WritingAssistAction, promptOverride?: string) => {
    const currentSnapshot = getLatestSnapshot?.() || snapshot;
    if (!currentSnapshot || isLoading) return;
    const seq = ++requestSeqRef.current;
    const usedPrompt = promptOverride !== undefined ? promptOverride : customPrompt;

    setIsLoading(true);
    setError(null);
    setIsCopied(false);
    setLastRequest({ action, custom: usedPrompt });

    try {
      const isSel = currentSnapshot.mode === 'selection' && Boolean(currentSnapshot.selectedText.trim());
      const res = await requestWritingAssist({
        contextKind,
        mode: isSel ? 'selection' : 'cursor',
        action,
        customPrompt: usedPrompt.trim() || undefined,
        selectedText: isSel ? currentSnapshot.selectedText : '',
        title,
        surroundingBefore: isSel ? '' : currentSnapshot.surroundingBefore,
        surroundingAfter: isSel ? '' : currentSnapshot.surroundingAfter,
        documentExcerpt: isSel
          ? ''
          : currentSnapshot.fullText || currentSnapshot.documentExcerpt,
        projectTitle,
        sectionTitle,
        previousSectionSnippet: isSel ? '' : previousSectionSnippet,
        noteType,
      });

      if (requestSeqRef.current !== seq) return;
      setResult(res);
    } catch (err: any) {
      if (requestSeqRef.current !== seq) return;
      setError(err?.message || 'Gagal memproses pendamping AI.');
    } finally {
      if (requestSeqRef.current === seq) {
        setIsLoading(false);
      }
    }
  };

  // Trigger autoRunAction if opened via slash command
  useEffect(() => {
    if (isOpen && autoRunAction && snapshot) {
      const actionToRun = autoRunAction;
      onConsumeAutoRun?.();
      setActiveTab('edit');
      void runAssist(actionToRun, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoRunAction, snapshot]);

  const sendAskMessage = async (textOverride?: string) => {
    const cleanText = (textOverride ?? askInput).trim();
    if (!cleanText || isAskLoading) return;

    const currentSnapshot = getLatestSnapshot?.() || snapshot;
    const latestRawSelected = currentSnapshot?.selectedText?.trim() || '';
    const activeSelectedText = !selectionDismissed ? latestRawSelected : '';
    const seq = ++askSeqRef.current;

    const userMsg: CopilotChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: cleanText,
      createdAt: new Date().toISOString(),
      attachedTitles:
        attachments.length > 0 ? attachments.map((a) => a.title) : undefined,
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    persistChatUpdate(nextHistory, sessionKey);
    if (textOverride === undefined) {
      setAskInput('');
    }
    setShowMentionPicker(false);
    setMentionQuery('');
    setAskError(null);
    setConfirmDeleteChat(false);
    setIsAskLoading(true);

    try {
      const res = await requestAskNoesis({
        contextKind,
        title,
        noteType,
        projectTitle,
        sectionTitle,
        // Strict scoping: if text is highlighted, send ONLY the highlighted block;
        // if nothing is highlighted, send the full document/section.
        selectedText: activeSelectedText || undefined,
        documentText: activeSelectedText
          ? ''
          : currentSnapshot?.fullText || currentSnapshot?.documentExcerpt || '',
        attachments,
        messages: nextHistory.slice(-14).map((m) => ({
          role: m.role,
          text: m.text,
        })),
      });

      if (askSeqRef.current !== seq) return;

      const assistantMsg: CopilotChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        createdAt: new Date().toISOString(),
        modelUsed: res.modelUsed,
        fallbackUsed: res.fallbackUsed,
        aiTrace: res.aiTrace,
      };
      const completedHistory = [...nextHistory, assistantMsg];
      setChatMessages(completedHistory);
      persistChatUpdate(completedHistory, sessionKey);
    } catch (err: any) {
      if (askSeqRef.current !== seq) return;
      setAskError(err?.message || 'Gagal menghubungi Ask Noesis.');
    } finally {
      if (askSeqRef.current === seq) {
        setIsAskLoading(false);
      }
    }
  };

  const handleAskInputChange = (val: string) => {
    setAskInput(val);
    const mentionMatch = val.match(/(?:^|\s)@([^\s@]{0,28})$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1] || '');
      setShowMentionPicker(true);
    } else if (showMentionPicker && !val.includes('@')) {
      setShowMentionPicker(false);
      setMentionQuery('');
    }
  };

  const handleAttachMention = (item: CopilotContextAttachment) => {
    setAttachments((prev) => {
      if (prev.some((a) => a.id === item.id) || prev.length >= 4) return prev;
      return [...prev, item];
    });
    // Strip trailing @query token if user triggered picker via '@'
    setAskInput((prev) => prev.replace(/(?:^|\s)@[^\s@]{0,28}$/, (m) => (m.startsWith(' ') ? ' ' : '')));
    setShowMentionPicker(false);
    setMentionQuery('');
    requestAnimationFrame(() => askInputRef.current?.focus());
  };

  const handleDeleteChat = () => {
    if (!confirmDeleteChat) {
      setConfirmDeleteChat(true);
      return;
    }
    setConfirmDeleteChat(false);
    askSeqRef.current += 1;
    setIsAskLoading(false);
    setAskError(null);
    setChatMessages([]);
    clearCopilotMessages(sessionKey);
    if (isSupabaseConnected && authUser) {
      void deleteCopilotChatFromSupabase(sessionKey);
    }
  };

  const handleCopyMessage = (msg: CopilotChatMessage) => {
    navigator.clipboard?.writeText(msg.text);
    setCopiedMsgId(msg.id);
    setTimeout(() => setCopiedMsgId(null), 1600);
  };

  const handleInsertMessageToNote = (msg: CopilotChatMessage) => {
    const html = copilotMarkdownToHtml(msg.text);
    if (!html) return;
    const latest = getLatestSnapshot?.() || snapshot || undefined;
    const mode = latest?.mode === 'selection' ? 'insert_below' : 'insert_cursor';
    onApply(html, mode, latest);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose();
    }
  };

  const handleSaveMessageAsFragment = (msg: CopilotChatMessage) => {
    const html = copilotMarkdownToHtml(msg.text);
    const firstLine = msg.text
      .split('\n')
      .map((l) => l.replace(/^[#>*\-\d.\s]+/, '').trim())
      .find(Boolean);
    const fragTitle = (firstLine || 'Insight Ask Noesis').slice(0, 64);

    createFragment({
      type: 'thought',
      title: fragTitle,
      content: html || `<p>${escapeHtml(msg.text)}</p>`,
      tags: ['ask-noesis'],
      source: title ? `Ask Noesis · ${title}` : 'Ask Noesis',
    });

    setSavedFragmentMsgId(msg.id);
    setTimeout(() => setSavedFragmentMsgId(null), 2000);
  };

  const handleSaveMessageAsNote = (msg: CopilotChatMessage) => {
    const html = copilotMarkdownToHtml(msg.text) || `<p>${escapeHtml(msg.text)}</p>`;
    const firstLine = msg.text
      .split('\n')
      .map((l) => l.replace(/^[#>*\-\d.\s]+/, '').trim())
      .find(Boolean);
    const noteTitle = (firstLine || 'Catatan dari Ask Noesis').slice(0, 72);

    const newNoteId = createNoteFromCopilot({
      title: noteTitle,
      content: html,
      tags: ['ask-noesis'],
      source: title ? `Ask Noesis · ${title}` : 'Ask Noesis',
      sourceNoteId: contextKind === 'note' ? noteId : undefined,
      type: 'thought',
    });

    setSavedNoteByMsgId((prev) => ({ ...prev, [msg.id]: newNoteId }));
  };

  if (!isOpen || !snapshot) return null;

  const isSelectionMode = snapshot.mode === 'selection';
  const presets = isSelectionMode ? SELECTION_PRESETS : CURSOR_PRESETS;
  const selectedWordCount = snapshot.selectedText
    ? snapshot.selectedText.split(/\s+/).filter(Boolean).length
    : 0;

  const rawSelectedText = snapshot.selectedText?.trim() || '';
  const effectiveAskSelectedText = !selectionDismissed ? rawSelectedText : '';
  const isAskSelectionFocus = effectiveAskSelectedText.length > 0;
  const askSelectedWordCount = effectiveAskSelectedText
    ? effectiveAskSelectedText.split(/\s+/).filter(Boolean).length
    : 0;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim() || isLoading) return;
    void runAssist('custom', customPrompt);
  };

  const handleCopy = () => {
    if (!result?.plainText) return;
    navigator.clipboard?.writeText(result.plainText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1600);
  };

  const isAskTab = activeTab === 'ask';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center transition-colors ${
        isAskTab
          ? 'bg-black/45 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none md:justify-end md:pointer-events-none'
          : 'md:items-center md:p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150'
      }`}
      onClick={() => {
        if (!isLoading && !isAskLoading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal={!isAskTab ? 'true' : undefined}
        aria-label={isAskTab ? 'Ask Noesis Copilot' : 'AI Pendamping Menulis'}
        onClick={(e) => e.stopPropagation()}
        className={`pointer-events-auto w-full bg-[#FAF7F2] dark:bg-[#1E1C1A] border-t md:border border-[#E8E2D8] dark:border-[#2F2B28] shadow-2xl flex flex-col overflow-hidden ${
          isAskTab
            ? 'h-[86dvh] max-h-[88dvh] rounded-t-2xl md:h-full md:max-h-none md:w-[400px] lg:w-[440px] md:rounded-none md:border-t-0 md:border-r-0 md:border-b-0 animate-in slide-in-from-bottom md:slide-in-from-right duration-150'
            : 'md:max-w-xl max-h-[82vh] md:max-h-[84vh] rounded-t-2xl md:rounded-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-150'
        }`}
      >
        {/* Header with 2-Tab Switcher (Edit | Ask Noesis) */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB]/90 dark:bg-[#151413] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center shrink-0">
              {isAskTab ? <MessageSquareText size={14} /> : <Sparkles size={14} />}
            </div>

            <div className="inline-flex items-center p-0.5 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  activeTab === 'edit'
                    ? 'bg-[#9A3412] dark:bg-[#EA580C] text-white shadow-2xs'
                    : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                }`}
              >
                <Wand2 size={11} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ask')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  activeTab === 'ask'
                    ? 'bg-[#9A3412] dark:bg-[#EA580C] text-white shadow-2xs'
                    : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                }`}
              >
                <MessageSquareText size={11} />
                <span>Ask Noesis</span>
              </button>
            </div>

            {!isAskTab && (
              <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]">
                {isSelectionMode
                  ? `Blok · ${selectedWordCount} kata`
                  : contextKind === 'project'
                  ? 'Seluruh Bagian'
                  : 'Seluruh Catatan'}
              </span>
            )}
            {!isAskTab && result && (
              <AiProcessBadge
                featureName="AI Pendamping Editor"
                modelUsed={result.modelUsed}
                fallbackUsed={result.fallbackUsed}
                aiTrace={result.aiTrace}
                overlayKey={`${overlayKey}-trace`}
              />
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isAskTab && chatMessages.length > 0 && (
              <button
                type="button"
                disabled={isAskLoading}
                onClick={handleDeleteChat}
                title="Hapus riwayat chat Ask Noesis secara permanen"
                className={`px-2 py-1 rounded-lg text-[11px] font-medium disabled:opacity-45 transition-colors inline-flex items-center gap-1 cursor-pointer ${
                  confirmDeleteChat
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'text-[#6B635B] dark:text-[#A8A196] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                }`}
              >
                <Trash2 size={12} />
                <span>{confirmDeleteChat ? 'Hapus?' : 'Hapus Chat'}</span>
              </button>
            )}
            <button
              type="button"
              disabled={isLoading || isAskLoading}
              onClick={onClose}
              aria-label="Tutup AI Panel"
              className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ================================================================
            TAB 1: EDIT / WRITE ASSISTANT
           ================================================================ */}
        {activeTab === 'edit' ? (
          <>
            <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-3 overscroll-contain">
              {isSelectionMode && (
                <div className="px-3 py-2 rounded-xl bg-white/75 dark:bg-[#221F1E]/75 border border-[#E8E2D8] dark:border-[#2F2B28]">
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-0.5">
                    Teks terpilih ({selectedWordCount} kata)
                  </span>
                  <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-2 italic leading-relaxed">
                    “{snapshot.selectedText}”
                  </p>
                </div>
              )}

              <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={isLoading}
                  placeholder={
                    isSelectionMode
                      ? 'Instruksi edit (mis. ubah nada lebih santai, buat analogi...)'
                      : 'Minta AI tulis sesuatu (mis. buatkan contoh konkret...)'
                  }
                  className="flex-1 min-w-0 text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
                />
                <button
                  type="submit"
                  disabled={!customPrompt.trim() || isLoading}
                  aria-label="Kirim instruksi ke AI"
                  className="px-3 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-45 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                >
                  {isLoading && lastRequest?.action === 'custom' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((preset) => {
                  const Icon = preset.icon;
                  const isActive = lastRequest?.action === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void runAssist(preset.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                        isActive
                          ? 'bg-[#9A3412]/10 dark:bg-[#EA580C]/20 border-[#9A3412]/40 dark:border-[#EA580C]/40 text-[#9A3412] dark:text-[#EA580C]'
                          : 'bg-white dark:bg-[#221F1E] border-[#E8E2D8] dark:border-[#2F2B28] text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] dark:hover:border-[#EA580C]'
                      }`}
                    >
                      <Icon size={12} className="text-[#9A3412] dark:text-[#EA580C] shrink-0" />
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              {isLoading && (
                <div className="p-4 rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-center gap-2.5 text-xs text-[#6B635B] dark:text-[#A8A196]">
                  <Loader2 size={15} className="animate-spin text-[#9A3412] dark:text-[#EA580C] shrink-0" />
                  <span>AI sedang menyusun draf yang selaras dengan tulisanmu...</span>
                </div>
              )}

              {error && !isLoading && (
                <div className="p-3 rounded-xl bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-red-500 hover:text-red-700 p-0.5"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {result && !isLoading && (
                <div className="rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] overflow-hidden animate-in fade-in duration-150">
                  {result.summaryNote && (
                    <div className="px-3 py-2 border-b border-[#E8E2D8]/80 dark:border-[#2F2B28] bg-[#FAF7F2]/70 dark:bg-[#151413]/60 text-[11px] text-[#6B635B] dark:text-[#A8A196] flex items-center justify-between gap-2">
                      <span>{result.summaryNote}</span>
                      {result.isAdvisoryOnly && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C] shrink-0">
                          Tinjauan
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className="p-3.5 max-h-56 overflow-y-auto text-[14px] leading-relaxed text-[#221F1D] dark:text-[#EDE8E1] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-[#9A3412]/40 [&_blockquote]:pl-3 [&_blockquote]:italic"
                    dangerouslySetInnerHTML={{
                      __html: stripUnsafeHtml(result.resultHtml),
                    }}
                  />
                </div>
              )}
            </div>

            {result && !isLoading && (
              <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 border-t border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB]/70 dark:bg-[#151413] flex items-center justify-between gap-2 flex-wrap shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 py-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                  </button>

                  {lastRequest && (
                    <button
                      type="button"
                      onClick={() => void runAssist(lastRequest.action, lastRequest.custom)}
                      className="px-2.5 py-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      <span>Ulangi</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  {isSelectionMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onApply(result.resultHtml, 'insert_below');
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] dark:hover:border-[#EA580C] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowDownToLine size={13} />
                        <span>Sisipkan di Bawah</span>
                      </button>
                      {!result.isAdvisoryOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            onApply(result.resultHtml, 'replace');
                            onClose();
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Replace size={13} />
                          <span>Ganti Teks</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onApply(result.resultHtml, 'insert_cursor');
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowDownToLine size={13} />
                      <span>Sisipkan di Kursor</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ================================================================
             TAB 2: ASK NOESIS (OBSIDIAN COPILOT STYLE)
             ================================================================ */
          <>
            {/* Context Bar (Active Note + Strict Focus Scope + Optional @mentions) */}
            <div className="px-3.5 py-2 border-b border-[#E8E2D8]/80 dark:border-[#2F2B28] bg-white/60 dark:bg-[#191715] flex flex-wrap items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[10px] font-mono text-[#6B635B] dark:text-[#A8A196] max-w-[180px]">
                <FileCode2 size={10} className="text-[#9A3412] dark:text-[#EA580C] shrink-0" />
                <span className="truncate">
                  {title || (contextKind === 'project' ? 'Bagian Aktif' : 'Catatan Aktif')}
                </span>
              </span>

              {isAskSelectionFocus ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#9A3412]/10 dark:bg-[#EA580C]/15 border border-[#9A3412]/25 dark:border-[#EA580C]/30 text-[#9A3412] dark:text-[#EA580C]">
                  <span>Fokus: Blok ({askSelectedWordCount} kata)</span>
                  <button
                    type="button"
                    onClick={() => setSelectionDismissed(true)}
                    title="Lepas fokus blok dan baca seluruh catatan"
                    aria-label="Lepas fokus blok teks"
                    className="hover:text-[#78280E] dark:hover:text-white ml-0.5 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]">
                  Fokus: {contextKind === 'project' ? 'Seluruh Bagian' : 'Seluruh Catatan'}
                </span>
              )}

              {attachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F5EFEB] dark:bg-[#2A2623] border border-[#9A3412]/30 dark:border-[#EA580C]/30 text-[10px] font-mono text-[#221F1D] dark:text-[#EDE8E1] max-w-[165px]"
                >
                  <span className="text-[#9A3412] dark:text-[#EA580C] shrink-0">@</span>
                  <span className="truncate">{att.title}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="text-[#9C9388] hover:text-red-500 ml-0.5 cursor-pointer"
                    aria-label={`Hapus konteks ${att.title}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}

              {attachments.length < 4 && (
                <button
                  type="button"
                  onClick={() => {
                    setMentionQuery('');
                    setShowMentionPicker((prev) => !prev);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono transition-colors cursor-pointer ${
                    showMentionPicker
                      ? 'border-[#9A3412] dark:border-[#EA580C] text-[#9A3412] dark:text-[#EA580C] bg-[#9A3412]/10'
                      : 'border-dashed border-[#D6CEBE] dark:border-[#3A3531] text-[#6B635B] dark:text-[#A8A196] hover:border-[#9A3412]'
                  }`}
                  title="Sertakan catatan/fragment lain ke obrolan (atau ketik @)"
                >
                  <AtSign size={10} />
                  <span>Konteks</span>
                </button>
              )}
            </div>

            {/* Chat Messages Scroll Area */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 overscroll-contain"
            >
              {chatMessages.length === 0 ? (
                <div className="space-y-4 py-2">
                  <div className="space-y-1">
                    <p className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                      Tanya atau uji tulisanmu
                    </p>
                    <p className="text-xs text-[#6B635B] dark:text-[#A8A196] leading-relaxed">
                      Ask Noesis membaca langsung catatan yang sedang kamu tulis. Ketik{' '}
                      <span className="font-mono text-[#9A3412] dark:text-[#EA580C]">@</span> kalau mau
                      bandingkan dengan catatan atau fragment lain.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2">
                    {ASK_QUICK_STARTERS.map((starter) => (
                      <button
                        key={starter.label}
                        type="button"
                        disabled={isAskLoading}
                        onClick={() => void sendAskMessage(starter.prompt)}
                        className="p-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] hover:border-[#9A3412] dark:hover:border-[#EA580C] text-left transition-colors cursor-pointer group"
                      >
                        <div className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors">
                          {starter.label}
                        </div>
                        <div className="text-[11px] text-[#9C9388] dark:text-[#736C62] line-clamp-1 mt-0.5">
                          {starter.prompt}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isUser = msg.role === 'user';
                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[88%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 bg-[#9A3412] dark:bg-[#EA580C] text-white text-[13px] leading-relaxed shadow-2xs space-y-1">
                          {msg.attachedTitles && msg.attachedTitles.length > 0 && (
                            <div className="flex flex-wrap gap-1 opacity-90">
                              {msg.attachedTitles.map((t, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/15"
                                >
                                  @{t}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="space-y-1.5">
                      <div className="rounded-2xl rounded-tl-sm p-3.5 bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-2xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C]">
                            <Sparkles size={10} />
                            <span>Noesis</span>
                          </span>
                          {msg.modelUsed && (
                            <AiProcessBadge
                              featureName="Ask Noesis Copilot"
                              modelUsed={msg.modelUsed}
                              fallbackUsed={msg.fallbackUsed}
                              aiTrace={msg.aiTrace}
                              overlayKey={`${overlayKey}-msg-${msg.id}`}
                            />
                          )}
                        </div>

                        <div
                          className="text-[13px] sm:text-[13.5px] leading-relaxed text-[#221F1D] dark:text-[#EDE8E1] [&_h3]:font-serif [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2.5 [&_h3]:mb-1 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-[#9A3412]/45 [&_blockquote]:pl-2.5 [&_blockquote]:italic [&_blockquote]:text-[#6B635B] dark:[&_blockquote]:text-[#A8A196] [&_code]:font-mono [&_code]:text-[11px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-[#FAF7F2] dark:[&_code]:bg-[#151413]"
                          dangerouslySetInnerHTML={{
                            __html: copilotMarkdownToHtml(msg.text),
                          }}
                        />

                        {/* Lightweight Actions on Assistant Reply */}
                        <div className="pt-2 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/70 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#2A2624] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedMsgId === msg.id ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedMsgId === msg.id ? 'Tersalin' : 'Salin'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInsertMessageToNote(msg)}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#2A2624] hover:text-[#9A3412] dark:hover:text-[#EA580C] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowDownToLine size={11} />
                            <span>Sisipkan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveMessageAsFragment(msg)}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#2A2624] hover:text-[#9A3412] dark:hover:text-[#EA580C] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            {savedFragmentMsgId === msg.id ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <BookmarkPlus size={11} />
                            )}
                            <span>
                              {savedFragmentMsgId === msg.id
                                ? 'Masuk Fragments'
                                : 'Jadi Fragment'}
                            </span>
                          </button>

                          {savedNoteByMsgId[msg.id] ? (
                            <button
                              type="button"
                              onClick={() => {
                                const targetId = savedNoteByMsgId[msg.id];
                                if (!targetId) return;
                                setActiveNoteId(targetId);
                                setActiveView('editor');
                                onClose();
                              }}
                              className="px-2 py-1 rounded-lg text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink size={11} />
                              <span>Buka Note</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSaveMessageAsNote(msg)}
                              className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#2A2624] hover:text-[#9A3412] dark:hover:text-[#EA580C] transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FilePlus2 size={11} />
                              <span>Jadi Note</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {isAskLoading && (
                <div className="rounded-2xl rounded-tl-sm p-3 bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] inline-flex items-center gap-2 text-xs text-[#6B635B] dark:text-[#A8A196]">
                  <Loader2 size={14} className="animate-spin text-[#9A3412] dark:text-[#EA580C]" />
                  <span>Noesis sedang menimbang catatanmu...</span>
                </div>
              )}

              {askError && !isAskLoading && (
                <div className="p-3 rounded-xl bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{askError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAskError(null)}
                    className="text-red-500 hover:text-red-700 p-0.5"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* @Mention Attachment Popover */}
            {showMentionPicker && (
              <div className="mx-3 sm:mx-4 mb-1.5 rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-lg overflow-hidden shrink-0 animate-in fade-in duration-100">
                <div className="px-2.5 py-1.5 border-b border-[#E8E2D8]/80 dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C]">
                    Sertakan Catatan / Fragment (@)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMentionPicker(false)}
                    className="text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]"
                  >
                    <X size={12} />
                  </button>
                </div>

                {!askInput.match(/(?:^|\s)@([^\s@]{0,28})$/) && (
                  <div className="px-2.5 pt-2">
                    <input
                      type="text"
                      value={mentionQuery}
                      onChange={(e) => setMentionQuery(e.target.value)}
                      placeholder="Cari judul catatan atau fragment..."
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                )}

                <div className="max-h-40 overflow-y-auto p-1 divide-y divide-[#E8E2D8]/40 dark:divide-[#2F2B28]/40">
                  {mentionCandidates.length === 0 ? (
                    <p className="text-[11px] text-[#9C9388] px-2.5 py-3 text-center">
                      Tidak ada catatan atau fragment yang cocok.
                    </p>
                  ) : (
                    mentionCandidates.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAttachMention(item)}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-[#FAF7F2] dark:hover:bg-[#2A2624] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="text-xs text-[#221F1D] dark:text-[#EDE8E1] truncate">
                          {item.title}
                        </span>
                        <span className="text-[9px] font-mono uppercase text-[#9C9388] shrink-0">
                          {item.kind === 'fragment' ? 'Fragment' : item.type || 'Note'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Chat Input Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendAskMessage();
              }}
              className="px-3 sm:px-4 py-2.5 border-t border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB]/80 dark:bg-[#151413] flex items-end gap-2 shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
            >
              <textarea
                ref={askInputRef}
                rows={1}
                value={askInput}
                onChange={(e) => handleAskInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendAskMessage();
                  }
                }}
                disabled={isAskLoading}
                placeholder="Tanya tentang catatan ini... (ketik @ untuk tambah catatan)"
                className="flex-1 min-w-0 max-h-28 text-xs sm:text-[13px] px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] resize-none leading-relaxed"
              />
              <button
                type="submit"
                disabled={!askInput.trim() || isAskLoading}
                aria-label="Kirim pertanyaan ke Ask Noesis"
                className="p-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-45 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
              >
                {isAskLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
