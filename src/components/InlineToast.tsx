import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
  sectionEl: HTMLElement | null;
}

// ── Global store ──
let globalId = 0;
let currentToast: ToastState | null = null;
let currentShake = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

let lastSectionEl: HTMLElement | null = null;

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement;
    lastSectionEl = target.closest("[data-toast-section]") as HTMLElement | null;
  }, { passive: true, capture: true });
}

function showToast(message: string, type: ToastType = "error") {
  globalId++;
  currentToast = { message, type, id: globalId, sectionEl: lastSectionEl };
  currentShake = true;
  emit();

  setTimeout(() => { currentShake = false; emit(); }, 500);

  const dismiss = () => {
    currentToast = null;
    emit();
    document.removeEventListener("pointerdown", dismiss);
    document.removeEventListener("keydown", dismiss);
  };
  setTimeout(() => {
    document.addEventListener("pointerdown", dismiss, { once: true, passive: true });
    document.addEventListener("keydown", dismiss, { once: true, passive: true });
  }, 400);
}

// ── Styles ──
const typeStyles: Record<ToastType, string> = {
  error: "bg-destructive/10 border-destructive/20 text-destructive",
  success: "bg-[hsl(142_76%_36%/0.1)] border-[hsl(142_76%_36%/0.2)] text-[hsl(142,76%,36%)]",
  warning: "bg-[hsl(38_92%_50%/0.1)] border-[hsl(38_92%_50%/0.2)] text-[hsl(38,92%,50%)]",
  info: "bg-primary/10 border-primary/20 text-primary",
};

// ── Toast element (CSS-only animations) ──
const ToastContent = ({ toast, shake }: { toast: ToastState; shake: boolean }) => (
  <div
    key={toast.id}
    className={`rounded-xl border px-4 py-3 text-sm font-medium text-center shadow-lg w-full mt-3 ${typeStyles[toast.type]} animate-toast-in ${shake ? "animate-toast-shake" : ""}`}
  >
    {toast.message}
  </div>
);

// ── Renderer ──
export const InlineToastRenderer = () => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const update = () => {
      setToast(currentToast ? { ...currentToast } : null);
      setShake(currentShake);
    };
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  if (!toast) return null;

  if (toast.sectionEl) {
    return createPortal(
      <ToastContent toast={toast} shake={shake} />,
      toast.sectionEl
    );
  }

  return (
    <div className="px-4 max-w-sm mx-auto">
      <ToastContent toast={toast} shake={shake} />
    </div>
  );
};

// ── Public API ──
export const inlineToast = {
  success: (msg: string) => showToast(msg, "success"),
  error: (msg: string) => showToast(msg, "error"),
  info: (msg: string) => showToast(msg, "info"),
  warning: (msg: string) => showToast(msg, "warning"),
  message: (msg: string) => showToast(msg, "info"),
};

// Backward compat
export const InlineToastProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const InlineToastBridge = () => null;
export const useInlineToast = () => ({
  show: showToast,
  dismiss: () => { currentToast = null; emit(); },
});