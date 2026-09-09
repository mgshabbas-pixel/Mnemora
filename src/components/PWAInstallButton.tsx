import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2, Monitor } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'banner' | 'settings';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'sidebar',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running in standalone mode, show clean status in settings or hide elsewhere
  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="flex items-center gap-2 text-xs text-[#16A34A] font-semibold bg-[#16A34A]/10 px-3 py-2 rounded-lg border border-[#16A34A]/20">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          <span>Installed as standalone app on this device</span>
        </div>
      );
    }
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setJustInstalled(true);
      }
    } else {
      // Show guided instructions for iOS or desktop browsers
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' && (
        <button
          type="button"
          onClick={handleAction}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer bg-[#17181D] hover:bg-[#22242B] text-white border border-[#272830] group ${className}`}
          title="Install Focus OS as an app on your device"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#16A34A]/20 text-[#4ADE80] flex items-center justify-center group-hover:bg-[#16A34A] group-hover:text-white transition-colors">
              <Download className="w-3 h-3" />
            </div>
            <span>Install App</span>
          </div>
          <span className="text-[10px] font-bold text-[#EA580C] bg-[#EA580C]/10 px-1.5 py-0.5 rounded border border-[#EA580C]/20">
            PWA
          </span>
        </button>
      )}

      {variant === 'banner' && (
        <div className={`bg-[#0C0D10] text-white px-4 py-2.5 border-b border-[#25272C] flex items-center justify-between text-xs ${className}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-[#16A34A] text-white flex items-center justify-center shrink-0">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="font-bold text-white mr-1.5">Install Focus OS:</span>
              <span className="text-[#A1A1AA] hidden sm:inline">Add to your home screen or desktop for fast offline access.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAction}
              className="px-3 py-1 bg-[#16A34A] hover:bg-[#15803D] text-white rounded font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Now</span>
            </button>
          </div>
        </div>
      )}

      {variant === 'settings' && (
        <div className={`p-4 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#16A34A]" />
              <h4 className="text-xs font-bold text-[#121316]">Install Focus OS Application</h4>
            </div>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Launch Focus OS directly from your home screen or taskbar without any browser bars.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAction}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install on This Device</span>
          </button>
        </div>
      )}

      {/* Guided Instruction Modal for iOS and Desktop */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[#0C0D10] border border-[#25272C] text-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#25272C]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#16A34A] flex items-center justify-center font-black text-xs text-white">
                  F
                </div>
                <h3 className="text-sm font-bold text-white">
                  {isIOS ? 'Install on iPhone / iPad' : 'Install Focus OS App'}
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-[#1E2026] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-[#D4D4D8]">
              {isIOS ? (
                <>
                  <p className="text-[#A1A1AA]">
                    Safari on iOS lets you add Focus OS directly to your home screen with its custom icon:
                  </p>
                  <div className="space-y-3 bg-[#16171B] p-3.5 rounded-xl border border-[#25272C]">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#1F2026] text-[#4ADE80] flex items-center justify-center font-bold text-[11px] shrink-0">
                        1
                      </div>
                      <div>
                        <p className="font-semibold text-white flex items-center gap-1.5">
                          Tap the <Share className="w-3.5 h-3.5 text-[#60A5FA]" /> Share button
                        </p>
                        <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                          In the Safari browser bottom toolbar (or top right on iPad).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#1F2026] text-[#4ADE80] flex items-center justify-center font-bold text-[11px] shrink-0">
                        2
                      </div>
                      <div>
                        <p className="font-semibold text-white flex items-center gap-1.5">
                          Select <PlusSquare className="w-3.5 h-3.5 text-white" /> &quot;Add to Home Screen&quot;
                        </p>
                        <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                          Scroll down the share sheet options to find it.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#1F2026] text-[#4ADE80] flex items-center justify-center font-bold text-[11px] shrink-0">
                        3
                      </div>
                      <div>
                        <p className="font-semibold text-white">Tap &quot;Add&quot;</p>
                        <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                          In the top right corner. Focus OS will appear right alongside your other apps.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[#A1A1AA]">
                    You can install Focus OS on your desktop (Chrome, Edge, Brave) or Android phone:
                  </p>
                  <div className="space-y-3 bg-[#16171B] p-3.5 rounded-xl border border-[#25272C]">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#1F2026] text-[#4ADE80] flex items-center justify-center font-bold text-[11px] shrink-0">
                        <Monitor className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">On Desktop (Chrome / Edge):</p>
                        <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                          Look at the right side of the browser address bar for the <strong>Install Focus OS</strong> icon (or click the three dots ⋮ &gt; <em>Install Focus OS</em>).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#1F2026] text-[#FB923C] flex items-center justify-center font-bold text-[11px] shrink-0">
                        <Smartphone className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">On Android (Chrome / Firefox):</p>
                        <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                          Tap the three dots menu ⋮ in the browser and tap <strong>&quot;Add to Home screen&quot;</strong> or <strong>&quot;Install app&quot;</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs transition-colors cursor-pointer mt-2"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
