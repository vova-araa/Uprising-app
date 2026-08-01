import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, subMonths } from "date-fns";
import { nl } from "date-fns/locale";
import { BarChart3, Users, MapPin, Calendar, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(272, 98%, 45%)", "hsl(142, 76%, 36%)", "hsl(200, 80%, 50%)", "hsl(40, 90%, 50%)", "hsl(340, 80%, 55%)"];

const OrgInsights = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sessRes, repRes, locRes] = await Promise.all([
          supabase.from("org_sessions" as any).select("*"),
          supabase.from("org_session_reports" as any).select("*"),
          supabase.from("org_locations" as any).select("*"),
        ]);
        if (sessRes.error) throw sessRes.error;
        setSessions((sessRes.data as any[]) || []);
        setReports((repRes.data as any[]) || []);
        setLocations((locRes.data as any[]) || []);
      } catch {
        // Data will remain empty, empty state shown
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Sessions per month (last 6 months)
  const monthlyData = useMemo(() => {
    const months: { label: string; trajecten: number; workshops: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStr = format(monthDate, "yyyy-MM");
      const label = format(monthDate, "MMM", { locale: nl });
      const monthSessions = sessions.filter(s => s.session_date?.startsWith(monthStr));
      months.push({
        label,
        trajecten: monthSessions.filter(s => s.session_type === "workshop").length,
        workshops: monthSessions.filter(s => s.session_type === "org_workshop").length,
      });
    }
    return months;
  }, [sessions]);

  // Location usage
  const locationData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.location_id) {
        counts[s.location_id] = (counts[s.location_id] || 0) + 1;
      }
    }
    return locations
      .filter(l => counts[l.id])
      .map(l => ({ name: l.name, value: counts[l.id] || 0 }))
      .sort((a, b) => b.value - a.value);
  }, [sessions, locations]);

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.status === "completed").length;
  const totalParticipants = reports.reduce((sum, r) => sum + (r.participant_count || 0), 0);
  const avgParticipants = reports.length > 0 ? Math.round(totalParticipants / reports.length) : 0;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Insights</h1>
        <p className="text-sm text-muted-foreground">Statistieken en overzichten</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Totaal sessies", value: totalSessions, icon: Calendar, color: "text-primary" },
          { label: "Voltooid", value: completedSessions, icon: BarChart3, color: "text-[hsl(var(--success))]" },
          { label: "Totaal deelnemers", value: totalParticipants, icon: Users, color: "text-blue-400" },
          { label: "Gem. deelnemers", value: avgParticipants, icon: Users, color: "text-amber-400" },
        ].map((kpi, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border card-premium">
            <kpi.icon size={20} className={`${kpi.color} mb-2`} />
            <div className="text-2xl font-bold font-display text-foreground">{kpi.value}</div>
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Sessies per maand</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 6%, 18%)" />
              <XAxis dataKey="label" tick={{ fill: "hsl(240, 5%, 80%)", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(240, 5%, 80%)", fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(240, 8%, 10%)", border: "1px solid hsl(240, 6%, 18%)", borderRadius: 8, color: "hsl(0, 0%, 96%)" }}
              />
              <Bar dataKey="trajecten" name="Trajecten" fill="hsl(272, 98%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="workshops" name="Workshops" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Location usage */}
      {locationData.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Bezetting per locatie</h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={locationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {locationData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(240, 8%, 10%)", border: "1px solid hsl(240, 6%, 18%)", borderRadius: 8, color: "hsl(0, 0%, 96%)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {locationData.map((loc, i) => (
                <div key={loc.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {loc.name}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{loc.value} sessies</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgInsights;
