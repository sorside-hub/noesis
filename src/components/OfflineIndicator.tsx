import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-[#221F1D] dark:bg-[#EDE8E1] px-3.5 py-2 text-xs font-mono text-white dark:text-[#151413] shadow-xl animate-in slide-in-from-bottom duration-200">
      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
      <WifiOff size={14} className="text-amber-400 dark:text-amber-600 shrink-0" />
      <span>Offline Mode — Menggunakan data lokal (Offline-First)</span>
    </div>
  );
};
