import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, X, Smartphone } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'header' | 'floating';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'sidebar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Hide if already running in standalone PWA mode
  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (variant === 'floating') {
      return (
        <button
          onClick={install}
          className="fixed bottom-5 right-5 z-40 px-4 py-2.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] shadow-lg flex items-center gap-2 transition-all animate-bounce"
        >
          <Download size={15} />
          <span>Install Noesis App</span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/15 border border-[#9A3412]/20 dark:border-[#EA580C]/30 text-[#9A3412] dark:text-[#EA580C] text-xs font-medium hover:bg-[#9A3412]/15 dark:hover:bg-[#EA580C]/25 transition-colors shadow-2xs group"
        title="Install Noesis on Home Screen / Desktop"
      >
        <div className="flex items-center gap-2 truncate">
          <Download size={14} className="group-hover:scale-110 transition-transform" />
          <span className="truncate">Install App</span>
        </div>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#9A3412]/10 dark:bg-[#EA580C]/20">PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/70 dark:bg-[#221F1E]/70 border border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196] text-xs font-medium hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors shadow-2xs"
        >
          <div className="flex items-center gap-2 truncate">
            <Smartphone size={14} />
            <span className="truncate">Install on iOS</span>
          </div>
          <Share size={12} className="text-[#9C9388]" />
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1817] border border-[#E8E2D8] dark:border-[#2F2B28] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]"
              >
                <X size={16} />
              </button>

              <div className="w-10 h-10 rounded-xl bg-[#9A3412]/10 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center mb-3">
                <Smartphone size={20} />
              </div>

              <h3 className="font-serif text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1] mb-2">
                Pasang Noesis di iPhone / iPad
              </h3>

              <ol className="text-xs text-[#6B635B] dark:text-[#A8A196] space-y-2.5 leading-relaxed font-normal mb-5">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Tekan tombol <strong>Share (Bagikan)</strong> di toolbar Safari bagian bawah browser.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Gulir ke bawah lalu pilih <strong>Add to Home Screen (Tambah ke Layar Utama)</strong>.</span>
                </li>
              </ol>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#9A3412] text-white text-xs font-medium hover:bg-[#78280E] transition-colors"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
