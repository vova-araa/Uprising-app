import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Euro, Download, Building2, Mic, Music2, AlertCircle } from "lucide-react";
import { LoadError } from "@/components/LoadError";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

// Financial overview for staff: revenue by source and month, outstanding
// label invoices, and CSV export for the bookkeeping.

interface Booking { booking_date: string; total_price: number; status: string; session_type: string; }
interface Project { created_at: string; price: number; status: string; }
interface Invoice { invoice_number: string; total: number; status: string; created_at: string; label_id: string; hours: number; }

const monthKey = (d: string) => d.slice(0, 7); // YYYY-MM

const AdminFinanceTab = () => {
  const [months, setMonths] = useState<6 | 12>(6);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [labelNames, setLabelNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const since = new Date(); since.setMonth(since.getMonth() - months);
        const sinceStr = since.toISOString().split("T")[0];
        const [bRes, pRes, iRes, lRes] = await Promise.all([
          supabase.from("bookings").select("booking_date, total_price, status, session_type").gte("booking_date", sinceStr),
          supabase.from("projects").select("created_at, price, status").gte("created_at", since.toISOString()),
          supabase.from("label_invoices").select("invoice_number, total, status, created_at, label_id, hours").order("created_at", { ascending: false }),
          supabase.from("labels").select("id, name"),
        ]);
        if (bRes.error) throw bRes.error;
        setBookings((bRes.data as Booking[]) || []);
        setProjects((pRes.data as Project[]) || []);
        setInvoices((iRes.data as Invoice[]) || []);
        setLabelNames(new Map(((lRes.data as any[]) || []).map((l) => [l.id, l.name])));
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [months, reloadKey]);

  const data = useMemo(() => {
    const byMonth = new Map<string, { month: string; studio: number; mixmaster: number; labels: number }>();
    const ensure = (m: string) => { if (!byMonth.has(m)) byMonth.set(m, { month: m, studio: 0, mixmaster: 0, labels: 0 }); return byMonth.get(m)!; };

    let studioRev = 0, mmRev = 0, labelRev = 0;
    for (const b of bookings) {
      if (b.status === "confirmed" && Number(b.total_price) > 0) {
        ensure(monthKey(b.booking_date)).studio += Number(b.total_price);
        studioRev += Number(b.total_price);
      }
    }
    for (const p of projects) {
      if (["received", "in_progress", "completed", "delivered"].includes(p.status) && Number(p.price) > 0) {
        ensure(monthKey(p.created_at)).mixmaster += Number(p.price);
        mmRev += Number(p.price);
      }
    }
    for (const inv of invoices) {
      if (inv.status === "paid") {
        ensure(monthKey(inv.created_at)).labels += Number(inv.total);
        labelRev += Number(inv.total);
      }
    }
    const series = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({
      month: r.month.slice(5), studio: Math.round(r.studio), mixmaster: Math.round(r.mixmaster), labels: Math.round(r.labels),
    }));
    const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "draft");
    const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.total), 0);
    return { series, studioRev, mmRev, labelRev, total: studioRev + mmRev + labelRev, outstanding, outstandingTotal };
  }, [bookings, projects, invoices]);

  const exportCsv = () => {
    const rows: string[] = ["type,datum,omschrijving,bedrag,status"];
    for (const b of bookings) if (b.status === "confirmed" && Number(b.total_price) > 0) rows.push(`studio,${b.booking_date},${b.session_type},${b.total_price},confirmed`);
    for (const p of projects) if (Number(p.price) > 0) rows.push(`mix-master,${p.created_at.split("T")[0]},mix & master,${p.price},${p.status}`);
    for (const i of invoices) rows.push(`label-factuur,${i.created_at.split("T")[0]},${i.invoice_number} (${labelNames.get(i.label_id) || ""} ${i.hours}u),${i.total},${i.status}`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `uprising-omzet-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  if (loadError) return <LoadError message="De financiële cijfers konden niet worden geladen." onRetry={() => setReloadKey((k) => k + 1)} />;

  const kpis = [
    { icon: Euro, label: "Totale omzet", value: `€${Math.round(data.total)}` },
    { icon: Mic, label: "Studio", value: `€${Math.round(data.studioRev)}` },
    { icon: Music2, label: "Mix & Master", value: `€${Math.round(data.mmRev)}` },
    { icon: Building2, label: "Labels (betaald)", value: `€${Math.round(data.labelRev)}` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-display flex items-center gap-2"><Euro size={17} className="text-primary" /> Financieel</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {[6, 12].map((m) => <button key={m} onClick={() => setMonths(m as 6 | 12)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${months === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}m</button>)}
          </div>
          <button onClick={exportCsv} className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold flex items-center gap-1"><Download size={13} /> CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-card border border-border p-3">
            <k.icon size={14} className="text-primary mb-1.5" />
            <p className="text-lg font-bold font-display">{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-xs font-semibold mb-3">Omzet per maand per bron</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="studio" stackId="a" fill="hsl(var(--primary))" name="Studio" />
              <Bar dataKey="mixmaster" stackId="a" fill="hsl(var(--success))" name="Mix & Master" />
              <Bar dataKey="labels" stackId="a" fill="hsl(var(--warning))" name="Labels" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold flex items-center gap-1.5"><AlertCircle size={13} className="text-warning" /> Openstaande facturen</p>
          <span className="text-sm font-bold text-warning">€{Math.round(data.outstandingTotal)}</span>
        </div>
        {data.outstanding.length === 0 ? (
          <p className="text-xs text-muted-foreground">Geen openstaande facturen 🎉</p>
        ) : (
          <div className="space-y-1.5">
            {data.outstanding.map((i) => (
              <div key={i.invoice_number} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{i.invoice_number} • {labelNames.get(i.label_id) || "?"}</span>
                <span className="font-semibold">€{Number(i.total).toFixed(2)} <span className="text-[10px] text-muted-foreground">({i.status})</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFinanceTab;
