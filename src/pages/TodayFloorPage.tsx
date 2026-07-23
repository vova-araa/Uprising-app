import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronLeft, Clock, MapPin, Mic, GraduationCap, DoorOpen, RefreshCw, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageSkeleton } from "@/components/PageSkeleton";
import SEO from "@/components/SEO";

const STUDIO_NAMES: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
  "print-shop": "Drukkerij",
};
const studioName = (id: string) => STUDIO_NAMES[id] || id;

interface Row {
  kind: "booking" | "session";
  id: string;
  start: string; // HH:MM
  end?: string;
  where: string;
  who: string;
  status: string;
  paid?: boolean;
}

const statusStyle = (s: string) =>
  s === "confirmed" || s === "paid" || s === "done"
    ? "bg-success/15 text-success"
    : s === "pending" || s === "planned"
    ? "bg-warning/15 text-warning"
    : "bg-secondary text-muted-foreground";

const TodayFloorPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [bkRes, sesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, studio_id, start_time, duration_hours, status, session_type, total_price, user_id")
          .eq("booking_date", today)
          .neq("status", "cancelled"),
        supabase
          .from("org_sessions")
          .select("id, title, start_time, end_time, status, location_id")
          .eq("session_date", today),
      ]);
      if (bkRes.error && sesRes.error) { setError(true); return; }

      const bookings = bkRes.data || [];
      // Resolve names for the bookings (best-effort).
      const userIds = [...new Set(bookings.map((b: any) => b.user_id).filter(Boolean))];
      const nameMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        for (const p of profs || []) nameMap.set(p.id, (p as any).full_name || "Klant");
      }
      // Resolve org location names (best-effort).
      const sessions = sesRes.data || [];
      const locIds = [...new Set(sessions.map((s: any) => s.location_id).filter(Boolean))];
      const locMap = new Map<string, string>();
      if (locIds.length) {
        const { data: locs } = await (supabase.from("org_locations" as any) as any).select("id, name").in("id", locIds);
        for (const l of locs || []) locMap.set(l.id, l.name);
      }

      const hhmm = (t: string) => (t || "").slice(0, 5);
      const merged: Row[] = [
        ...bookings.map((b: any): Row => ({
          kind: "booking",
          id: b.id,
          start: hhmm(b.start_time),
          where: studioName(b.studio_id),
          who: nameMap.get(b.user_id) || (b.session_type === "member" ? "Member" : "Klant"),
          status: b.status,
          paid: Number(b.total_price) === 0 || b.session_type === "member" ? true : b.status === "confirmed",
        })),
        ...sessions.map((s: any): Row => ({
          kind: "session",
          id: s.id,
          start: hhmm(s.start_time),
          end: hhmm(s.end_time),
          where: s.location_id ? (locMap.get(s.location_id) || "Locatie") : "Op locatie",
          who: s.title || "Sessie",
          status: s.status || "planned",
        })),
      ].sort((a, b) => a.start.localeCompare(b.start));

      setRows(merged);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-full pb-nav-offset">
      <SEO title="Vandaag op de vloer — Uprising Studio" description="Dagoverzicht voor het team." path="/vandaag" />
      <div className="glass hairline-top sticky top-0 z-40 border-b border-border px-5 py-4" style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Terug" className="p-1 -ml-1"><ChevronLeft size={22} /></button>
          <div className="flex-1">
            <h1 className="text-lg font-bold font-display">Vandaag op de vloer</h1>
            <p className="text-xs text-muted-foreground capitalize">{format(new Date(), "EEEE d MMMM", { locale: nl })}</p>
          </div>
          <button onClick={load} aria-label="Vernieuwen" className="p-2 rounded-lg bg-card border border-border"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        <button onClick={() => navigate("/admin")}
          className="w-full flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary">
          <DoorOpen size={16} /> Deuren beheren (Nuki) <span className="ml-auto text-xs text-muted-foreground">Admin</span>
        </button>

        {error ? (
          <div className="rounded-xl bg-card border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">Kon het dagoverzicht niet laden.</p>
            <button onClick={load} className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold">Opnieuw proberen</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl card-premium border border-border p-8 text-center">
            <CalendarDays size={30} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Niets gepland vandaag.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <motion.div key={`${r.kind}-${r.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-xl card-premium border border-border p-3.5">
                <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1.5 min-w-[52px]">
                  <Clock size={12} className="text-primary mb-0.5" />
                  <span className="text-xs font-bold font-display">{r.start}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                    {r.kind === "booking" ? <Mic size={13} className="text-primary shrink-0" /> : <GraduationCap size={13} className="text-primary shrink-0" />}
                    {r.where}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    <MapPin size={10} /> {r.who}{r.end ? ` • tot ${r.end}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(r.status)}`}>
                  {r.kind === "booking" && r.paid ? "betaald" : r.status}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayFloorPage;
