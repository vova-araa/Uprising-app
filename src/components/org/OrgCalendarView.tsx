import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, addWeeks, subWeeks } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Loader2, MapPin, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { LoadError } from "@/components/LoadError";
import OrgSessionDialog from "./OrgSessionDialog";

type ViewMode = "month" | "week" | "day";

const OrgCalendarView = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
    const [sessRes, locRes, teamRes, bpRes] = await Promise.all([
      supabase.from("org_sessions" as any).select("*").order("session_date", { ascending: true }),
      supabase.from("org_locations" as any).select("*").eq("is_active", true),
      supabase.from("org_team_members" as any).select("*").eq("is_active", true),
      (supabase.from as any)("broedplaats_workshops").select("*").order("workshop_date", { ascending: true }),
    ]);
    if (sessRes.error) throw sessRes.error;
    const orgSessions = (sessRes.data as any[]) || [];
    const bpWorkshops = ((bpRes.data as any[]) || []).map((ws: any) => ({
      id: `bp-${ws.id}`,
      title: `🔥 Broedplaats: ${ws.learning_module || "Workshop"}`,
      session_type: "broedplaats",
      session_date: ws.workshop_date,
      start_time: ws.start_time,
      end_time: ws.end_time,
      location_id: null,
      team_member_id: null,
      traject_id: null,
      description: ws.description,
      _isBroedplaats: true,
    }));
    setSessions([...orgSessions, ...bpWorkshops]);
    setLocations((locRes.data as any[]) || []);
    setTeamMembers((teamRes.data as any[]) || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const navigate = (dir: number) => {
    if (viewMode === "month") setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const getSessionsForDate = (date: Date) =>
    sessions.filter(s => s.session_date === format(date, "yyyy-MM-dd"));

  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || "";
  const getTeamName = (id: string) => teamMembers.find(t => t.id === id)?.name || "";

  const typeColor = (type: string) =>
    type === "project"
      ? "bg-primary/20 text-primary border-primary/30"
      : type === "traject"
      ? "bg-blue-500/20 text-blue-600 border-blue-500/30"
      : type === "broedplaats"
      ? "bg-orange-500/20 text-orange-600 border-orange-500/30"
      : "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30";

  const typeDot = (type: string) =>
    type === "project" ? "bg-primary"
      : type === "traject" ? "bg-blue-500"
      : type === "broedplaats" ? "bg-orange-500"
      : "bg-[hsl(var(--success))]";

  const openNew = (date?: Date) => {
    setEditingSession(null);
    setSelectedDate(date || null);
    setDialogOpen(true);
  };

  const openEdit = (session: any) => {
    if (session._isBroedplaats) return;
    setEditingSession(session);
    setDialogOpen(true);
  };

  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  // Mobile month: compact grid with dots, tap to expand day
  const renderMobileMonth = () => {
    const dateKey = expandedDay;
    const expandedSessions = dateKey ? getSessionsForDate(new Date(dateKey)) : [];

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map(d => (
            <div key={d} className="bg-card py-1 text-center text-[10px] font-medium text-muted-foreground">{d}</div>
          ))}
          {monthDays.map((day, i) => {
            const daySessions = getSessionsForDate(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);
            const dayStr = format(day, "yyyy-MM-dd");
            const isExpanded = expandedDay === dayStr;

            return (
              <div
                key={i}
                className={`bg-card min-h-[40px] p-1 flex flex-col items-center cursor-pointer transition-colors ${
                  !isCurrentMonth ? "opacity-30" : ""
                } ${isExpanded ? "ring-1 ring-primary bg-primary/5" : "hover:bg-secondary/40"}`}
                onClick={() => setExpandedDay(isExpanded ? null : dayStr)}
              >
                <span className={`text-[11px] font-medium leading-none ${
                  isToday ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]" : "text-foreground"
                }`}>
                  {format(day, "d")}
                </span>
                {daySessions.length > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {daySessions.slice(0, 3).map(s => (
                      <span key={s.id} className={`w-1.5 h-1.5 rounded-full ${typeDot(s.session_type)}`} />
                    ))}
                    {daySessions.length > 3 && (
                      <span className="text-[8px] text-muted-foreground">+{daySessions.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded day detail */}
        {expandedDay && (
          <div className="bg-card rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {format(new Date(expandedDay), "EEEE d MMMM", { locale: nl })}
              </h3>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => openNew(new Date(expandedDay))}>
                <Plus size={10} /> Toevoegen
              </Button>
            </div>
            {expandedSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Geen sessies</p>
            ) : (
              <div className="space-y-1.5">
                {expandedSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => openEdit(s)}
                    className={`w-full text-left p-2 rounded-lg border text-xs ${typeColor(s.session_type)}`}
                  >
                    <div className="font-medium">{s.title}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px] opacity-80">
                      <span className="flex items-center gap-0.5"><Clock size={9} />{s.start_time} - {s.end_time}</span>
                      {s.location_id && <span className="flex items-center gap-0.5"><MapPin size={9} />{getLocationName(s.location_id)}</span>}
                      {s.team_member_id && <span className="flex items-center gap-0.5"><User size={9} />{getTeamName(s.team_member_id)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Mobile week: vertical agenda list
  const renderMobileWeek = () => (
    <div className="space-y-1">
      {weekDays.map((day, i) => {
        const daySessions = getSessionsForDate(day);
        const isToday = isSameDay(day, new Date());
        return (
          <div key={i} className={`rounded-lg border ${isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {format(day, "EEE", { locale: nl })}
                </span>
                <span className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                  {format(day, "d MMM", { locale: nl })}
                </span>
                {daySessions.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">({daySessions.length})</span>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => openNew(day)}>
                <Plus size={12} className="text-muted-foreground" />
              </Button>
            </div>
            {daySessions.length > 0 && (
              <div className="px-3 pb-2 space-y-1">
                {daySessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => openEdit(s)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded border ${typeColor(s.session_type)}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate flex-1">{s.title}</span>
                      <span className="text-[10px] opacity-70 shrink-0">{s.start_time}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Mobile day: simplified timeline
  const renderMobileDay = () => {
    const daySessions = getSessionsForDate(currentDate);
    return (
      <div className="space-y-2">
        {daySessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Geen sessies gepland</p>
            <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => openNew(currentDate)}>
              <Plus size={12} className="mr-1" /> Sessie toevoegen
            </Button>
          </div>
        ) : (
          daySessions.map(s => (
            <button
              key={s.id}
              onClick={() => openEdit(s)}
              className={`w-full text-left p-3 rounded-lg border ${typeColor(s.session_type)}`}
            >
              <div className="font-medium text-sm">{s.title}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs opacity-80">
                <span className="flex items-center gap-1"><Clock size={11} />{s.start_time} - {s.end_time}</span>
                {s.location_id && <span className="flex items-center gap-1"><MapPin size={11} />{getLocationName(s.location_id)}</span>}
                {s.team_member_id && <span className="flex items-center gap-1"><User size={11} />{getTeamName(s.team_member_id)}</span>}
              </div>
            </button>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header - compact on mobile */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base sm:text-xl font-bold text-foreground">Kalender</h1>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-border overflow-hidden">
            {(["month", "week", "day"] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium transition-colors ${
                  viewMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {m === "month" ? "Maand" : m === "week" ? "Week" : "Dag"}
              </button>
            ))}
          </div>
          <Button size="sm" className="h-7 text-xs gap-1 px-2" onClick={() => openNew()}>
            <Plus size={12} /> {!isMobile && "Nieuw"}
          </Button>
        </div>
      </div>

      {/* Nav - compact */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-sm sm:text-lg font-semibold text-foreground capitalize">
          {viewMode === "day"
            ? format(currentDate, isMobile ? "EEE d MMM" : "EEEE d MMMM yyyy", { locale: nl })
            : viewMode === "week"
            ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: nl })} – ${format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6), "d MMM", { locale: nl })}`
            : format(currentDate, "MMMM yyyy", { locale: nl })}
        </h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : loadError ? (
        <LoadError message="De agenda kon niet worden geladen." onRetry={loadData} />
      ) : isMobile ? (
        // Mobile views
        viewMode === "month" ? renderMobileMonth()
          : viewMode === "week" ? renderMobileWeek()
          : renderMobileDay()
      ) : viewMode === "month" ? (
        /* Desktop Month view */
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map(d => (
            <div key={d} className="bg-card p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
          {monthDays.map((day, i) => {
            const daySessions = getSessionsForDate(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);
            return (
              <div
                key={i}
                className={`bg-card min-h-[100px] p-1.5 cursor-pointer hover:bg-secondary/50 transition-colors ${
                  !isCurrentMonth ? "opacity-40" : ""
                }`}
                onClick={() => openNew(day)}
              >
                <span className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-foreground"}`}>
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-0.5">
                  {daySessions.slice(0, 3).map(s => (
                    <button
                      key={s.id}
                      onClick={e => { e.stopPropagation(); openEdit(s); }}
                      className={`w-full text-left text-xs px-1.5 py-0.5 rounded border truncate ${typeColor(s.session_type)}`}
                    >
                      {s.start_time} {s.title}
                    </button>
                  ))}
                  {daySessions.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{daySessions.length - 3} meer</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "week" ? (
        /* Desktop Week view */
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {weekDays.map((day, i) => {
            const daySessions = getSessionsForDate(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={i} className="bg-card min-h-[200px] p-2">
                <div className={`text-center mb-2 ${isToday ? "text-primary font-bold" : "text-foreground"}`}>
                  <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale: nl })}</div>
                  <div className={`text-lg ${isToday ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto" : ""}`}>
                    {format(day, "d")}
                  </div>
                </div>
                <div className="space-y-1">
                  {daySessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => openEdit(s)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded border ${typeColor(s.session_type)}`}
                    >
                      <div className="font-medium truncate">{s.title}</div>
                      <div className="text-[10px] opacity-75">{s.start_time} - {s.end_time}</div>
                      {s.location_id && <div className="text-[10px] opacity-60">{getLocationName(s.location_id)}</div>}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => openNew(day)}
                  className="w-full mt-1 text-xs text-muted-foreground hover:text-primary py-1 transition-colors"
                >
                  + Toevoegen
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Day view */
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {hours.map(h => {
            const timeStr = `${h.toString().padStart(2, "0")}:00`;
            const daySessions = sessions.filter(
              s => s.session_date === format(currentDate, "yyyy-MM-dd") && s.start_time <= timeStr && s.end_time > timeStr
            );
            return (
              <div key={h} className="flex border-b border-border last:border-0">
                <div className="w-16 shrink-0 p-2 text-xs text-muted-foreground text-right border-r border-border">
                  {timeStr}
                </div>
                <div className="flex-1 min-h-[48px] p-1 flex gap-1">
                  {daySessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => openEdit(s)}
                      className={`flex-1 text-left text-xs px-2 py-1 rounded border ${typeColor(s.session_type)}`}
                    >
                      <span className="font-medium">{s.title}</span>
                      {s.location_id && <span className="ml-1 opacity-60">• {getLocationName(s.location_id)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend - compact on mobile */}
      <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full sm:rounded bg-primary/30 border border-primary/40" /> Project
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full sm:rounded bg-blue-500/30 border border-blue-500/40" /> Traject
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full sm:rounded bg-[hsl(var(--success))]/30 border border-[hsl(var(--success))]/40" /> Workshop
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full sm:rounded bg-orange-500/30 border border-orange-500/40" /> Broedplaats
        </span>
      </div>

      <OrgSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={editingSession}
        defaultDate={selectedDate}
        locations={locations}
        teamMembers={teamMembers}
        onSaved={loadData}
      />
    </div>
  );
};

export default OrgCalendarView;
