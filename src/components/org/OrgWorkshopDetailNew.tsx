import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage, SignedLink } from "@/components/SignedStorageFile";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ArrowLeft, Users, CalendarDays, MapPin, Loader2,
  ChevronDown, ChevronUp, FileText, Save, Camera, Upload,
  BookOpen, GraduationCap, TrendingUp, School, UserCheck, UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { inlineToast as toast } from "@/components/InlineToast";
import OrgMilestoneTasks from "./OrgMilestoneTasks";

const statusLabels: Record<string, string> = {
  active: "Lopend", completed: "Afgerond", paused: "Gepauzeerd", planned: "Gepland",
};
const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  completed: "bg-primary/15 text-primary border-primary/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  planned: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

interface Props {
  workshopId: string;
  onBack: () => void;
}

const OrgWorkshopDetailNew = ({ workshopId, onBack }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workshop, setWorkshop] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [school, setSchool] = useState<any>(null);

  // UI state
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState({ notes: "", participant_count: "" });
  const [savingReport, setSavingReport] = useState(false);

  const load = async () => {
    setLoading(true);
    const [wRes, sessRes, repRes, tmRes, locRes] = await Promise.all([
      supabase.from("org_workshops" as any).select("*").eq("id", workshopId).single(),
      supabase.from("org_sessions" as any).select("*").eq("org_workshop_id", workshopId).order("session_date", { ascending: true }),
      supabase.from("org_workshop_session_reports" as any).select("*").eq("org_workshop_id", workshopId),
      supabase.from("org_team_members" as any).select("*").order("name"),
      supabase.from("org_locations" as any).select("*").order("name"),
    ]);
    const workshopData = wRes.data as any;
    setWorkshop(workshopData);
    setSessions((sessRes.data as any[]) || []);
    setReports((repRes.data as any[]) || []);
    setTeamMembers((tmRes.data as any[]) || []);
    setLocations((locRes.data as any[]) || []);

    if (workshopData?.school_id) {
      const { data: sData } = await supabase.from("org_schools" as any).select("*").eq("id", workshopData.school_id).single();
      setSchool(sData);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [workshopId]);

  const progress = useMemo(() => {
    if (sessions.length === 0) return 0;
    const completed = sessions.filter(s => reports.some(r => r.session_id === s.id)).length;
    return Math.round((completed / sessions.length) * 100);
  }, [sessions, reports]);

  const getTeamMemberName = (id: string) => teamMembers.find(m => m.id === id)?.name || "—";
  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || null;

  // Report
  const saveReport = async (sessionId: string) => {
    if (!user) return;
    setSavingReport(true);
    try {
      const existing = reports.find(r => r.session_id === sessionId);
      if (existing) {
        await (supabase.from("org_workshop_session_reports" as any) as any).update({
          notes: reportForm.notes || null,
          participant_count: parseInt(reportForm.participant_count) || 0,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await (supabase.from("org_workshop_session_reports" as any) as any).insert({
          session_id: sessionId,
          org_workshop_id: workshopId,
          reported_by: user.id,
          notes: reportForm.notes || null,
          participant_count: parseInt(reportForm.participant_count) || 0,
        });
      }
      toast.success("Rapport opgeslagen");
      load();
    } catch { toast.error("Opslaan mislukt"); } finally { setSavingReport(false); }
  };

  // Photo upload
  const handleFileUpload = async (sessionId: string, file: File) => {
    try {
      const path = `workshop-reports/${workshopId}/${sessionId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("org-reports").upload(path, file);
      if (uploadError) throw uploadError;
      const existing = reports.find(r => r.session_id === sessionId);
      if (existing) {
        const urls = [...(existing.file_urls || []), path];
        await (supabase.from("org_workshop_session_reports" as any) as any).update({ file_urls: urls }).eq("id", existing.id);
      } else if (user) {
        await (supabase.from("org_workshop_session_reports" as any) as any).insert({
          session_id: sessionId, org_workshop_id: workshopId, reported_by: user.id, file_urls: [path],
        });
      }
      toast.success("Bestand geüpload");
      load();
    } catch { toast.error("Upload mislukt"); }
  };

  // Update guest teacher on a session
  const updateGuestTeacher = async (sessionId: string, guestTeacher: string) => {
    await (supabase.from("org_sessions" as any) as any).update({ guest_teacher: guestTeacher || null }).eq("id", sessionId);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, guest_teacher: guestTeacher || null } : s));
  };

  // Book all studios for last lesson
  const bookStudiosForLastLesson = async () => {
    if (!user || sessions.length === 0) return;
    const lastSession = sessions[sessions.length - 1];
    const studioIds = ["studio-1", "studio-2", "content"];
    try {
      const startH = parseInt(lastSession.start_time.split(":")[0]);
      const endH = parseInt(lastSession.end_time.split(":")[0]);
      const dur = Math.max(1, endH - startH);
      const bookingInserts = studioIds.map(studioId => ({
        booking_date: lastSession.session_date,
        start_time: lastSession.start_time,
        duration_hours: dur,
        studio_id: studioId,
        user_id: user.id,
        status: "confirmed",
        session_type: "member",
        notes: `Workshop: ${workshop.title} - Eindpresentatie`,
        total_price: 0,
      }));
      await (supabase.from("bookings" as any) as any).insert(bookingInserts);
      toast.success("Alle studio's geboekt voor eindpresentatie");
    } catch { toast.error("Boeken mislukt"); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  if (!workshop) return <div className="text-center py-16 text-muted-foreground">Workshop niet gevonden</div>;

  return (
    <div className="space-y-6 pb-20">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft size={16} /> Terug naar workshops
      </Button>

      {/* Overview Header */}
      <div className="p-5 rounded-xl border border-border bg-card border-l-4 border-l-primary">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{workshop.title}</h1>
            <Badge className={`text-xs border ${statusColors[workshop.status] || "bg-muted"}`}>
              {statusLabels[workshop.status] || workshop.status}
            </Badge>
          </div>
          {workshop.description && <p className="text-sm text-muted-foreground">{workshop.description}</p>}

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground pt-1">
            {workshop.class_name && (
              <span className="flex items-center gap-1.5">
                <GraduationCap size={12} className="text-primary" />
                <span className="text-foreground font-medium">{workshop.class_name}</span>
                {workshop.class_size > 0 && <span>({workshop.class_size} leerlingen)</span>}
              </span>
            )}
            {workshop.team_member_id && (
              <span className="flex items-center gap-1.5">
                <Users size={12} className="text-primary" />
                <span className="text-foreground font-medium">Docent: {getTeamMemberName(workshop.team_member_id)}</span>
              </span>
            )}
            {workshop.start_date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays size={12} />
                {format(new Date(workshop.start_date), "d MMM yyyy", { locale: nl })}
                {workshop.end_date && ` — ${format(new Date(workshop.end_date), "d MMM yyyy", { locale: nl })}`}
              </span>
            )}
            {workshop.location_id && getLocationName(workshop.location_id) && (
              <span className="flex items-center gap-1.5"><MapPin size={12} />{getLocationName(workshop.location_id)}</span>
            )}
            {school && (
              <span className="flex items-center gap-1.5"><School size={12} />{school.name}</span>
            )}
            <span className="flex items-center gap-1.5">
              <BookOpen size={12} />{sessions.length}/{workshop.total_lessons} lessen
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Voortgang</span>
            <span className="text-foreground font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Last lesson at studio button */}
        {workshop.last_lesson_at_studio && sessions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={bookStudiosForLastLesson}>
              📍 Studio's boeken voor eindpresentatie ({sessions.length > 0 ? format(new Date(sessions[sessions.length - 1].session_date), "d MMM", { locale: nl }) : ""})
            </Button>
          </div>
        )}
      </div>

      {/* Milestones */}
      <OrgMilestoneTasks
        workshopId={workshopId}
        milestones={[
          { key: "created", label: "Workshop aangemaakt", done: true },
          { key: "class", label: "Klas ingesteld", done: !!workshop.class_name },
          { key: "sessions", label: "Lessen ingepland", done: sessions.length > 0 },
          ...sessions.map((s, i) => ({
            key: `report-${s.id}`,
            label: `Les ${i + 1} rapport${s.session_date ? ` (${format(new Date(s.session_date), "d MMM", { locale: nl })})` : ""}`,
            done: reports.some(r => r.session_id === s.id),
          })),
          { key: "completed", label: "Workshop afgerond", done: workshop.status === "completed" },
        ]}
        progress={progress}
        onMilestoneClick={(key) => {
          if (key.startsWith("report-")) {
            const sessionId = key.replace("report-", "");
            setExpandedSession(sessionId);
            const existing = reports.find(r => r.session_id === sessionId);
            setReportForm({ notes: existing?.notes || "", participant_count: String(existing?.participant_count || "") });
            setTimeout(() => {
              document.getElementById(`ws-session-${sessionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
          }
        }}
      />

      {/* Sessions / Lessen */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Lessen</h2>
          <Badge variant="outline" className="text-[10px] ml-1">{sessions.length}/{workshop.total_lessons}</Badge>
        </div>

        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nog geen lessen ingepland</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, idx) => {
              const isExpanded = expandedSession === s.id;
              const sessionReport = reports.find(r => r.session_id === s.id);
              const isPast = new Date(s.session_date) < new Date();
              const sessionTeamMember = s.team_member_id ? getTeamMemberName(s.team_member_id) : null;
              const isLastLesson = idx === sessions.length - 1;

              return (
                <div key={s.id} id={`ws-session-${s.id}`} className={`rounded-lg border transition-colors ${isPast ? "border-border/50 bg-secondary/10" : "border-border bg-card"}`}>
                  <button
                    onClick={() => {
                      setExpandedSession(isExpanded ? null : s.id);
                      if (!isExpanded && sessionReport) {
                        setReportForm({ notes: sessionReport.notes || "", participant_count: String(sessionReport.participant_count || "") });
                      } else {
                        setReportForm({ notes: "", participant_count: "" });
                      }
                    }}
                    className="w-full flex items-center justify-between p-3 text-left"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${sessionReport ? "bg-emerald-500" : isPast ? "bg-amber-500" : "bg-muted-foreground/40"}`} />
                      <span className="text-sm font-medium text-foreground">Les {idx + 1}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(s.session_date), "EEEE d MMMM", { locale: nl })} • {s.start_time}–{s.end_time}
                      </span>
                      {sessionTeamMember && <Badge variant="outline" className="text-[10px] py-0"><UserCheck size={9} className="mr-1" />{sessionTeamMember}</Badge>}
                      {s.guest_teacher && <Badge variant="outline" className="text-[10px] py-0 border-amber-500/30 text-amber-400"><UserPlus size={9} className="mr-1" />{s.guest_teacher}</Badge>}
                      {sessionReport && <Badge className="text-[10px] py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Rapport ✓</Badge>}
                      {isLastLesson && workshop.last_lesson_at_studio && <Badge variant="outline" className="text-[10px] py-0">📍 Bij ons</Badge>}
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-4 border-t border-border/50 pt-3">
                      {/* Teacher info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1"><UserCheck size={11} /> Vaste docent</Label>
                          <p className="text-xs font-medium text-foreground mt-0.5">{sessionTeamMember || "Niet ingesteld"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1"><UserPlus size={11} /> Gastdocent</Label>
                          <Input
                            value={s.guest_teacher || ""}
                            onChange={e => {
                              const val = e.target.value;
                              setSessions(prev => prev.map(ss => ss.id === s.id ? { ...ss, guest_teacher: val } : ss));
                            }}
                            onBlur={e => updateGuestTeacher(s.id, e.target.value)}
                            placeholder="Naam gastdocent..."
                            className="h-7 text-xs mt-0.5"
                          />
                        </div>
                      </div>

                      {/* Rapportage */}
                      <div>
                        <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <TrendingUp size={13} className="text-primary" /> Rapportage
                        </h4>

                        {/* File uploads */}
                        <div className="mb-3">
                          <Label className="text-xs text-muted-foreground mb-1 block">Sfeerimpressies / bewijslast</Label>
                          {sessionReport?.file_urls?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {sessionReport.file_urls.map((url: string, i: number) => (
                                <SignedLink key={i} bucket="org-reports" urlOrPath={url} className="block w-16 h-16 rounded-md overflow-hidden border border-border hover:border-primary transition-colors">
                                  <SignedImage bucket="org-reports" urlOrPath={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                                </SignedLink>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline bg-primary/10 px-3 py-1.5 rounded-md">
                              <Camera size={13} /> Foto uploaden
                              <input type="file" accept="image/*" className="hidden" onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(s.id, file);
                                e.target.value = "";
                              }} />
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline bg-primary/10 px-3 py-1.5 rounded-md">
                              <Upload size={13} /> Muziek uploaden
                              <input type="file" accept="audio/*" className="hidden" onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(s.id, file);
                                e.target.value = "";
                              }} />
                            </label>
                          </div>
                        </div>

                        {/* Report form */}
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Rapportage van de dag</Label>
                            <Textarea
                              value={reportForm.notes}
                              onChange={e => setReportForm({ ...reportForm, notes: e.target.value })}
                              placeholder="Wat ging goed? Wat kan beter?..."
                              rows={2}
                              className="text-xs mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Aantal aanwezigen</Label>
                            <Input
                              type="number" min="0"
                              value={reportForm.participant_count}
                              onChange={e => setReportForm({ ...reportForm, participant_count: e.target.value })}
                              className="h-8 text-xs w-28 mt-1"
                            />
                          </div>
                          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => saveReport(s.id)} disabled={savingReport}>
                            {savingReport ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Rapport opslaan
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgWorkshopDetailNew;
