import React, { useState } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { useBackOverlay } from '../hooks/useBackOverlay';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import {
  FolderKanban,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  BookOpen,
  ArrowRight,
  TrendingUp,
  X,
} from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const scrollRef = useScrollRestoration<HTMLDivElement>('projects');
  const {
    projects,
    toggleProjectMilestone,
    notes,
    setActiveNoteId,
    setActiveView,
  } = useNoesis();

  const [showCreateModal, setShowCreateModal] = useState(false);
  useBackOverlay(showCreateModal, () => setShowCreateModal(false), 'projects-create-modal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetWordCount, setTargetWordCount] = useState(3000);
  const [deadline, setDeadline] = useState('April 2026');

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // We can add to projects in local state if desired, or show toast
    setShowCreateModal(false);
    setTitle('');
    setDescription('');
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
      case 'drafting':
        return 'text-[#9A3412] dark:text-[#EA580C] bg-[#FED7AA]/30 dark:bg-[#431407]/40 border-[#FED7AA] dark:border-[#431407]';
      case 'review':
        return 'text-[#B45309] dark:text-[#F59E0B] bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
      default:
        return 'text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700';
    }
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-6 sm:px-10 lg:px-14 py-8">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9A3412] dark:text-[#EA580C]">
              Atelier Manuscripts
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] mt-1">
              Projects & Essays
            </h1>
            <p className="text-sm text-[#6B635B] dark:text-[#A8A196] mt-1 max-w-xl">
              Track long-term writing endeavors, multi-part treatises, and milestone checklists.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus size={15} />
            <span>New Writing Project</span>
          </button>
        </div>

        {/* Projects Cards List */}
        <div className="space-y-6">
          {projects.map((proj) => {
            const linkedNotes = notes.filter((n) => proj.noteIds.includes(n.id));
            return (
              <div
                key={proj.id}
                className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-5"
              >
                {/* Project Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${getStatusStyle(
                          proj.status
                        )}`}
                      >
                        {proj.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-[#9C9388] font-mono flex items-center gap-1">
                        <Calendar size={12} />
                        <span>Target: {proj.deadline}</span>
                      </span>
                    </div>

                    <h2 className="font-serif text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] tracking-tight">
                      {proj.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed max-w-3xl">
                      {proj.description}
                    </p>
                  </div>

                  {/* Progress Pill */}
                  <div className="sm:text-right shrink-0">
                    <span className="font-serif text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] tabular-nums">
                      {proj.progress}%
                    </span>
                    <p className="text-[11px] font-mono text-[#9C9388]">
                      {proj.currentWordCount.toLocaleString()} / {proj.targetWordCount.toLocaleString()} words
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#F5EFEB] dark:bg-[#272422] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#9A3412] dark:bg-[#EA580C] h-full transition-all duration-300"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>

                {/* Milestones Checklist */}
                <div>
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-2">
                    Milestone Progression (click to toggle)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {proj.milestones.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => toggleProjectMilestone(proj.id, m.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          m.completed
                            ? 'bg-[#FAF7F2] dark:bg-[#221F1E] border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196] line-through'
                            : 'bg-white dark:bg-[#272422] border-[#D6CEBE] dark:border-[#332F2C] text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412]'
                        }`}
                      >
                        {m.completed ? (
                          <CheckCircle2 size={16} className="text-[#9A3412] dark:text-[#EA580C] shrink-0" />
                        ) : (
                          <Circle size={16} className="text-[#9C9388] shrink-0" />
                        )}
                        <span className="truncate">{m.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked Notes Strip */}
                {linkedNotes.length > 0 && (
                  <div className="pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 flex flex-wrap items-center gap-3">
                    <span className="text-[11px] font-mono text-[#9C9388] shrink-0">
                      Associated Drafts:
                    </span>
                    {linkedNotes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => {
                          setActiveNoteId(note.id);
                          setActiveView('editor');
                        }}
                        className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium font-serif italic"
                      >
                        <span>{note.title}</span>
                        <ArrowRight size={11} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="w-full max-w-md bg-[#FAF7F2] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-2xl shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Initiate New Manuscript
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg text-[#9C9388] hover:text-[#221F1D]"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
                    Manuscript Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. In Search of Lost Time"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
                    Scope / Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief outline of the treatise..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
                      Word Target
                    </label>
                    <input
                      type="number"
                      value={targetWordCount}
                      onChange={(e) => setTargetWordCount(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] mb-1">
                      Target Horizon
                    </label>
                    <input
                      type="text"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      placeholder="May 2026"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 text-xs text-[#6B635B] hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#9A3412] text-white rounded-xl text-xs font-medium hover:bg-[#78280E]"
                  >
                    Create Manuscript
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
