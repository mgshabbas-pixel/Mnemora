import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-[#0C0D10] border border-[#EA580C]/40 text-white px-3.5 py-2 text-xs font-semibold shadow-xl">
      <div className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
      <WifiOff className="w-3.5 h-3.5 text-[#EA580C]" />
      <span>Offline Mode — Viewing cached local data</span>
    </div>
  );
};
