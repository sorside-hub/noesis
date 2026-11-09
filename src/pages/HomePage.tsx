import React from 'react';
import { useNoesis } from '../context/NoesisContext';
import {
  Compass,
  Feather,
  BookOpen,
  Edit3,
  Sparkles,
  ArrowRight,
  Star,
  Clock,
  Plus,
  BookMarked,
  Flame,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const {
    notes,
    relics,
    projects,
    setActiveView,
    setActiveNoteId,
    createNote,
    setIsQuickCaptureOpen,
  } = useNoesis();

  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  const starredRelics = relics.filter((r) => r.starred).slice(0, 3);
  const totalWords = notes.reduce((acc, curr) => acc + (curr.wordCount || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-6 sm:px-10 lg:px-14 py-8">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Curatorial Header */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9A3412] dark:text-[#EA580C]">
              Sanctuary of Thought
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] mt-1">
              Welcome to Noesis
            </h1>
            <p className="text-sm text-[#6B635B] dark:text-[#A8A196] mt-1 max-w-xl font-normal leading-relaxed">
              A quiet space designed for unhurried contemplation, long-form synthesis, and capturing the fleeting relics of everyday wonder.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsQuickCaptureOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:bg-[#F5EFEB] dark:hover:bg-[#272422] transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Feather size={14} className="text-[#9A3412] dark:text-[#EA580C]" />
              <span>Capture Relic</span>
            </button>
            <button
              onClick={() => {
                const id = createNote();
                setActiveNoteId(id);
                setActiveView('editor');
              }}
              className="px-4 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>New Essay</span>
            </button>
          </div>
        </div>

        {/* Thought of the Day Banner (Archival Pullquote) */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] relative overflow-hidden">
          <div className="max-w-3xl">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#9C9388] dark:text-[#736C62] block mb-2">
              Curated Epigram · Socrates & Seneca
            </span>
            <blockquote className="font-serif italic text-xl sm:text-2xl text-[#221F1D] dark:text-[#EDE8E1] leading-relaxed">
              “The secret of happiness is not found in seeking more, but in developing the capacity to enjoy less.”
            </blockquote>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-3 font-mono">
              From your notebook: <span className="underline cursor-pointer" onClick={() => { setActiveNoteId('note-1'); setActiveView('editor'); }}>Thoughts on Minimalism</span>
            </p>
          </div>
        </div>

        {/* Operational Atelier Strip (Metrics & Rhythm) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
              Preserved Notes
            </span>
            <p className="font-serif text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] mt-1 tabular-nums">
              {notes.length}
            </p>
            <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196] mt-0.5 block">
              Thoughts, References & Ideas
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
              Atomic Relics
            </span>
            <p className="font-serif text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] mt-1 tabular-nums">
              {relics.length}
            </p>
            <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196] mt-0.5 block">
              Memories & quotes
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
              Total Vocabulary
            </span>
            <p className="font-serif text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] mt-1 tabular-nums">
              {totalWords.toLocaleString()}
            </p>
            <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196] mt-0.5 block">
              Words crafted
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
              Active Projects
            </span>
            <p className="font-serif text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] mt-1 tabular-nums">
              {projects.length}
            </p>
            <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196] mt-0.5 block">
              Manuscripts in flight
            </span>
          </div>
        </div>

        {/* 2-Column Split: Recent Writing Sessions & Starred Relics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Writing (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Recent Writing Sessions
              </h2>
              <button
                onClick={() => setActiveView('library')}
                className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
              >
                <span>View all library</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="space-y-3">
              {recentNotes.map((note) => {
                const formatDate = (dateStr: string) => {
                  const d = new Date(dateStr);
                  return `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}, ${d.getFullYear()}`;
                };

                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      setActiveNoteId(note.id);
                      setActiveView('editor');
                    }}
                    className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C]">
                          {note.type || 'thought'}
                        </span>
                        <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] transition-colors">
                          {note.title}
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-[#9C9388] dark:text-[#736C62]">
                        {note.wordCount} words
                      </span>
                    </div>

                    <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-2 mt-1 leading-relaxed">
                      {note.excerpt}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-[#9C9388] dark:text-[#736C62] mt-3 font-mono">
                      <span>{formatDate(note.updatedAt)}</span>
                      {note.tags.length > 0 && (
                        <>
                          <span>·</span>
                          <span>#{note.tags[0]}</span>
                        </>
                      )}
                      {note.relatedNoteIds && note.relatedNoteIds.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{note.relatedNoteIds.length} related</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Starred Relics (1 Col - Numen Style) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Starred Relics
              </h2>
              <button
                onClick={() => setActiveView('capture')}
                className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
              >
                <span>All relics</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="space-y-3">
              {starredRelics.map((relic) => (
                <div
                  key={relic.id}
                  className="p-4 rounded-xl bg-[#F5EFEB]/70 dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#9C9388] dark:text-[#736C62] mb-1">
                      <span className="uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C]">
                        {relic.type}
                      </span>
                      <span>{relic.date}</span>
                    </div>

                    <h4 className="font-serif text-sm font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                      {relic.title}
                    </h4>

                    <p className="text-xs text-[#6B635B] dark:text-[#A8A196] line-clamp-3 mt-1 leading-relaxed">
                      {relic.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 mt-3 text-[10px] text-[#9C9388] font-mono">
                    {relic.tags.map((t, idx) => (
                      <span key={t}>
                        #{t}
                        {idx < relic.tags.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Epistemic Streams & Note Types Overview */}
        <div className="space-y-4 pt-4 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Epistemic Categories
            </h2>
            <button
              onClick={() => setActiveView('library')}
              className="text-xs text-[#9A3412] dark:text-[#EA580C] hover:underline flex items-center gap-1 font-medium"
            >
              <span>Explore Knowledge Library</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveView('library')}
              className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all shadow-2xs group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C]">
                  Philosophical
                </span>
                <span className="text-xs font-mono tabular-nums text-[#9C9388]">
                  {notes.filter((n) => n.type === 'thought').length} notes
                </span>
              </div>
              <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] mt-2 transition-colors">
                Thoughts & Reflections
              </h3>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed">
                First-person contemplations, philosophical syntheses, and personal journal entries.
              </p>
            </div>

            <div
              onClick={() => setActiveView('library')}
              className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all shadow-2xs group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#1E3A8A] dark:text-[#60A5FA]">
                  Archival
                </span>
                <span className="text-xs font-mono tabular-nums text-[#9C9388]">
                  {notes.filter((n) => n.type === 'reference').length} notes
                </span>
              </div>
              <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] mt-2 transition-colors">
                References & Literature
              </h3>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed">
                Excerpts, citations, book summaries, and theoretical source frameworks.
              </p>
            </div>

            <div
              onClick={() => setActiveView('library')}
              className="p-4 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] hover:border-[#D6CEBE] dark:hover:border-[#443E3A] cursor-pointer transition-all shadow-2xs group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#B45309] dark:text-[#F59E0B]">
                  Incubation
                </span>
                <span className="text-xs font-mono tabular-nums text-[#9C9388]">
                  {notes.filter((n) => n.type === 'idea').length} notes
                </span>
              </div>
              <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1] group-hover:text-[#9A3412] dark:group-hover:text-[#EA580C] mt-2 transition-colors">
                Ideas & Concepts
              </h3>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1 leading-relaxed">
                Nascent sparks, hypotheses, prototype outlines, and creative explorations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
