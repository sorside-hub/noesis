import React, { useState, useMemo, useEffect } from 'react';
import { Note, Fragment, Project, ProjectStatus } from '../../types';
import { cleanTextForEmbedding } from '../../lib/cloudflareEmbedding';
import {
  X,
  Search,
  Check,
  BookOpen,
  Feather,
  Sparkles,
  Target,
} from 'lucide-react';

interface ProjectFormModalProps {
  isOpen: boolean;
  editingProject?: Project | null;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    status: ProjectStatus;
    enableWordGoal: boolean;
    targetWordCount: number;
    deadline: string;
    initialSections: string[];
  }) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  editingProject,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [enableWordGoal, setEnableWordGoal] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(3000);
  const [deadline, setDeadline] = useState('');
  const [sectionsText, setSectionsText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingProject) {
      setTitle(editingProject.title || '');
      setDescription(editingProject.description || '');
      setStatus(editingProject.status || 'active');
      setEnableWordGoal(Boolean(editingProject.enableWordGoal));
      setTargetWordCount(editingProject.targetWordCount || 3000);
      setDeadline(editingProject.deadline || '');
      setSectionsText('');
    } else {
      setTitle('');
      setDescription('');
      setStatus('active');
      setEnableWordGoal(false);
      setTargetWordCount(3000);
      setDeadline('');
      setSectionsText('');
    }
  }, [isOpen, editingProject]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const initialSections = sectionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      status,
      enableWordGoal,
      targetWordCount: enableWordGoal ? Math.max(100, Number(targetWordCount) || 0) : 0,
      deadline: deadline.trim(),
      initialSections,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs">
      <div className="w-full sm:max-w-lg bg-[#FAF7F2] dark:bg-[#1E1C1A] border-t sm:border border-[#E8E2D8] dark:border-[#2F2B28] rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-3">
          <h3 className="font-serif text-lg sm:text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
            {editingProject ? 'Pengaturan Project' : 'Buat Project Baru'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
              Nama Project
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Misal: Esai Bias Kognitif, Skripsi Bab 2, Belajar Sistem Terdistribusi..."
              className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
              Tujuan / Ruang Lingkup (Opsional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pertanyaan utama, target karya, atau ringkasan tujuan project..."
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] resize-none"
            />
          </div>

          {editingProject && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1.5">
                Status Project
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
                    onClick={() => setStatus(opt.id)}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
                      status === opt.id
                        ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C]'
                        : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#6B635B] dark:text-[#A8A196]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
                Target Waktu (Opsional)
              </label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="Misal: Akhir Bulan Ini / Mei 2026"
                className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
              />
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => setEnableWordGoal((prev) => !prev)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                  enableWordGoal
                    ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C]'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Target size={13} />
                  <span>Target Kata (Penulis)</span>
                </span>
                <span className="font-mono text-[10px] uppercase">
                  {enableWordGoal ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>

          {enableWordGoal && (
            <div className="p-3 rounded-xl bg-white dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] space-y-1.5">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388]">
                Target Jumlah Kata (Dihitung Otomatis dari Semua Bagian)
              </label>
              <input
                type="number"
                min={100}
                step={100}
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
              />
            </div>
          )}

          {!editingProject && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
                Susunan Bagian / Bab Awal (Opsional, 1 baris per bagian)
              </label>
              <textarea
                rows={3}
                value={sectionsText}
                onChange={(e) => setSectionsText(e.target.value)}
                placeholder={'Pendahuluan\nArgumen Utama\nKesimpulan'}
                className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] resize-none"
              />
              <p className="text-[11px] text-[#9C9388] mt-1">
                Jika dikosongkan, project langsung dimulai dengan 1 bagian Draf Utama siap tulis.
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-[#6B635B] dark:text-[#A8A196] hover:underline"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#9A3412] dark:bg-[#EA580C] text-white rounded-xl text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors"
            >
              {editingProject ? 'Simpan Perubahan' : 'Buat Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface LinkMaterialsModalProps {
  isOpen: boolean;
  project: Project;
  notes: Note[];
  fragments: Fragment[];
  onClose: () => void;
  onToggleLink: (kind: 'note' | 'fragment', itemId: string, currentlyLinked: boolean) => void;
}

export const LinkMaterialsModal: React.FC<LinkMaterialsModalProps> = ({
  isOpen,
  project,
  notes,
  fragments,
  onClose,
  onToggleLink,
}) => {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'note' | 'synthesis' | 'fragment'>('all');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setKindFilter('all');
    }
  }, [isOpen]);

  const noteIdSet = useMemo(() => new Set(project.noteIds || []), [project.noteIds]);
  const fragIdSet = useMemo(() => new Set(project.fragmentIds || []), [project.fragmentIds]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: {
      id: string;
      kind: 'note' | 'fragment';
      subType: string;
      title: string;
      excerpt: string;
      isLinked: boolean;
      isSynthesis: boolean;
    }[] = [];

    if (kindFilter === 'all' || kindFilter === 'note' || kindFilter === 'synthesis') {
      for (const n of notes) {
        if (n.archived) continue;
        if (kindFilter === 'synthesis' && n.type !== 'synthesis') continue;
        if (kindFilter === 'note' && n.type === 'synthesis') continue;
        const text = `${n.title} ${cleanTextForEmbedding(n.content)} ${(n.tags || []).join(' ')}`.toLowerCase();
        if (q && !text.includes(q)) continue;
        list.push({
          id: n.id,
          kind: 'note',
          subType: n.type,
          title: n.title || 'Tanpa Judul',
          excerpt: n.excerpt || cleanTextForEmbedding(n.content).slice(0, 120),
          isLinked: noteIdSet.has(n.id),
          isSynthesis: n.type === 'synthesis',
        });
      }
    }

    if (kindFilter === 'all' || kindFilter === 'fragment') {
      for (const f of fragments) {
        const text = `${f.title} ${cleanTextForEmbedding(f.content)} ${(f.tags || []).join(' ')}`.toLowerCase();
        if (q && !text.includes(q)) continue;
        list.push({
          id: f.id,
          kind: 'fragment',
          subType: f.type,
          title: f.title || 'Tanpa Judul',
          excerpt: cleanTextForEmbedding(f.content).slice(0, 120),
          isLinked: fragIdSet.has(f.id),
          isSynthesis: false,
        });
      }
    }

    // Show linked items first or keep natural order
    list.sort((a, b) => Number(b.isLinked) - Number(a.isLinked));
    return list;
  }, [notes, fragments, noteIdSet, fragIdSet, query, kindFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs">
      <div className="w-full sm:max-w-xl bg-[#FAF7F2] dark:bg-[#1E1C1A] border-t sm:border border-[#E8E2D8] dark:border-[#2F2B28] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[88vh]">
        <div className="p-3.5 sm:p-5 border-b border-[#E8E2D8] dark:border-[#2F2B28] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Pilih Bahan untuk Project
              </h3>
              <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">
                Tautkan Catatan, Dokumen Synthesis, atau Fragment tanpa menduplikasi file.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C9388]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul, isi, atau #tag..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'note', label: 'Catatan' },
              { id: 'synthesis', label: 'Synthesis' },
              { id: 'fragment', label: 'Fragments' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setKindFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  kindFilter === tab.id
                    ? 'border-[#9A3412] dark:border-[#EA580C] bg-[#9A3412]/10 dark:bg-[#EA580C]/15 text-[#9A3412] dark:text-[#EA580C]'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {items.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#9C9388]">
              Tidak ada materi yang cocok dengan filter ini.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => onToggleLink(item.kind, item.id, item.isLinked)}
                className={`w-full text-left p-2.5 sm:p-3 rounded-xl border transition-colors flex items-start gap-2.5 ${
                  item.isLinked
                    ? 'bg-white dark:bg-[#272422] border-[#9A3412]/50 dark:border-[#EA580C]/50'
                    : 'bg-white/70 dark:bg-[#1E1C1A] border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#9A3412]/40'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                    item.isLinked
                      ? 'bg-[#9A3412] dark:bg-[#EA580C] border-[#9A3412] dark:border-[#EA580C] text-white'
                      : 'border-[#D6CEBE] dark:border-[#443E3A]'
                  }`}
                >
                  {item.isLinked && <Check size={11} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase">
                    {item.isSynthesis ? (
                      <span className="inline-flex items-center gap-1 text-[#9A3412] dark:text-[#EA580C] font-semibold">
                        <Sparkles size={10} />
                        Synthesis
                      </span>
                    ) : item.kind === 'fragment' ? (
                      <span className="inline-flex items-center gap-1 text-[#9A3412] dark:text-[#EA580C]">
                        <Feather size={10} />
                        Fragment · {item.subType}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#6B635B] dark:text-[#A8A196]">
                        <BookOpen size={10} />
                        Catatan · {item.subType}
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1] line-clamp-1 mt-0.5">
                    {item.title}
                  </h4>
                  {item.excerpt && (
                    <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196] line-clamp-1 mt-0.5">
                      {item.excerpt}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-3 sm:p-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#9C9388]">
            {project.noteIds.length} catatan · {(project.fragmentIds || []).length} fragments tertaut
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E]"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
