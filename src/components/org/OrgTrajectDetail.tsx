import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage, SignedLink } from "@/components/SignedStorageFile";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ArrowLeft, Users, CalendarDays, MapPin, Route, Loader2,
  ChevronDown, ChevronUp, Plus, Trash2, Phone, Home, ShieldCheck,
  FileText, CheckSquare, Square, Camera, Save, X, Building2,
  BarChart3, TrendingUp, Upload, BookOpen, PackageCheck, CircleDot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { inlineToast as toast } from "@/components/InlineToast";
import { useConfirm } from "@/components/ConfirmDialog";
import OrgMilestoneTasks from "./OrgMilestoneTasks";

const statusLabels: Record<string, string> = {
  active: "Lopend", completed: "Afgerond", paused: "Gepauzeerd", planned: "Werving",
};
const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  completed: "bg-primary/15 text-primary border-primary/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  planned: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

const typeColors: Record<string, string> = {
  jongeren: "border-l-sky-500",
  duurzaamheid: "border-l-emerald-500",
  cultuur: "border-l-violet-500",
  educatie: "border-l-amber-500",
  general: "border-l-primary",
};
const typeLabels: Record<string, string> = {
  jongeren: "Jongeren", duurzaamheid: "Duurzaamheid", cultuur: "Cultuur", educatie: "Educatie", general: "Algemeen",
};

interface Props {
  trajectId: string;
  onBack: () => void;
}

const OrgTrajectDetail = ({ trajectId, onBack }: Props) => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [traject, setTraject] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  // UI state
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ name: "", address: "", phone: "", guardian_phone: "" });
  const [savingParticipant, setSavingParticipant] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [reportForm, setReportForm] = useState({ notes: "", participant_count: "" });
  const [savingReport, setSavingReport] = useState(false);
  const [showFab, setShowFab] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tRes, sessRes, partRes, attRes, checkRes, repRes, tmRes, locRes] = await Promise.all([
      supabase.from("org_trajecten" as any).select("*").eq("id", trajectId).single(),
      supabase.from("org_sessions" as any).select("*").eq("traject_id", trajectId).order("session_date", { ascending: true }),
      supabase.from("org_participants" as any).select("*").eq("traject_id", trajectId).order("name"),
      supabase.from("org_attendance" as any).select("*"),
      supabase.from("org_session_checklist" as any).select("*"),
      supabase.from("org_session_reports" as any).select("*"),
      supabase.from("org_team_members" as any).select("*").order("name"),
      supabase.from("org_locations" as any).select("*").order("name"),
    ]);
    setTraject((tRes.data as any) || null);
    const sessData = (sessRes.data as any[]) || [];
    setSessions(sessData);
    setParticipants((partRes.data as any[]) || []);

    // Filter attendance/checklist/reports to relevant session IDs
    const sessIds = sessData.map((s: any) => s.id);
    setAttendance(((attRes.data as any[]) || []).filter((a: any) => sessIds.includes(a.session_id)));
    setChecklists(((checkRes.data as any[]) || []).filter((c: any) => sessIds.includes(c.session_id)));
    setReports(((repRes.data as any[]) || []).filter((r: any) => sessIds.includes(r.session_id)));
    setTeamMembers((tmRes.data as any[]) || []);
    setLocations((locRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [trajectId]);

  // Progress calculation based on completed sessions
  const progress = useMemo(() => {
    if (sessions.length === 0) return 0;
    const completed = sessions.filter(s => s.status === "completed" || reports.some(r => r.session_id === s.id)).length;
    return Math.round((completed / sessions.length) * 100);
  }, [sessions, reports]);

  const getTeamMemberName = (id: string) => teamMembers.find(m => m.id === id)?.name || "—";
  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || null;

  const budgetPercent = useMemo(() => {
    if (!traject?.total_budget || traject.total_budget <= 0) return 0;
    return Math.min(100, Math.round(((traject.spent_budget || 0) / traject.total_budget) * 100));
  }, [traject]);

  // Attendance toggle
  const toggleAttendance = async (participantId: string, sessionId: string) => {
    const existing = attendance.find(a => a.participant_id === participantId && a.session_id === sessionId);
    try {
      if (existing) {
        await (supabase.from("org_attendance" as any) as any).update({ present: !existing.present }).eq("id", existing.id);
        setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, present: !a.present } : a));
      } else {
        const { data } = await (supabase.from("org_attendance" as any) as any)
          .insert({ participant_id: participantId, session_id: sessionId, present: true })
          .select("*").single();
        if (data) setAttendance(prev => [...prev, data]);
      }
    } catch { toast.error("Aanwezigheid bijwerken mislukt"); }
  };

  const isPresent = (participantId: string, sessionId: string) => {
    return attendance.find(a => a.participant_id === participantId && a.session_id === sessionId)?.present || false;
  };

  // Add participant
  const addParticipant = async () => {
    if (!newParticipant.name.trim()) { toast.error("Naam is verplicht"); return; }
    setSavingParticipant(true);
    try {
      const { error } = await (supabase.from("org_participants" as any) as any).insert({
        traject_id: trajectId,
        name: newParticipant.name.trim(),
        address: newParticipant.address.trim() || null,
        phone: newParticipant.phone.trim() || null,
        guardian_phone: newParticipant.guardian_phone.trim() || null,
      });
      if (error) throw new Error(error.message);
      setNewParticipant({ name: "", address: "", phone: "", guardian_phone: "" });
      setAddingParticipant(false);
      toast.success("Deelnemer toegevoegd");
      load();
    } catch (err: any) { toast.error(err.message); } finally { setSavingParticipant(false); }
  };

  const removeParticipant = async (id: string) => {
    if (!(await confirm({ title: "Deelnemer verwijderen?", destructive: true }))) return;
    await (supabase.from("org_participants" as any) as any).delete().eq("id", id);
    toast.success("Verwijderd");
    load();
  };

  // Checklist
  const addChecklistItem = async (sessionId: string) => {
    if (!newChecklistItem.trim()) return;
    const { data } = await (supabase.from("org_session_checklist" as any) as any)
      .insert({ session_id: sessionId, item: newChecklistItem.trim() }).select("*").single();
    if (data) setChecklists(prev => [...prev, data]);
    setNewChecklistItem("");
  };

  const toggleChecklistItem = async (itemId: string) => {
    const item = checklists.find(c => c.id === itemId);
    if (!item) return;
    await (supabase.from("org_session_checklist" as any) as any).update({ checked: !item.checked }).eq("id", itemId);
    setChecklists(prev => prev.map(c => c.id === itemId ? { ...c, checked: !c.checked } : c));
  };

  const removeChecklistItem = async (itemId: string) => {
    await (supabase.from("org_session_checklist" as any) as any).delete().eq("id", itemId);
    setChecklists(prev => prev.filter(c => c.id !== itemId));
  };

  // Report / impact
  const saveReport = async (sessionId: string) => {
    if (!user) return;
    setSavingReport(true);
    try {
      const existing = reports.find(r => r.session_id === sessionId);
      if (existing) {
        await (supabase.from("org_session_reports" as any) as any).update({
          notes: reportForm.notes || null,
          participant_count: parseInt(reportForm.participant_count) || 0,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await (supabase.from("org_session_reports" as any) as any).insert({
          session_id: sessionId,
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
  const handlePhotoUpload = async (sessionId: string, file: File) => {
    try {
      const path = `reports/${trajectId}/${sessionId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("org-reports").upload(path, file);
      if (uploadError) throw uploadError;
      const existing = reports.find(r => r.session_id === sessionId);
      if (existing) {
        const urls = [...(existing.file_urls || []), path];
        const { error } = await (supabase.from("org_session_reports" as any) as any).update({ file_urls: urls }).eq("id", existing.id);
        if (error) throw error;
      } else if (user) {
        const { error } = await (supabase.from("org_session_reports" as any) as any).insert({
          session_id: sessionId, reported_by: user.id, file_urls: [path],
        });
        if (error) throw error;
      }
      toast.success("Foto geüpload");
      load();
    } catch { toast.error("Upload mislukt"); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  if (!traject) return <div className="text-center py-16 text-muted-foreground">Traject niet gevonden</div>;

  const trajectType = traject.traject_type || "general";
  const borderColor = typeColors[trajectType] || typeColors.general;

  return (
    <div className="space-y-6 relative pb-20">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft size={16} /> Terug naar trajecten
      </Button>

      {/* ── Overview Header ── */}
      <div className={`p-5 rounded-xl border border-border bg-card border-l-4 ${borderColor}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{traject.title}</h1>
              <Badge className={`text-xs border ${statusColors[traject.status] || "bg-muted"}`}>
                {statusLabels[traject.status] || traject.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {typeLabels[trajectType] || trajectType}
              </Badge>
            </div>
            {traject.description && <p className="text-sm text-muted-foreground">{traject.description}</p>}

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground pt-1">
              {traject.team_member_id && (
                <span className="flex items-center gap-1.5">
                  <Users size={12} className="text-primary" />
                  <span className="text-foreground font-medium">Lead: {getTeamMemberName(traject.team_member_id)}</span>
                </span>
              )}
              {traject.start_date && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={12} />
                  {format(new Date(traject.start_date), "d MMM yyyy", { locale: nl })}
                  {traject.end_date && ` — ${format(new Date(traject.end_date), "d MMM yyyy", { locale: nl })}`}
                </span>
              )}
              {traject.location_id && getLocationName(traject.location_id) && (
                <span className="flex items-center gap-1.5"><MapPin size={12} />{getLocationName(traject.location_id)}</span>
              )}
              <span className="flex items-center gap-1.5">
                <Route size={12} />{sessions.length} sessies
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={12} />{participants.length} deelnemers
              </span>
            </div>
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

        {/* Budget indicator */}
        {traject.total_budget > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BarChart3 size={12} /> Budget
              </span>
              <span className="text-foreground font-medium">
                €{(traject.spent_budget || 0).toLocaleString("nl-NL")} / €{traject.total_budget.toLocaleString("nl-NL")}
              </span>
            </div>
            <Progress value={budgetPercent} className={`h-2 ${budgetPercent > 90 ? "[&>div]:bg-destructive" : "[&>div]:bg-emerald-500"}`} />
          </div>
        )}
      </div>

      {/* ── Milestones & Taken ── */}
      <OrgMilestoneTasks
        trajectId={trajectId}
        milestones={[
          { key: "created", label: "Traject aangemaakt", done: true },
          { key: "participants", label: "Deelnemers toegevoegd", done: participants.length > 0 },
          { key: "sessions", label: "Sessies ingepland", done: sessions.length > 0 },
          ...sessions.map((s, i) => ({
            key: `report-${s.id}`,
            label: `Week ${i + 1} rapport${s.session_date ? ` (${format(new Date(s.session_date), "d MMM", { locale: nl })})` : ""}`,
            done: reports.some(r => r.session_id === s.id),
          })),
          { key: "completed", label: "Traject afgerond", done: traject.status === "completed" },
        ]}
        progress={progress}
        onMilestoneClick={(key) => {
          if (key.startsWith("report-")) {
            const sessionId = key.replace("report-", "");
            setExpandedSession(sessionId);
            const existing = reports.find(r => r.session_id === sessionId);
            setReportForm({ notes: existing?.notes || "", participant_count: String(existing?.participant_count || "") });
            setTimeout(() => {
              document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
          }
        }}
      />

      {/* ── Deelnemers ── */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Deelnemers</h2>
            <Badge variant="outline" className="text-[10px] ml-1">{participants.length}</Badge>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setAddingParticipant(!addingParticipant)}>
            {addingParticipant ? <X size={12} /> : <Plus size={12} />}
            {addingParticipant ? "Annuleren" : "Toevoegen"}
          </Button>
        </div>

        {addingParticipant && (
          <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} placeholder="Naam *" className="h-8 text-xs" />
              <Input value={newParticipant.address} onChange={e => setNewParticipant({ ...newParticipant, address: e.target.value })} placeholder="Adres" className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input value={newParticipant.phone} onChange={e => setNewParticipant({ ...newParticipant, phone: e.target.value })} placeholder="Telefoonnummer" className="h-8 text-xs" />
              <Input value={newParticipant.guardian_phone} onChange={e => setNewParticipant({ ...newParticipant, guardian_phone: e.target.value })} placeholder="Voogd nummer" className="h-8 text-xs" />
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={addParticipant} disabled={savingParticipant}>
              {savingParticipant ? <Loader2 size={12} className="animate-spin mr-1" /> : <Plus size={12} className="mr-1" />}
              Deelnemer opslaan
            </Button>
          </div>
        )}

        {participants.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nog geen deelnemers toegevoegd</p>
        ) : (
          <div className="space-y-1.5">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="font-medium text-foreground">{p.name}</span>
                  {p.address && <span className="flex items-center gap-1 text-muted-foreground"><Home size={10} />{p.address}</span>}
                  {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-primary hover:underline"><Phone size={10} />{p.phone}</a>}
                  {p.guardian_phone && <a href={`tel:${p.guardian_phone}`} className="flex items-center gap-1 text-amber-400 hover:underline" title="Voogd"><ShieldCheck size={10} />{p.guardian_phone}</a>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeParticipant(p.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Attendance per session */}
        {sessions.length > 0 && participants.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <CheckSquare size={13} className="text-primary" /> Aanwezigheid per sessie
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium sticky left-0 bg-card">Deelnemer</th>
                    {sessions.slice(0, 20).map(s => (
                      <th key={s.id} className="px-1.5 py-1.5 text-center text-muted-foreground font-medium min-w-[40px]">
                        {format(new Date(s.session_date), "d/M")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-1.5 pr-3 font-medium text-foreground sticky left-0 bg-card whitespace-nowrap">{p.name}</td>
                      {sessions.slice(0, 20).map(s => (
                        <td key={s.id} className="px-1.5 py-1.5 text-center">
                          <button
                            onClick={() => toggleAttendance(p.id, s.id)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                              isPresent(p.id, s.id) ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {isPresent(p.id, s.id) ? <CheckSquare size={12} /> : <Square size={12} />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Workshop Draaiboek & Checklist ── */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Sessies & Draaiboek</h2>
          <Badge variant="outline" className="text-[10px] ml-1">{sessions.length}</Badge>
        </div>

        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nog geen sessies ingepland</p>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => {
              const isExpanded = expandedSession === s.id;
              const sessionChecklists = checklists.filter(c => c.session_id === s.id);
              const sessionReport = reports.find(r => r.session_id === s.id);
              const isPast = new Date(s.session_date) < new Date();
              const sessionTeamMember = s.team_member_id ? getTeamMemberName(s.team_member_id) : null;

              return (
                <div key={s.id} id={`session-${s.id}`} className={`rounded-lg border transition-colors ${isPast ? "border-border/50 bg-secondary/10" : "border-border bg-card"}`}>
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
                      <span className="text-sm font-medium text-foreground">{s.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(s.session_date), "EEEE d MMMM", { locale: nl })} • {s.start_time}–{s.end_time}
                      </span>
                      {sessionTeamMember && <Badge variant="outline" className="text-[10px] py-0">{sessionTeamMember}</Badge>}
                      {sessionReport && <Badge className="text-[10px] py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Rapport</Badge>}
                      {s.draaiboek_url && <Badge variant="outline" className="text-[10px] py-0 gap-1"><FileText size={8} />PDF</Badge>}
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-4 border-t border-border/50 pt-3">
                      {/* Draaiboek link */}
                      {s.draaiboek_url && (
                        <a href={s.draaiboek_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-md">
                          <FileText size={13} /> Draaiboek openen (PDF)
                        </a>
                      )}

                      {/* Impact & Rapportage */}
                      <div>
                        <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <TrendingUp size={13} className="text-primary" /> Impact & Rapportage
                        </h4>

                        {/* Photo upload */}
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
                                if (file) handlePhotoUpload(s.id, file);
                                e.target.value = "";
                              }} />
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline bg-primary/10 px-3 py-1.5 rounded-md">
                              <Upload size={13} /> Muziek uploaden
                              <input type="file" accept="audio/*" className="hidden" onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(s.id, file);
                                e.target.value = "";
                              }} />
                            </label>
                          </div>
                        </div>

                        {/* Rapportage */}
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

      {/* ── Floating Action Button ── */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        {showFab && (
          <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-200">
            <Button size="sm" className="shadow-lg gap-1.5 rounded-full px-4" onClick={() => { setAddingParticipant(true); setShowFab(false); window.scrollTo({ top: 300, behavior: "smooth" }); }}>
              <Users size={14} /> Deelnemer toevoegen
            </Button>
            <Button size="sm" className="shadow-lg gap-1.5 rounded-full px-4" variant="secondary" onClick={() => { setExpandedSession(sessions[0]?.id || null); setShowFab(false); }}>
              <TrendingUp size={14} /> Update loggen
            </Button>
          </div>
        )}
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-xl bg-primary hover:bg-primary/90"
          onClick={() => setShowFab(!showFab)}
        >
          {showFab ? <X size={20} /> : <Plus size={20} />}
        </Button>
      </div>
    </div>
  );
};

export default OrgTrajectDetail;
