import React, { useState } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { AlertTriangle, Trash2, LogOut, RotateCcw, X, Loader2 } from 'lucide-react';

export const SafetyConfirmModal: React.FC = () => {
  const {
    safetyModalAction,
    closeSafetyModal,
    confirmSafetyAction,
    authUser,
  } = useNoesis();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!safetyModalAction) return null;

  const config = (() => {
    switch (safetyModalAction) {
      case 'offline-logout':
        return {
          title: 'Keluar Saat Offline?',
          description:
            'Koneksi internet sedang terputus. Jika keluar sekarang, sesi di perangkat ini dan seluruh cache catatan lokal akan langsung dihapus agar aman di perangkat umum. Perubahan yang belum sempat tersinkron ke server tidak akan terunggah.',
          confirmLabel: 'Tetap Keluar & Hapus Cache',
          icon: LogOut,
        };
      case 'wipe-local-exit':
        return {
          title: 'Hapus Data Lokal & Keluar?',
          description:
            'Seluruh catatan, fragments, proyek, dan data sementara di browser ini akan dihapus permanen, lalu kembali ke layar masuk. Sangat disarankan saat selesai menggunakan perangkat umum atau warnet.',
          confirmLabel: 'Hapus Permanen & Keluar',
          icon: Trash2,
        };
      case 'reset-workspace':
      default:
        return {
          title: 'Reset Data Lokal?',
          description: authUser
            ? 'Semua cache catatan, fragments, dan proyek di browser ini akan dikosongkan. Catatan Anda yang sudah tersinkron di server Supabase tetap aman.'
            : 'Semua catatan, fragments, dan proyek yang tersimpan di Mode Lokal browser ini akan dihapus secara permanen.',
          confirmLabel: 'Ya, Reset Data',
          icon: RotateCcw,
        };
    }
  })();

  const ActionIcon = config.icon;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await confirmSafetyAction();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <h3
              id="safety-modal-title"
              className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]"
            >
              {config.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={closeSafetyModal}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] transition-colors disabled:opacity-50"
            aria-label="Tutup dialog"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-[#6B635B] dark:text-[#A8A196]">
          {config.description}
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeSafetyModal}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white text-xs font-medium transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {isProcessing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ActionIcon size={14} />
            )}
            <span>{isProcessing ? 'Memproses...' : config.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
