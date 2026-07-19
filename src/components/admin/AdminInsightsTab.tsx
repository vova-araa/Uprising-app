import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Clock, XCircle, UserX, Euro, BellRing } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from "recharts";

const STUDIO_NAMES: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
};

interface BookingRow {
  id: string;
  studio_id: string;
  booking_date: string;
  duration_hours: number;
  total_price: number;
  status: string;
  session_type: string;
  user_id: string;
  cancellation_refund: string | null;
}

const AdminInsightsTab = () => {
  const [days, setDays] = useState<30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [checkins, setCheckins] = useState<Map<string, string | null>>(new Map());
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});
  const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];

      const [bookingsRes, accessRes, waitlistRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, studio_id, booking_date, duration_hours, total_price, status, session_type, user_id, cancellation_refund")
          .gte("booking_date", since)
          .order("booking_date", { ascending: true }),
        supabase
          .from("booking_access")
          .select("booking_id, checked_in_at")
          .gte("access_start", new Date(Date.now() - days * 86_400_000).toISOString()),
        supabase
          .from("booking_waitlist")
          .select("studio_id")
          .gte("booking_date", today),
      ]);

      const rows = (bookingsRes.data || []) as BookingRow[];
      setBookings(rows);
      setCheckins(new Map((accessRes.data || []).map((a: any) => [a.booking_id, a.checked_in_at])));

      const wl: Record<string, number> = {};
      for (const w of waitlistRes.data || []) {
        wl[(w as any).studio_id] = (wl[(w as any).studio_id] || 0) + 1;
      }
      setWaitlistCounts(wl);

      // Top customers
      const byUser = new Map<string, number>();
      for (const b of rows.filter((r) => r.status === "confirmed")) {
        byUser.set(b.user_id, (byUser.get(b.user_id) || 0) + b.duration_hours);
      }
      const topIds = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
      if (topIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", topIds);
        setProfileNames(new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.email || "Onbekend"])));
      }

      setLoading(false);
    };
    load();
  }, [days]);

  const stats = useMemo(() => {
    const confirmed = bookings.filter((b) => b.status === "confirmed");
    const cancelled = bookings.filter((b) => b.status === "cancelled");
    const today = new Date().toISOString().split("T")[0];
    const pastConfirmed = confirmed.filter((b) => b.booking_date < today);

    const revenue = confirmed.reduce((sum, b) => sum + Number(b.total_price || 0), 0);
    const hours = confirmed.reduce((sum, b) => sum + b.duration_hours, 0);

    // No-show: past bookings with an access record but no check-in
    let noShows = 0;
    let withAccess = 0;
    for (const b of pastConfirmed) {
      if (checkins.has(b.id)) {
        withAccess++;
        if (!checkins.get(b.id)) noShows++;
      }
    }

    // Per-week series
    const weekly = new Map<string, { week: string; boekingen: number; omzet: number; uren: number }>();
    for (const b of confirmed) {
      const d = new Date(b.booking_date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().split("T")[0].slice(5); // MM-DD
      const entry = weekly.get(key) || { week: key, boekingen: 0, omzet: 0, uren: 0 };
      entry.boekingen++;
      entry.omzet += Number(b.total_price || 0);
      entry.uren += b.duration_hours;
      weekly.set(key, entry);
    }

    // Per-studio hours
    const perStudio = Object.keys(STUDIO_NAMES).map((sid) => ({
      studio: STUDIO_NAMES[sid],
      uren: confirmed.filter((b) => b.studio_id === sid).reduce((s, b) => s + b.duration_hours, 0),
      wachtlijst: waitlistCounts[sid] || 0,
    }));

    // Top customers
    const byUser = new Map<string, number>();
    for (const b of confirmed) byUser.set(b.user_id, (byUser.get(b.user_id) || 0) + b.duration_hours);
    const topCustomers = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      totalBookings: confirmed.length,
      hours,
      revenue,
      cancelRate: bookings.length > 0 ? Math.round((cancelled.length / bookings.length) * 100) : 0,
      cancelledCount: cancelled.length,
      noShowRate: withAccess > 0 ? Math.round((noShows / withAccess) * 100) : null,
      weekly: [...weekly.values()],
      perStudio,
      topCustomers,
    };
  }, [bookings, checkins, waitlistCounts]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  const kpis = [
    { icon: TrendingUp, label: "Boekingen", value: String(stats.totalBookings) },
    { icon: Clock, label: "Geboekte uren", value: `${stats.hours}u` },
    { icon: Euro, label: "Omzet (boekingen)", value: `€${Math.round(stats.revenue)}` },
    { icon: XCircle, label: "Annuleringsratio", value: `${stats.cancelRate}%` },
    { icon: UserX, label: "No-show ratio", value: stats.noShowRate != null ? `${stats.noShowRate}%` : "n.v.t." },
    { icon: BellRing, label: "Op wachtlijst (nu)", value: String(Object.values(waitlistCounts).reduce((a, b) => a + b, 0)) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold font-display">Insights</h2>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {[30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d as 30 | 90)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {d} dagen
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-card border border-border p-3">
            <kpi.icon size={14} className="text-primary mb-1.5" />
            <p className="text-lg font-bold font-display">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-xs font-semibold mb-3">Boekingen & omzet per week</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.weekly} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="boekingen" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="omzet" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-xs font-semibold mb-3">Uren per ruimte (+ wachtlijst-vraag)</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.perStudio} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="studio" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="uren" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wachtlijst" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.topCustomers.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-xs font-semibold mb-2">Top klanten (uren)</p>
          <div className="space-y-1.5">
            {stats.topCustomers.map(([userId, hrs], i) => (
              <div key={userId} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{i + 1}. {profileNames.get(userId) || "Onbekend"}</span>
                <span className="font-semibold">{hrs}u</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInsightsTab;
