import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Promise-based confirmation dialog that matches the premium dark theme —
 * a styled replacement for window.confirm() that also renders inside a
 * Capacitor/native wrapper (where window.confirm may not show).
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Verwijderen?", destructive: true }))) return;
 */
export const ConfirmDialogProvider = ({ children }: { children: ReactNode }) => {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm px-6"
          onClick={() => close(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="animate-fade-in rounded-2xl card-premium border border-border p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${opts.destructive ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                <AlertTriangle size={18} />
              </div>
              <h3 className="font-display font-semibold text-base">{opts.title}</h3>
            </div>
            {opts.message && <p className="text-sm text-muted-foreground">{opts.message}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => close(false)}
                className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium"
              >
                {opts.cancelLabel || "Annuleren"}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground ${opts.destructive ? "bg-destructive" : "gradient-primary shadow-glow"}`}
              >
                {opts.confirmLabel || "Bevestigen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  return ctx;
};
