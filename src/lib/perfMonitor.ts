/**
 * Lightweight Web Vitals + route-timings monitor.
 * - No external deps (uses native PerformanceObserver).
 * - Stores rolling samples in memory + localStorage so the admin view
 *   can show data even after a hard navigation/refresh.
 * - Exposes a tiny pub/sub so React components can re-render on updates.
 */

export type VitalName = "LCP" | "CLS" | "INP" | "FCP" | "TTFB";

export interface VitalSample {
  name: VitalName;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  route: string;
  ts: number;
}

export interface RouteTiming {
  path: string;
  /** Duration in ms between route change request and next paint */
  durationMs: number;
  /** Bytes transferred during the navigation (best-effort) */
  resourceBytes?: number;
  ts: number;
}

interface PerfState {
  vitals: VitalSample[];
  routes: RouteTiming[];
}

const LS_KEY = "uprising_perf_v1";
const MAX_VITALS = 50;
const MAX_ROUTES = 100;

const isBrowser = typeof window !== "undefined";

const load = (): PerfState => {
  if (!isBrowser) return { vitals: [], routes: [] };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { vitals: [], routes: [] };
    const parsed = JSON.parse(raw);
    return {
      vitals: Array.isArray(parsed.vitals) ? parsed.vitals.slice(-MAX_VITALS) : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes.slice(-MAX_ROUTES) : [],
    };
  } catch {
    return { vitals: [], routes: [] };
  }
};

const state: PerfState = load();
const listeners = new Set<() => void>();
let saveTimer: number | null = null;

const persist = () => {
  if (!isBrowser) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch { /* quota or disabled */ }
  }, 250);
};

const emit = () => {
  listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
  persist();
};

export const perfMonitor = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  getSnapshot(): PerfState {
    return state;
  },
  clear() {
    state.vitals.length = 0;
    state.routes.length = 0;
    emit();
  },
};

const rate = (name: VitalName, v: number): VitalSample["rating"] => {
  // Thresholds per web.dev/vitals
  switch (name) {
    case "LCP":  return v <= 2500 ? "good" : v <= 4000 ? "needs-improvement" : "poor";
    case "CLS":  return v <= 0.1  ? "good" : v <= 0.25 ? "needs-improvement" : "poor";
    case "INP":  return v <= 200  ? "good" : v <= 500  ? "needs-improvement" : "poor";
    case "FCP":  return v <= 1800 ? "good" : v <= 3000 ? "needs-improvement" : "poor";
    case "TTFB": return v <= 800  ? "good" : v <= 1800 ? "needs-improvement" : "poor";
  }
};

const pushVital = (name: VitalName, value: number) => {
  const route = isBrowser ? window.location.hash.replace(/^#/, "") || "/" : "/";
  state.vitals.push({ name, value, rating: rate(name, value), route, ts: Date.now() });
  if (state.vitals.length > MAX_VITALS) state.vitals.splice(0, state.vitals.length - MAX_VITALS);
  emit();
};

const pushRoute = (path: string, durationMs: number, resourceBytes?: number) => {
  state.routes.push({ path, durationMs, resourceBytes, ts: Date.now() });
  if (state.routes.length > MAX_ROUTES) state.routes.splice(0, state.routes.length - MAX_ROUTES);
  emit();
};

let initialised = false;

export const initPerfMonitor = () => {
  if (!isBrowser || initialised) return;
  initialised = true;

  // --- Web Vitals via PerformanceObserver ---
  try {
    // FCP
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          pushVital("FCP", entry.startTime);
        }
      }
    }).observe({ type: "paint", buffered: true });

    // LCP — keep only final value at page hide
    let lcpValue = 0;
    const lcpObs = new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as any;
      if (last) lcpValue = last.renderTime || last.loadTime || last.startTime;
    });
    lcpObs.observe({ type: "largest-contentful-paint", buffered: true });

    // CLS — sum of session windows
    let clsValue = 0;
    let clsSessionValue = 0;
    let clsSessionEntries: PerformanceEntry[] = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.hadRecentInput) continue;
        const first = clsSessionEntries[0] as any;
        const last  = clsSessionEntries[clsSessionEntries.length - 1] as any;
        if (clsSessionEntries.length &&
            entry.startTime - last.startTime < 1000 &&
            entry.startTime - first.startTime < 5000) {
          clsSessionValue += entry.value;
          clsSessionEntries.push(entry);
        } else {
          clsSessionValue = entry.value;
          clsSessionEntries = [entry];
        }
        if (clsSessionValue > clsValue) clsValue = clsSessionValue;
      }
    }).observe({ type: "layout-shift", buffered: true });

    // INP — track worst slow interaction
    let inpValue = 0;
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.duration > inpValue) inpValue = entry.duration;
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 40 } as any);
    } catch { /* event timing not supported */ }

    // TTFB
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) pushVital("TTFB", nav.responseStart);

    // Flush LCP / CLS / INP on hide
    const flush = () => {
      if (lcpValue) pushVital("LCP", lcpValue);
      pushVital("CLS", clsValue);
      if (inpValue) pushVital("INP", inpValue);
    };
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    addEventListener("pagehide", flush);
  } catch {
    // PerformanceObserver not supported — skip silently
  }

  // --- Route timings (hash-based router) ---
  let pendingPath: string | null = null;
  let pendingStart = 0;
  let lastPath = window.location.hash.replace(/^#/, "") || "/";

  const completePending = () => {
    if (!pendingPath) return;
    const dur = performance.now() - pendingStart;
    pushRoute(pendingPath, Math.round(dur));
    pendingPath = null;
  };

  const onHashChange = () => {
    const next = window.location.hash.replace(/^#/, "") || "/";
    if (next === lastPath) return;
    // Finalise previous pending measurement if user navigated again before paint
    if (pendingPath) completePending();
    pendingPath = next;
    pendingStart = performance.now();
    lastPath = next;
    // Wait for two RAFs → next paint after route render
    requestAnimationFrame(() => requestAnimationFrame(completePending));
  };
  addEventListener("hashchange", onHashChange);
};
