import React, { useState } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { RelicType } from '../types';
import { X, Feather, Quote, Brain, Compass, Sparkles, Tag, Check } from 'lucide-react';

export const QuickCaptureModal: React.FC = () => {
  const { isQuickCaptureOpen, setIsQuickCaptureOpen, createRelic } = useNoesis();

  const [type, setType] = useState<RelicType>('memory');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [source, setSource] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  if (!isQuickCaptureOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    createRelic({
      type,
      title: title.trim() || 'Untitled Capture',
      content: content.trim(),
      tags: tags.length ? tags : ['capture'],
      source: source.trim() || undefined,
    });

    setSuccessNotice(true);
    setTimeout(() => {
      setSuccessNotice(false);
      setTitle('');
      setContent('');
      setTagsInput('');
      setSource('');
      setIsQuickCaptureOpen(false);
    }, 600);
  };

  const types: { id: RelicType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'memory', label: 'Memory', icon: Sparkles },
    { id: 'quote', label: 'Quote', icon: Quote },
    { id: 'lesson', label: 'Lesson', icon: Brain },
    { id: 'object', label: 'Object', icon: Compass },
    { id: 'idea', label: 'Idea', icon: Feather },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#FAF7F2] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] dark:border-[#2F2B28]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FED7AA]/40 dark:bg-[#431407]/60 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center">
              <Feather size={16} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Quick Capture
              </h2>
              <p className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">
                Collect a fleeting moment, quote, or relic
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsQuickCaptureOpen(false)}
            className="p-1 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Relic Type Segmented Tabs */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-2">
              Capture Genre
            </label>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-[#F5EFEB] dark:bg-[#272422] rounded-xl border border-[#E8E2D8] dark:border-[#332F2C]">
              {types.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-[#1E1C1A] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                        : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                    }`}
                  >
                    <Icon size={14} className="mb-1" />
                    <span className="text-[11px]">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
              Subject or First Line
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dad's old pocket watch... or Conversation with Sophia"
              autoFocus
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
              Reflection / Notes
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Record the observation, quote excerpt, sensory details, or insight while it is fresh..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] leading-relaxed resize-none"
            />
          </div>

          {/* Tags & Source Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
                Tags (comma separated)
              </label>
              <div className="relative">
                <Tag size={13} className="absolute left-3 top-3 text-[#9C9388]" />
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="time, memory, Kyoto"
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
                Origin / Context (optional)
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Book, location, person..."
                className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E8E2D8] dark:border-[#2F2B28]">
            <span className="text-[11px] text-[#9C9388] font-mono">
              Saved into Relics Stream
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQuickCaptureOpen(false)}
                className="px-3.5 py-2 text-xs text-[#6B635B] dark:text-[#A8A196] hover:underline"
              >
                Dismiss
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs flex items-center gap-1.5"
              >
                {successNotice ? (
                  <>
                    <Check size={14} />
                    <span>Captured!</span>
                  </>
                ) : (
                  <>
                    <Feather size={14} />
                    <span>Save to Sanctuary</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
