import React, { useEffect, useRef, useState } from 'react';
import { Note, Fragment } from '../../types';
import { cleanTextForEmbedding } from '../../lib/cloudflareEmbedding';
import { useBackOverlay } from '../../hooks/useBackOverlay';
import { InlineProjectNoteEditor } from './InlineProjectNoteEditor';
import {
  BookOpen,
  Feather,
  Sparkles,
  Tag,
  Edit3,
  Pin,
  PinOff,
  Unlink,
  X,
  Clock,
  FileText,
  ArrowLeft,
  Copy,
  Check,
  ArrowRightToLine,
} from 'lucide-react';

export type ProjectSelectedMaterial =
  | { kind: 'note'; item: Note }
  | { kind: 'fragment'; item: Fragment };

interface ProjectMaterialReaderProps {
  selected: ProjectSelectedMaterial | null;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onEdit: (kind: 'note' | 'fragment', id: string) => void;
  onUnlink?: (kind: 'note' | 'fragment', id: string) => void;
  onInsertToSection?: (selected: ProjectSelectedMaterial) => void;
  onBack?: () => void;
  backLabel?: string;
  onClose?: () => void;
  compact?: boolean;
  autoEditNoteRequest?: { noteId: string; nonce: number } | null;
  onConsumeAutoEditRequest?: () => void;
}

export const countWordsFromText = (rawTextOrHtml: string): number => {
  const cleaned = cleanTextForEmbedding(rawTextOrHtml || '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
};

export const ProjectMaterialReader: React.FC<ProjectMaterialReaderProps> = ({
  selected,
  isPinned = false,
  onTogglePin,
  onEdit,
  onUnlink,
  onInsertToSection,
  onBack,
  backLabel = 'Daftar Bahan',
  onClose,
  compact = false,
  autoEditNoteRequest = null,
  onConsumeAutoEditRequest,
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [shouldAutoFocusTitle, setShouldAutoFocusTitle] = useState(false);
  const prevItemKeyRef = useRef<string | null>(null);
  const lastAutoEditNonceRef = useRef<number>(0);

  const selectedKey = selected ? `${selected.kind}:${selected.item.id}` : null;

  useEffect(() => {
    const isMatchingAutoEdit = Boolean(
      autoEditNoteRequest &&
        selected?.kind === 'note' &&
        selected.item.id === autoEditNoteRequest.noteId &&
        autoEditNoteRequest.nonce !== lastAutoEditNonceRef.current
    );

    if (isMatchingAutoEdit && autoEditNoteRequest) {
      lastAutoEditNonceRef.current = autoEditNoteRequest.nonce;
      prevItemKeyRef.current = selectedKey;
      setIsEditingInline(true);
      setShouldAutoFocusTitle(true);
      onConsumeAutoEditRequest?.();
      return;
    }

    if (prevItemKeyRef.current !== selectedKey) {
      prevItemKeyRef.current = selectedKey;
      setIsEditingInline(false);
      setShouldAutoFocusTitle(false);
    }
  }, [selectedKey, selected, autoEditNoteRequest, onConsumeAutoEditRequest]);

  useBackOverlay(
    isEditingInline && selected?.kind === 'note',
    () => {
      setIsEditingInline(false);
      setShouldAutoFocusTitle(false);
    },
    `project-reader-inline-edit-${selected?.item.id || 'none'}`
  );

  if (!selected) {
    return (
      <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center p-6 sm:p-10 rounded-2xl bg-white/70 dark:bg-[#1E1C1A]/60 border border-dashed border-[#D6CEBE] dark:border-[#332F2C]">
        <div className="w-11 h-11 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mb-3">
          <BookOpen size={20} />
        </div>
        <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
          Pilih Bahan untuk Dibaca
        </h3>
        <p className="text-xs text-[#6B635B] dark:text-[#A8A196] max-w-sm mt-1 leading-relaxed">
          Klik salah satu Catatan, Dokumen Synthesis, atau Fragment untuk membacanya langsung sambil menulis.
        </p>
      </div>
    );
  }

  const isNote = selected.kind === 'note';
  const note = isNote ? selected.item : null;
  const fragment = !isNote ? selected.item : null;

  if (isEditingInline && isNote && note) {
    return (
      <InlineProjectNoteEditor
        note={note}
        compact={compact}
        onDone={() => {
          setIsEditingInline(false);
          setShouldAutoFocusTitle(false);
        }}
        onOpenFullEditor={(id) => onEdit('note', id)}
        onBack={onBack}
        backLabel={backLabel}
        onClose={onClose}
        autoFocusTitle={shouldAutoFocusTitle}
      />
    );
  }

  const title = selected.item.title || 'Tanpa Judul';
  const tags = selected.item.tags || [];
  const source = selected.item.source;
  const wordCount = countWordsFromText(selected.item.content || '');

  const handleCopyContent = async () => {
    const plain = cleanTextForEmbedding(selected.item.content || '').trim();
    if (!plain) return;
    try {
      await navigator.clipboard.writeText(`${title}\n\n${plain}`);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1800);
    } catch {
      // ignore
    }
  };

  const getTypeBadge = () => {
    if (note) {
      if (note.type === 'synthesis') {
        return {
          label: 'Synthesis',
          icon: <Sparkles size={11} />,
          cls: 'bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C] border-[#9A3412]/25 dark:border-[#EA580C]/30',
        };
      }
      return {
        label: `Catatan · ${note.type}`,
        icon: <BookOpen size={11} />,
        cls: 'bg-[#FAF7F2] dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] border-[#E8E2D8] dark:border-[#2F2B28]',
      };
    }
    return {
      label: `Fragment · ${fragment?.type || 'thought'}`,
      icon: <Feather size={11} />,
      cls: 'bg-[#FAF7F2] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] border-[#E8E2D8] dark:border-[#2F2B28]',
    };
  };

  const badge = getTypeBadge();

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-[#1E1C1A] ${
        compact
          ? 'rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]'
          : 'rounded-2xl border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs'
      } overflow-hidden`}
    >
      {/* Top Action Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2]/70 dark:bg-[#221F1E]/80 ${
          compact ? 'px-3 py-2' : 'px-4 sm:px-5 py-3'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-2 py-1 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[11px] font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={12} />
              <span>{backLabel}</span>
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider font-medium ${badge.cls}`}
          >
            {badge.icon}
            <span>{badge.label}</span>
          </span>
          <span className="text-[11px] font-mono text-[#9C9388] dark:text-[#736C62] flex items-center gap-1">
            <FileText size={11} />
            <span>{wordCount.toLocaleString()} kata</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {onInsertToSection && (
            <button
              type="button"
              onClick={() => onInsertToSection(selected)}
              title="Sisipkan isi bahan ini ke bagian yang sedang ditulis"
              className="px-2.5 py-1.5 rounded-lg bg-[#9A3412] dark:bg-[#EA580C] text-white text-[11px] font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors flex items-center gap-1 shadow-2xs"
            >
              <ArrowRightToLine size={12} />
              <span>Sisipkan</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyContent}
            title="Salin teks bahan"
            className="p-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors"
          >
            {copiedText ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          </button>

          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              title={
                isPinned
                  ? 'Lepas pin referensi'
                  : 'Pin referensi'
              }
              className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1 ${
                isPinned
                  ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C]'
                  : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
              }`}
            >
              {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>
          )}

          {onUnlink && (
            <button
              type="button"
              onClick={() => onUnlink(selected.kind, selected.item.id)}
              title="Keluarkan dari project (tidak menghapus dari Library/Fragments)"
              className="p-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[#9C9388] hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <Unlink size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isNote) {
                setShouldAutoFocusTitle(false);
                setIsEditingInline(true);
              } else {
                onEdit(selected.kind, selected.item.id);
              }
            }}
            title={isNote ? 'Edit catatan langsung di sini' : 'Buka & edit Fragment'}
            className="px-2.5 py-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#272422] text-[#221F1D] dark:text-[#EDE8E1] text-[11px] font-medium hover:border-[#9A3412] transition-colors flex items-center gap-1"
          >
            <Edit3 size={12} />
            <span>{compact ? 'Edit' : isNote ? 'Edit Catatan' : 'Edit Fragment'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau"
              className="p-1.5 rounded-lg text-[#6B635B] dark:text-[#A8A196] hover:bg-[#E8E2D8]/50 dark:hover:bg-[#2F2B28]"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Reading Body */}
      <div
        className={`flex-1 overflow-y-auto ${
          compact ? 'px-3.5 py-3.5' : 'px-5 sm:px-7 py-5 sm:py-6'
        } space-y-4`}
      >
        <div className="space-y-2 border-b border-[#E8E2D8]/70 dark:border-[#2F2B28]/70 pb-3.5">
          <h2
            className={`font-serif font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] ${
              compact ? 'text-xl' : 'text-2xl sm:text-3xl'
            }`}
          >
            {title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[#9C9388] dark:text-[#736C62] font-mono">
            {note?.updatedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} />
                <span>
                  Diperbarui{' '}
                  {new Date(note.updatedAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </span>
            )}
            {fragment?.date && (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} />
                <span>{fragment.date}</span>
              </span>
            )}
            {source && <span className="truncate max-w-xs">Sumber: {source}</span>}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#272422] border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]"
                >
                  <Tag size={9} />
                  <span>#{tag}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Clean Formatted Content */}
        {isNote ? (
          note?.content && note.content.replace(/<[^>]*>/g, '').trim().length > 0 ? (
            <div
              className="tiptap text-sm sm:text-[15px] leading-relaxed text-[#221F1D] dark:text-[#EDE8E1]"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
          ) : (
            <p className="text-xs sm:text-sm italic text-[#9C9388] dark:text-[#736C62]">
              Catatan ini belum memiliki isi. Klik <strong>{compact ? 'Edit' : 'Edit Catatan'}</strong> untuk mulai menulis.
            </p>
          )
        ) : fragment?.content ? (
          <div className="text-sm sm:text-[15px] leading-relaxed text-[#221F1D] dark:text-[#EDE8E1] whitespace-pre-wrap">
            {fragment.content}
          </div>
        ) : (
          <p className="text-xs italic text-[#9C9388] dark:text-[#736C62]">
            Fragment ini masih kosong.
          </p>
        )}
      </div>
    </div>
  );
};
