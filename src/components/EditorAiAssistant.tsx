import React, { useEffect, useState, useRef } from 'react';
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
} from 'lucide-react';
import {
  WritingAssistAction,
  WritingAssistMode,
  WritingAssistResult,
} from '../types';
import { requestWritingAssist } from '../lib/discoverAi';
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
  action: WritingAssistAction | 'open_prompt';
}

const SLASH_ITEMS: SlashCommandItem[] = [
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
    label: 'Tanya AI bebas...',
    hint: 'Buka panel instruksi AI pendamping',
    keywords: ['ai', 'tanya', 'prompt', 'bantu', 'ask', 'custom'],
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
    typeof window !== 'undefined' && trigger.coords.bottom > window.innerHeight - 240;
  const desktopTop = preferAbove
    ? Math.max(60, trigger.coords.top - 196)
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
        className="fixed z-40 left-3 right-3 bottom-[calc(var(--noesis-kb-offset,0px)+54px)] md:bottom-auto md:right-auto md:w-64 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xl overflow-hidden animate-in fade-in duration-100"
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
              <Sparkles size={13} className="text-[#9A3412] dark:text-[#EA580C] shrink-0 mt-0.5" />
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
  title?: string;
  noteType?: string;
  projectTitle?: string;
  sectionTitle?: string;
  previousSectionSnippet?: string;
  autoRunAction?: WritingAssistAction | null;
  onConsumeAutoRun?: () => void;
  onApply: (html: string, applyMode: 'replace' | 'insert_below' | 'insert_cursor') => void;
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

export const EditorAiSheet: React.FC<EditorAiSheetProps> = ({
  isOpen,
  onClose,
  contextKind,
  snapshot,
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
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WritingAssistResult | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    action: WritingAssistAction;
    custom?: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const requestSeqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useBackOverlay(isOpen && !isLoading, onClose, overlayKey);

  // Reset state whenever drawer opens fresh
  useEffect(() => {
    if (!isOpen) {
      requestSeqRef.current += 1;
      setIsLoading(false);
      return;
    }
    setError(null);
    setResult(null);
    setLastRequest(null);
    setCustomPrompt('');
    setIsCopied(false);

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const isTouchOrMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth < 768 || window.matchMedia?.('(pointer: coarse)').matches);

    if (!autoRunAction && !isTouchOrMobile) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const runAssist = async (action: WritingAssistAction, promptOverride?: string) => {
    if (!snapshot || isLoading) return;
    const seq = ++requestSeqRef.current;
    const usedPrompt = promptOverride !== undefined ? promptOverride : customPrompt;

    setIsLoading(true);
    setError(null);
    setIsCopied(false);
    setLastRequest({ action, custom: usedPrompt });

    try {
      const res = await requestWritingAssist({
        contextKind,
        mode: snapshot.mode,
        action,
        customPrompt: usedPrompt.trim() || undefined,
        selectedText: snapshot.selectedText,
        title,
        surroundingBefore: snapshot.surroundingBefore,
        surroundingAfter: snapshot.surroundingAfter,
        documentExcerpt: snapshot.documentExcerpt,
        projectTitle,
        sectionTitle,
        previousSectionSnippet,
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
      void runAssist(actionToRun, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoRunAction, snapshot]);

  if (!isOpen || !snapshot) return null;

  const isSelectionMode = snapshot.mode === 'selection';
  const presets = isSelectionMode ? SELECTION_PRESETS : CURSOR_PRESETS;
  const selectedWordCount = snapshot.selectedText
    ? snapshot.selectedText.split(/\s+/).filter(Boolean).length
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Pendamping Menulis"
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-xl max-h-[82vh] md:max-h-[84vh] bg-[#FAF7F2] dark:bg-[#1E1C1A] border-t md:border border-[#E8E2D8] dark:border-[#2F2B28] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB]/80 dark:bg-[#151413] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center shrink-0">
              <Sparkles size={14} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-serif text-sm sm:text-base font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  AI Pendamping
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]">
                  {isSelectionMode ? `Seleksi · ${selectedWordCount} kata` : 'Mode Kursor'}
                </span>
                {result && (
                  <AiProcessBadge
                    featureName="AI Pendamping Editor"
                    modelUsed={result.modelUsed}
                    fallbackUsed={result.fallbackUsed}
                    aiTrace={result.aiTrace}
                    overlayKey={`${overlayKey}-trace`}
                  />
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            aria-label="Tutup AI Pendamping"
            className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] disabled:opacity-50 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-3">
          {/* Selected text preview */}
          {isSelectionMode && (
            <div className="px-3 py-2 rounded-xl bg-white/75 dark:bg-[#221F1E]/75 border border-[#E8E2D8] dark:border-[#2F2B28]">
              <span className="block text-[9px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-0.5">
                Teks terpilih
              </span>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-2 italic leading-relaxed">
                “{snapshot.selectedText}”
              </p>
            </div>
          )}

          {/* Custom prompt input */}
          <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isLoading}
              placeholder={
                isSelectionMode
                  ? 'Instruksi khusus (mis. ubah nada lebih santai, buat analogi...)'
                  : 'Minta AI sesuatu (mis. buatkan contoh konkret, cek alur...)'
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

          {/* Preset Action Chips */}
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

          {/* Loading State */}
          {isLoading && (
            <div className="p-4 rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-center gap-2.5 text-xs text-[#6B635B] dark:text-[#A8A196]">
              <Loader2 size={15} className="animate-spin text-[#9A3412] dark:text-[#EA580C] shrink-0" />
              <span>AI sedang menyusun draf yang selaras dengan tulisanmu...</span>
            </div>
          )}

          {/* Error State */}
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

          {/* Result Preview */}
          {result && !isLoading && (
            <div className="rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] overflow-hidden space-y-0 animate-in fade-in duration-150">
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

        {/* Footer Actions when result is ready */}
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
      </div>
    </div>
  );
};
