import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

// PWA install prompt. Shows a dismissible banner when the browser fires
// beforeinstallprompt (Android/desktop Chrome). iOS Safari has no such event,
// so it stays hidden there (users add via Share -> Add to Home Screen).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "uprising-install-dismissed";

const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    // Already installed?
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setVisible(false);
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[60] flex justify-center px-4 lg:hidden"
      style={{ bottom: "calc(var(--bottom-nav-total-offset) + 12px)" }}
    >
      <div className="flex items-center gap-3 rounded-2xl glass border border-primary/30 shadow-elevated px-4 py-3 max-w-sm w-full">
        <img src="/uprising-logo.png" alt="" className="h-9 w-9 rounded-lg" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Installeer de app</p>
          <p className="text-[11px] text-muted-foreground">Sneller boeken, ook offline.</p>
        </div>
        <button onClick={install} className="rounded-lg gradient-primary px-3 py-2 text-xs font-bold text-primary-foreground flex items-center gap-1">
          <Download size={13} /> Installeer
        </button>
        <button onClick={dismiss} aria-label="Sluiten" className="text-muted-foreground"><X size={16} /></button>
      </div>
    </div>
  );
};

export default InstallPrompt;
