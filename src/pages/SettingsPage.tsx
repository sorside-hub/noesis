import React, { useState } from 'react';
import { useNoesis } from '../context/NoesisContext';
import {
  Download,
  RotateCcw,
  Check,
  Type,
  BookOpen,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { INITIAL_NOTES, INITIAL_NOTEBOOKS, INITIAL_RELICS, INITIAL_PROJECTS } from '../data/mockData';

export const SettingsPage: React.FC = () => {
  const { notes, relics } = useNoesis();
  const [copiedExport, setCopiedExport] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const [fontSize, setFontSize] = useState<'standard' | 'generous' | 'large'>('standard');
  const [showWordCount, setShowWordCount] = useState(true);

  const handleExportJSON = () => {
    const data = {
      app: 'Noesis',
      version: 'Phase 1 - UI/UX Foundation',
      exportDate: new Date().toISOString(),
      notes,
      relics,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noesis-library-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2500);
  };

  const handleResetData = () => {
    if (confirm('Reset all notes and relics to default editorial sample content?')) {
      localStorage.setItem('noesis_notes', JSON.stringify(INITIAL_NOTES));
      localStorage.setItem('noesis_notebooks', JSON.stringify(INITIAL_NOTEBOOKS));
      localStorage.setItem('noesis_relics', JSON.stringify(INITIAL_RELICS));
      localStorage.setItem('noesis_projects', JSON.stringify(INITIAL_PROJECTS));
      setResetNotice(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-6 sm:px-10 lg:px-14 py-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#9A3412] dark:text-[#EA580C]">
            Workspace Configuration
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] mt-1">
            Settings & Aesthetics
          </h1>
          <p className="text-sm text-[#6B635B] dark:text-[#A8A196] mt-1">
            Customize typography and manage your local offline archive. Theme preference is controlled via the header/sidebar toggle.
          </p>
        </div>

        {/* Typography & Reading Rhythm */}
        <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
          <div>
            <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Typographic Scale
            </h2>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1">
              Fine-tune the measure and baseline cadence for comfortable long-form reading.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'standard', label: 'Standard (16px / 1.75)' },
              { id: 'generous', label: 'Generous (18px / 1.85)' },
              { id: 'large', label: 'Large (20px / 1.9)' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFontSize(opt.id as any)}
                className={`p-3 rounded-xl border text-xs font-medium text-center transition-all ${
                  fontSize === opt.id
                    ? 'border-[#9A3412] bg-[#FAF7F2] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60">
            <div>
              <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] block">
                Editor Telemetry Strip
              </span>
              <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">
                Show word and character statistics in the lower editor footer.
              </span>
            </div>

            <button
              onClick={() => setShowWordCount((prev) => !prev)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                showWordCount ? 'bg-[#9A3412]' : 'bg-[#E8E2D8] dark:bg-[#332F2C]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  showWordCount ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Data Management & Preservation */}
        <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
          <div>
            <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Data Management & Local Persistence
            </h2>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1">
              Phase 1 runs strictly on local state and browser memory. Export your thoughts at any time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleExportJSON}
              className="px-4 py-2.5 rounded-xl bg-[#221F1D] dark:bg-[#EDE8E1] text-white dark:text-[#151413] text-xs font-medium hover:bg-[#383330] dark:hover:bg-white transition-colors flex items-center gap-2 shadow-xs"
            >
              <Download size={14} />
              <span>{copiedExport ? 'Archive Downloaded!' : 'Export Knowledge Archive (JSON)'}</span>
            </button>

            <button
              onClick={handleResetData}
              className="px-4 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={14} />
              <span>{resetNotice ? 'Resetting...' : 'Restore Sample Data'}</span>
            </button>
          </div>
        </div>

        {/* Phase 1 Architecture Notice */}
        <div className="p-5 rounded-2xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-start gap-3">
          <ShieldCheck size={18} className="text-[#9A3412] dark:text-[#EA580C] shrink-0 mt-0.5" />
          <div className="text-xs text-[#6B635B] dark:text-[#A8A196] space-y-1">
            <p className="font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Phase 1: UI/UX Foundation Active
            </p>
            <p>
              Strictly limited to frontend visual design, Tiptap rich text editing, responsive layout systems, and mock state demonstrations. No external databases, Supabase, or AI backend services are invoked in this phase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
