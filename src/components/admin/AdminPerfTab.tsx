import { useEffect, useState, useMemo } from "react";
import { perfMonitor, type VitalName } from "@/lib/perfMonitor";
import { Activity, Gauge, Trash2, TrendingUp } from "lucide-react";

const VITAL_LABEL: Record<VitalName, string> = {
  LCP: "Largest Contentful Paint",
  CLS: "Cumulative Layout Shift",
  INP: "Interaction to Next Paint",
  FCP: "First Contentful Paint",
  TTFB: "Time to First Byte",
};

const VITAL_UNIT: Record<VitalName, string> = {
  LCP: "ms", CLS: "", INP: "ms", FCP: "ms", TTFB: "ms",
};

const ratingClass = (r: "good" | "needs-improvement" | "poor") =>
  r === "good"
    ? "bg-success/15 text-success border-success/30"
    : r === "needs-improvement"
      ? "bg-warning/15 text-warning border-warning/30"
      : "bg-destructive/15 text-destructive border-destructive/30";

const format = (name: VitalName, v: number) =>
  name === "CLS" ? v.toFixed(3) : `${Math.round(v)}`;

const useSnapshot = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const unsub = perfMonitor.subscribe(() => force(n => n + 1));
    return () => { unsub(); };
  }, []);
  return perfMonitor.getSnapshot();
};

const percentile = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
};

const AdminPerfTab = () => {
  const { vitals, routes } = useSnapshot();

  const latestPerVital = useMemo(() => {
    const map = new Map<VitalName, typeof vitals[number]>();
    for (const v of vitals) map.set(v.name, v);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [vitals]);

  const routeStats = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const r of routes) {
      if (!groups.has(r.path)) groups.set(r.path, []);
      groups.get(r.path)!.push(r.durationMs);
    }
    return Array.from(groups.entries())
      .map(([path, durs]) => ({
        path,
        count: durs.length,
        avg: Math.round(durs.reduce((s, n) => s + n, 0) / durs.length),
        p95: Math.round(percentile(durs, 95)),
        max: Math.round(Math.max(...durs)),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [routes]);

  const recentRoutes = useMemo(() => [...routes].slice(-15).reverse(), [routes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-primary" />
          <h2 className="font-display font-bold text-lg">Performance Monitor</h2>
        </div>
        <button
          onClick={() => perfMonitor.clear()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg border border-border"
        >
          <Trash2 size={12} /> Reset
        </button>
      </div>

      {/* Web Vitals cards */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Gauge size={14} className="text-muted-foreground" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Web Vitals (laatste meting)</h3>
        </div>
        {latestPerVital.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nog geen metingen. Navigeer door de app of refresh om data te verzamelen.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {latestPerVital.map(v => (
              <div key={v.name} className={`rounded-xl border p-3 ${ratingClass(v.rating)}`}>
                <p className="text-[10px] font-semibold opacity-70">{v.name}</p>
                <p className="text-xs opacity-60 leading-tight mb-1">{VITAL_LABEL[v.name]}</p>
                <p className="text-2xl font-bold font-display tabular-nums">
                  {format(v.name, v.value)}<span className="text-xs font-normal opacity-60 ml-1">{VITAL_UNIT[v.name]}</span>
                </p>
                <p className="text-[10px] opacity-60 mt-1 truncate" title={v.route}>{v.route}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Per-route timings */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-muted-foreground" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Route opens (per pad)</h3>
        </div>
        {routeStats.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Navigeer tussen pagina's om route timings te zien.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Route</th>
                  <th className="text-right px-2 py-2 font-semibold">N</th>
                  <th className="text-right px-2 py-2 font-semibold">Avg</th>
                  <th className="text-right px-2 py-2 font-semibold">p95</th>
                  <th className="text-right px-3 py-2 font-semibold">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {routeStats.map(r => (
                  <tr key={r.path}>
                    <td className="px-3 py-2 font-mono truncate max-w-[160px]">{r.path}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.count}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-semibold ${r.avg > 600 ? "text-destructive" : r.avg > 300 ? "text-warning" : "text-success"}`}>{r.avg}ms</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.p95}ms</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.max}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent navigations */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recente navigaties</h3>
        {recentRoutes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">Nog geen data.</div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border max-h-72 overflow-y-auto">
            {recentRoutes.map((r, i) => (
              <div key={`${r.ts}-${i}`} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-mono truncate flex-1">{r.path}</span>
                <span className="text-muted-foreground mr-2 text-[10px]">{new Date(r.ts).toLocaleTimeString()}</span>
                <span className={`tabular-nums font-semibold ${r.durationMs > 600 ? "text-destructive" : r.durationMs > 300 ? "text-warning" : "text-success"}`}>
                  {r.durationMs}ms
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[10px] text-muted-foreground text-center">
        Metingen worden lokaal opgeslagen (laatste 50 vitals, 100 routes). LCP/CLS/INP worden geflusht bij visibility-change.
      </p>
    </div>
  );
};

export default AdminPerfTab;
