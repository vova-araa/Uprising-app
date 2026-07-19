import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ArrowLeft, School, Users, CalendarDays, Loader2, Route,
  Mail, Phone, MapPin, User, ExternalLink, ChevronRight,
  Clock, FileText, CheckCircle2, AlertCircle, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import OrgTrajectDetail from "./OrgTrajectDetail";
import OrgWorkshopDetail from "./OrgWorkshopDetail";

interface Props {
  schoolId: string;
  onBack: () => void;
}

const statusLabels: Record<string, string> = {
  active: "Lopend", completed: "Afgerond", paused: "Gepauzeerd", planned: "Werving",
};
const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  completed: "bg-primary/15 text-primary border-primary/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  planned: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

const OrgSchoolDetail = ({ schoolId, onBack }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<any>(null);
  const [trajecten, setTrajecten] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [workshopReports, setWorkshopReports] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Navigation
  const [selectedTrajectId, setSelectedTrajectId] = useState<string | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [schoolRes, trajRes, teamRes] = await Promise.all([
      supabase.from("org_schools" as any).select("*").eq("id", schoolId).single(),
      supabase.from("org_trajecten" as any).select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("org_team_members" as any).select("*").eq("is_active", true),
    ]);
    setSchool((schoolRes.data as any) || null);
    const trajs = (trajRes.data as any[]) || [];
    setTrajecten(trajs);
    setTeamMembers((teamRes.data as any[]) || []);

    // Get sessions linked to these trajecten
    const trajectIds = trajs.map((t: any) => t.id);
    if (trajectIds.length > 0) {
      const [sessRes, repRes, partRes, taskRes] = await Promise.all([
        supabase.from("org_sessions" as any).select("*").in("traject_id", trajectIds).order("session_date", { ascending: false }),
        supabase.from("org_session_reports" as any).select("*"),
        supabase.from("org_participants" as any).select("*").in("traject_id", trajectIds),
        supabase.from("org_tasks" as any).select("*").in("traject_id", trajectIds),
      ]);
      setSessions((sessRes.data as any[]) || []);
      setReports((repRes.data as any[]) || []);
      setParticipants((partRes.data as any[]) || []);
      setTasks((taskRes.data as any[]) || []);
    }

    // Get workshops linked to this school's location
    const schoolData = schoolRes.data as any;
    if (schoolData?.location_id) {
      // Find workshop sessions at this location
      const { data: wsSessions } = await supabase
        .from("org_sessions" as any)
        .select("*")
        .eq("location_id", schoolData.location_id)
        .eq("session_type", "workshop")
        .order("session_date", { ascending: false });
      
      // Also get broedplaats workshops
      const { data: bwData } = await supabase
        .from("broedplaats_workshops" as any)
        .select("*")
        .order("workshop_date", { ascending: false });
      
      const { data: bwReports } = await supabase
        .from("org_workshop_reports" as any)
        .select("*");
      
      setWorkshops((bwData as any[]) || []);
      setWorkshopReports((bwReports as any[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [schoolId]);

  const reportedSessionIds = useMemo(() => new Set(reports.map(r => r.session_id)), [reports]);
  const openTasks = useMemo(() => tasks.filter(t => t.status === "open" || t.status === "in_progress"), [tasks]);
  const pastSessions = useMemo(() => sessions.filter(s => new Date(s.session_date) < new Date(new Date().toDateString())), [sessions]);
  const reportedCount = useMemo(() => pastSessions.filter(s => reportedSessionIds.has(s.id)).length, [pastSessions, reportedSessionIds]);
  const missingReports = pastSessions.length - reportedCount;
  const totalParticipants = participants.length;
  const totalSessions = sessions.length;

  const schoolProgress = useMemo(() => {
    if (trajecten.length === 0) return 0;
    let total = 4;
    let done = 0;
    if (trajecten.length > 0) done++;
    if (totalParticipants > 0) done++;
    if (pastSessions.length > 0 && missingReports === 0) done++;
    if (openTasks.length === 0 && tasks.length > 0) done++;
    return Math.round((done / total) * 100);
  }, [trajecten, totalParticipants, pastSessions, missingReports, openTasks, tasks]);

  // Sub-detail navigation
  if (selectedTrajectId) {
    return <OrgTrajectDetail trajectId={selectedTrajectId} onBack={() => setSelectedTrajectId(null)} />;
  }
  if (selectedWorkshopId) {
    return <OrgWorkshopDetail workshopId={selectedWorkshopId} onBack={() => setSelectedWorkshopId(null)} />;
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  if (!school) return <div className="text-center py-16 text-muted-foreground">School niet gevonden</div>;

  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
  };

  const teamMember = (id: string | null) => teamMembers.find(m => m.id === id);

  return (
    <div className="space-y-5 pb-20">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft size={16} /> Terug naar Scholen
      </Button>

      {/* ── School Header ── */}
      <div className="p-5 rounded-xl border border-border bg-card border-l-4 border-l-primary">
        <div className="flex items-center gap-3 mb-2">
          <School size={22} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">{school.name}</h1>
          {!school.is_active && <Badge variant="outline" className="text-xs opacity-60">Inactief</Badge>}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground ml-[34px]">
          {school.contact_person && (
            <span className="flex items-center gap-1.5"><User size={12} />{school.contact_person}</span>
          )}
          {school.contact_email && (
            <a href={`mailto:${school.contact_email}`} className="flex items-center gap-1.5 text-primary hover:underline">
              <Mail size={12} />{school.contact_email}
            </a>
          )}
          {school.contact_phone && (
            <a href={`tel:${school.contact_phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
              <Phone size={12} />{school.contact_phone}
            </a>
          )}
          {school.address && (
            <button onClick={() => openMaps(school.address)} className="flex items-center gap-1.5 text-primary hover:underline">
              <MapPin size={12} />{school.address}<ExternalLink size={9} className="opacity-60" />
            </button>
          )}
        </div>

        {school.notes && <p className="text-xs text-muted-foreground ml-[34px] mt-2">{school.notes}</p>}

        {/* Progress bar */}
        <div className="mt-4 space-y-1.5 ml-[34px]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Totale voortgang</span>
            <span className="text-foreground font-medium">{schoolProgress}%</span>
          </div>
          <Progress value={schoolProgress} className="h-2" />
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <div className="text-2xl font-bold text-foreground">{trajecten.length}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Trajecten</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <div className="text-2xl font-bold text-foreground">{totalParticipants}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Deelnemers</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <div className="text-2xl font-bold text-foreground">{totalSessions}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Sessies</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <div className={`text-2xl font-bold ${missingReports > 0 ? "text-destructive" : "text-emerald-400"}`}>
            {missingReports > 0 ? missingReports : "✓"}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
            {missingReports > 0 ? "Ontbrekende rapporten" : "Rapporten compleet"}
          </div>
        </div>
      </div>

      {/* ── Open Taken ── */}
      {openTasks.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-foreground">Openstaande taken ({openTasks.length})</h2>
          </div>
          <div className="space-y-1.5">
            {openTasks.slice(0, 5).map(t => {
              const traj = trajecten.find(tr => tr.id === t.traject_id);
              return (
                <div key={t.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-secondary/30">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${t.priority === "high" ? "bg-destructive" : t.priority === "normal" ? "bg-amber-400" : "bg-muted-foreground/40"}`} />
                  <span className="text-foreground font-medium truncate flex-1">{t.title}</span>
                  {traj && <span className="text-muted-foreground truncate">{traj.title}</span>}
                  {t.deadline && (
                    <span className="text-muted-foreground shrink-0">{format(new Date(t.deadline), "d MMM", { locale: nl })}</span>
                  )}
                </div>
              );
            })}
            {openTasks.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">+ {openTasks.length - 5} meer</p>
            )}
          </div>
        </div>
      )}

      {/* ── Trajecten ── */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Route size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Trajecten</h2>
          <Badge variant="outline" className="text-[10px] ml-1">{trajecten.length}</Badge>
        </div>

        {trajecten.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nog geen trajecten gekoppeld aan deze school</p>
        ) : (
          <div className="space-y-2">
            {trajecten.map(t => {
              const trajSessions = sessions.filter(s => s.traject_id === t.id);
              const trajPastSessions = trajSessions.filter(s => new Date(s.session_date) < new Date(new Date().toDateString()));
              const trajReported = trajPastSessions.filter(s => reportedSessionIds.has(s.id)).length;
              const trajParticipants = participants.filter(p => p.traject_id === t.id);
              const trajMissing = trajPastSessions.length - trajReported;
              const member = teamMember(t.team_member_id);

              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrajectId(t.id)}
                  className="w-full p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors text-left group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.status === "active" ? "bg-emerald-500" : t.status === "completed" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      <span className="text-sm font-medium text-foreground truncate">{t.title}</span>
                      <Badge className={`text-[9px] border ${statusColors[t.status] || "bg-muted"}`}>
                        {statusLabels[t.status] || t.status}
                      </Badge>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground ml-[18px]">
                    {t.start_date && t.end_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={10} />
                        {format(new Date(t.start_date), "d MMM", { locale: nl })} – {format(new Date(t.end_date), "d MMM yyyy", { locale: nl })}
                      </span>
                    )}
                    <span className="flex items-center gap-1"><Users size={10} />{trajParticipants.length} deelnemers</span>
                    <span className="flex items-center gap-1"><CalendarDays size={10} />{trajSessions.length} sessies</span>
                    {member && <span className="flex items-center gap-1"><User size={10} />{member.name}</span>}
                    {trajMissing > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle size={10} />{trajMissing} rapport{trajMissing !== 1 ? "en" : ""} ontbreekt
                      </span>
                    )}
                    {trajMissing === 0 && trajPastSessions.length > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={10} />Rapporten compleet
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Workshops ── */}
      {workshops.length > 0 && (
        <div className="p-5 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Workshops</h2>
            <Badge variant="outline" className="text-[10px] ml-1">{workshops.length}</Badge>
          </div>

          <div className="space-y-2">
            {workshops.map(w => {
              const isPast = new Date(w.workshop_date) < new Date(new Date().toDateString());
              const hasReport = workshopReports.some(r => r.workshop_id === w.id);

              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkshopId(w.id)}
                  className="w-full p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors text-left group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen size={14} className="text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{w.title}</span>
                      {isPast
                        ? <Badge variant="outline" className="text-[9px] opacity-60">Verlopen</Badge>
                        : <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Gepland</Badge>
                      }
                      {hasReport && <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Rapport ✓</Badge>}
                      {isPast && !hasReport && <Badge className="text-[9px] bg-destructive/15 text-destructive border border-destructive/30">Rapport mist</Badge>}
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground ml-[22px]">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={10} />
                      {format(new Date(w.workshop_date), "EEEE d MMMM yyyy", { locale: nl })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />{w.start_time} – {w.end_time}
                    </span>
                    {w.learning_module && (
                      <span className="flex items-center gap-1">📚 {w.learning_module}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recente Sessies ── */}
      {sessions.length > 0 && (
        <div className="p-5 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Recente sessies</h2>
            <Badge variant="outline" className="text-[10px] ml-1">{sessions.length}</Badge>
          </div>

          <div className="space-y-1.5">
            {sessions.slice(0, 10).map(s => {
              const isPast = new Date(s.session_date) < new Date(new Date().toDateString());
              const hasReport = reportedSessionIds.has(s.id);
              const traj = trajecten.find(t => t.id === s.traject_id);

              return (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {isPast && hasReport && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                    {isPast && !hasReport && <AlertCircle size={12} className="text-destructive shrink-0" />}
                    {!isPast && <Clock size={12} className="text-muted-foreground shrink-0" />}
                    <span className="font-medium text-foreground truncate">{s.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                    {traj && <span className="text-[10px]">{traj.title}</span>}
                    <span>{format(new Date(s.session_date), "d MMM", { locale: nl })}</span>
                    <span>{s.start_time}–{s.end_time}</span>
                  </div>
                </div>
              );
            })}
            {sessions.length > 10 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">+ {sessions.length - 10} meer sessies</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgSchoolDetail;
