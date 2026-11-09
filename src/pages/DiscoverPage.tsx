import React from 'react';
import { useNoesis } from '../context/NoesisContext';
import { Sparkles, Compass, ArrowRight, Lightbulb, History, BookOpen, Feather } from 'lucide-react';

export const DiscoverPage: React.FC = () => {
  const { notes, relics, createNote, setActiveNoteId, setActiveView, setIsQuickCaptureOpen } = useNoesis();

  const prompts = [
    {
      id: 'p1',
      question: 'What belief or habit did you discard this past year that made your thinking substantially freer?',
      context: 'Voluntary Simplicity & Epistemology',
    },
    {
      id: 'p2',
      question: 'Observe the physical room around you. Which object possesses the deepest resonance of memory?',
      context: 'Spatial Relics & Material Solitude',
    },
    {
      id: 'p3',
      question: 'If you could only preserve three short maxims for your future self, what would they be?',
      context: 'Senecan Letters & Core Tenets',
    },
  ];

  const handleStartContemplation = (promptQuestion: string) => {
    const newId = createNote();
    setActiveNoteId(newId);
    setActiveView('editor');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-6 sm:px-10 lg:px-14 py-8">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#9A3412] dark:text-[#EA580C]">
            Serendipity Engine
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] mt-1">
            Discover & Connect
          </h1>
          <p className="text-sm text-[#6B635B] dark:text-[#A8A196] mt-1 max-w-xl">
            Resurface forgotten reflections, explore conceptual affinities, and engage with philosophical prompts.
          </p>
        </div>

        {/* Resurfaced from the Archive Section */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono text-[#9A3412] dark:text-[#EA580C] uppercase tracking-wider">
            <History size={14} />
            <span>Echoes from the Archive</span>
          </div>

          <h2 className="font-serif text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
            “The secret of happiness is developing the capacity to enjoy less.”
          </h2>

          <p className="text-sm text-[#6B635B] dark:text-[#A8A196] leading-relaxed max-w-2xl">
            You recorded this reflection in your <em>Thoughts on Minimalism</em> entry. It shares conceptual roots with your recent relic <em>The silent hum of accomplishment</em>.
          </p>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => {
                setActiveNoteId('note-1');
                setActiveView('editor');
              }}
              className="px-4 py-2 rounded-xl bg-[#9A3412] text-white text-xs font-medium hover:bg-[#78280E] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>Re-read Essay</span>
              <ArrowRight size={13} />
            </button>
            <button
              onClick={() => setIsQuickCaptureOpen(true)}
              className="px-4 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#332F2C] bg-white dark:bg-[#272422] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:bg-[#FAF7F2] transition-colors"
            >
              Capture New Response
            </button>
          </div>
        </div>

        {/* Conceptual Clusters */}
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
            Conceptual Clusters & Graph Nodes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
              <span className="text-xs font-mono text-[#9A3412] dark:text-[#EA580C] uppercase tracking-wider block mb-1">
                Cluster 01 · 4 Notes
              </span>
              <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Voluntary Simplicity & Focus
              </h3>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-2 leading-relaxed">
                Intersections between Socrates’ paradox of choice, James Clear’s habit friction, and Montaigne’s back-shop of the mind.
              </p>
              <div className="mt-4 pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 flex items-center justify-between text-xs text-[#9C9388]">
                <span>Density: High</span>
                <span
                  onClick={() => {
                    setActiveNoteId('note-1');
                    setActiveView('editor');
                  }}
                  className="text-[#9A3412] hover:underline cursor-pointer font-medium"
                >
                  Explore cluster
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
              <span className="text-xs font-mono text-[#9A3412] dark:text-[#EA580C] uppercase tracking-wider block mb-1">
                Cluster 02 · 3 Relics
              </span>
              <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Heirlooms & Fleeting Time
              </h3>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-2 leading-relaxed">
                Reflections anchored in physical relics: your father’s pocket watch, antique compasses, and first snow observations.
              </p>
              <div className="mt-4 pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 flex items-center justify-between text-xs text-[#9C9388]">
                <span>Density: Moderate</span>
                <span
                  onClick={() => setActiveView('capture')}
                  className="text-[#9A3412] hover:underline cursor-pointer font-medium"
                >
                  View relics
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28]">
              <span className="text-xs font-mono text-[#9A3412] dark:text-[#EA580C] uppercase tracking-wider block mb-1">
                Cluster 03 · 2 Manuscripts
              </span>
              <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Spatial Systems & Memory Palaces
              </h3>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-2 leading-relaxed">
                Architectural thinking applied to knowledge software and cognitive maps of memory.
              </p>
              <div className="mt-4 pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 flex items-center justify-between text-xs text-[#9C9388]">
                <span>Density: Emerging</span>
                <span
                  onClick={() => {
                    setActiveNoteId('note-4');
                    setActiveView('editor');
                  }}
                  className="text-[#9A3412] hover:underline cursor-pointer font-medium"
                >
                  Read treatise
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contemplative Inquiries (Socratic Prompts) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-[#9A3412]" />
            <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Socratic Prompts for Contemplation
            </h2>
          </div>

          <div className="space-y-3">
            {prompts.map((p) => (
              <div
                key={p.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62]">
                    {p.context}
                  </span>
                  <p className="font-serif text-base sm:text-lg text-[#221F1D] dark:text-[#EDE8E1] mt-1 font-medium">
                    {p.question}
                  </p>
                </div>

                <button
                  onClick={() => handleStartContemplation(p.question)}
                  className="px-4 py-2 rounded-xl bg-[#F5EFEB] dark:bg-[#272422] hover:bg-[#9A3412] hover:text-white dark:hover:bg-[#EA580C] dark:hover:text-white text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <Feather size={13} />
                  <span>Write Reflection</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
