import React, { useState, useEffect } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { FragmentType } from '../types';
import {
  X,
  Feather,
  BookOpen,
  Lightbulb,
  Tag,
  Star,
  Trash2,
  Copy,
  Check,
  Plus,
  Quote,
} from 'lucide-react';

export const FragmentDrawer: React.FC = () => {
  const {
    isFragmentDrawerOpen,
    activeFragmentId,
    closeFragmentDrawer,
    fragments,
    createFragment,
    updateFragment,
    deleteFragment,
    toggleStarFragment,
  } = useNoesis();

  const activeFragment = fragments.find((f) => f.id === activeFragmentId);
  const isCreateMode = !activeFragment;

  // Unified State
  const [selectedType, setSelectedType] = useState<FragmentType>('thought');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('');
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  useEffect(() => {
    if (activeFragment) {
      setSelectedType(activeFragment.type);
      setTitle(activeFragment.title);
      setContent(activeFragment.content);
      setSource(activeFragment.source || '');
      setTagsList(activeFragment.tags || []);
      setTagInput('');
    } else {
      setSelectedType('thought');
      setTitle('');
      setContent('');
      setSource('');
      setTagsList([]);
      setTagInput('');
    }
  }, [activeFragment, activeFragmentId, isFragmentDrawerOpen]);

  if (!isFragmentDrawerOpen) return null;

  const categories: { id: FragmentType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'thought', label: 'Thought', icon: Feather },
    { id: 'reference', label: 'Reference', icon: BookOpen },
    { id: 'idea', label: 'Idea', icon: Lightbulb },
  ];

  // Handlers for inputs
  const handleTypeSelect = (newType: FragmentType) => {
    setSelectedType(newType);
    if (!isCreateMode && activeFragment) {
      updateFragment(activeFragment.id, { type: newType });
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isCreateMode && activeFragment) {
      updateFragment(activeFragment.id, { title: val });
    }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    if (!isCreateMode && activeFragment) {
      updateFragment(activeFragment.id, { content: val });
    }
  };

  const handleSourceChange = (val: string) => {
    setSource(val);
    if (!isCreateMode && activeFragment) {
      updateFragment(activeFragment.id, { source: val.trim() || undefined });
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/^#/, '');
      if (cleaned && !tagsList.includes(cleaned)) {
        const nextTags = [...tagsList, cleaned];
        setTagsList(nextTags);
        if (!isCreateMode && activeFragment) {
          updateFragment(activeFragment.id, { tags: nextTags });
        }
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tagsList.filter((t) => t !== tagToRemove);
    setTagsList(nextTags);
    if (!isCreateMode && activeFragment) {
      updateFragment(activeFragment.id, { tags: nextTags });
    }
  };

  // Submit in Create Mode
  const handleCreateSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    createFragment({
      type: selectedType,
      title: title.trim() || 'Untitled Fragment',
      content: content.trim(),
      tags: tagsList.length > 0 ? tagsList : ['fragment'],
      source: source.trim() || undefined,
    });

    setIsSavedNotice(true);
    setTimeout(() => {
      setIsSavedNotice(false);
      closeFragmentDrawer();
    }, 350);
  };

  // Copy content in View/Edit Mode
  const handleCopyContent = () => {
    if (!activeFragment) return;
    const textToCopy = [
      title,
      content,
      source ? `— ${source}` : null,
      tagsList.length ? tagsList.map((t) => `#${t}`).join(' ') : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    navigator.clipboard?.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={closeFragmentDrawer}
    >
      <div
        className="w-full sm:w-[480px] lg:w-[540px] h-full bg-[#FAF7F2] dark:bg-[#1A1817] border-l border-[#E8E2D8] dark:border-[#2F2B28] shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* HEADER: Distinguished only between Create Mode and View/Edit Mode         */}
        {/* ========================================================================= */}
        {isCreateMode ? (
          <div className="px-5 sm:px-6 py-4 border-b border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between shrink-0 bg-[#FAF7F2] dark:bg-[#1A1817]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center">
                <Feather size={16} />
              </div>
              <div>
                <h2 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Capture Fragment
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={closeFragmentDrawer}
              className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="px-5 sm:px-6 py-4 border-b border-[#E8E2D8] dark:border-[#2F2B28] flex items-center justify-between shrink-0 bg-[#FAF7F2] dark:bg-[#1A1817]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A3412] dark:text-[#EA580C] font-semibold">
                {activeFragment.type}
              </span>
              <span className="text-[#9C9388]">·</span>
              <span className="text-xs font-mono text-[#9C9388] dark:text-[#736C62]">
                {activeFragment.date}
              </span>
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center gap-1">
              {/* Favorite Star */}
              <button
                type="button"
                onClick={() => toggleStarFragment(activeFragment.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  activeFragment.starred
                    ? 'text-[#B45309] dark:text-[#F59E0B] bg-[#FEF3C7] dark:bg-[#78350F]/40'
                    : 'text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422]'
                }`}
                title={activeFragment.starred ? 'Favorited' : 'Add to Favorites'}
              >
                <Star size={16} fill={activeFragment.starred ? 'currentColor' : 'none'} />
              </button>

              {/* Copy Text */}
              <button
                type="button"
                onClick={handleCopyContent}
                className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
                title="Copy Fragment Content"
              >
                {isCopied ? (
                  <Check size={16} className="text-emerald-600" />
                ) : (
                  <Copy size={16} />
                )}
              </button>

              {/* Delete Fragment */}
              <button
                type="button"
                onClick={() => deleteFragment(activeFragment.id)}
                className="p-1.5 rounded-lg text-[#9C9388] hover:text-red-600 hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
                title="Delete Fragment"
              >
                <Trash2 size={16} />
              </button>

              {/* Close Drawer */}
              <button
                type="button"
                onClick={closeFragmentDrawer}
                className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors ml-1"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BODY: 100% IDENTICAL DESIGN FOR BOTH CREATE AND VIEW/EDIT MODES           */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {/* Category Switcher Pill Tabs */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
              Category
            </label>
            <div className="flex items-center gap-1.5 p-1 bg-[#F5EFEB] dark:bg-[#221F1E] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] w-fit">
              {categories.map((c) => {
                const isSelected = selectedType === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleTypeSelect(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      isSelected
                        ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                        : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1">
              Title / First Line
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              autoFocus={isCreateMode}
              className="w-full font-serif text-xl sm:text-2xl font-medium text-[#221F1D] dark:text-[#EDE8E1] bg-transparent border-b border-transparent hover:border-[#E8E2D8] dark:hover:border-[#2F2B28] focus:border-[#9A3412] dark:focus:border-[#EA580C] focus:outline-none py-1 transition-colors"
              placeholder={isCreateMode ? 'Title or first line...' : 'Untitled Fragment...'}
            />
          </div>

          {/* Full Content (NO TRUNCATION, completely readable & editable) */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
              Full Content
            </label>
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              rows={8}
              className="w-full text-sm leading-relaxed p-4 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] transition-colors resize-y min-h-[160px]"
              placeholder={
                isCreateMode
                  ? 'Record your observation, excerpt, quote, sensory details, or idea while fresh...'
                  : 'Write your note...'
              }
            />
          </div>

          {/* Source / Context */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1.5">
              Source / Context
            </label>
            <div className="relative">
              <Quote size={13} className="absolute left-3.5 top-3 text-[#9C9388]" />
              <input
                type="text"
                value={source}
                onChange={(e) => handleSourceChange(e.target.value)}
                placeholder="e.g. Kyoto Teramachi antiquary, Seneca Epistles..."
                className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] transition-colors"
              />
            </div>
          </div>

          {/* Tags Manager */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-2">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tagsList.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-[#F5EFEB] dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] border border-[#E8E2D8] dark:border-[#2F2B28]"
                >
                  <span>#{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-[#9C9388] hover:text-red-600 transition-colors"
                    title="Remove tag"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>

            <div className="relative">
              <Tag size={13} className="absolute left-3.5 top-3 text-[#9C9388]" />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tag and press Enter..."
                className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#221F1E] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FOOTER: Distinguished only between Create Mode and View/Edit Mode         */}
        {/* ========================================================================= */}
        {isCreateMode ? (
          <div className="px-5 sm:px-6 py-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB]/50 dark:bg-[#1E1C1A] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={closeFragmentDrawer}
              className="px-3.5 py-2 text-xs text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleCreateSubmit()}
              disabled={!title.trim() && !content.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              {isSavedNotice ? (
                <>
                  <Check size={14} />
                  <span>Captured!</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Capture</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="px-5 sm:px-6 py-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] bg-[#F5EFEB]/50 dark:bg-[#1E1C1A] flex items-center justify-between shrink-0">
            <span className="text-[11px] font-mono text-[#9C9388] dark:text-[#736C62]">
              Changes saved automatically
            </span>

            <button
              type="button"
              onClick={closeFragmentDrawer}
              className="px-4 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] transition-colors shadow-xs"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
