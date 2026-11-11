import React from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemType?: 'note' | 'fragment';
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemType = 'note',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-[#FAF7F2] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <Trash2 size={17} />
          </div>
          <div>
            <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Hapus {itemType === 'fragment' ? 'fragment' : 'note'}?
            </h3>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
              Tindakan ini tidak bisa dibatalkan.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-xs transition-colors"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
};
