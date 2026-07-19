import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage, SignedLink } from "@/components/SignedStorageFile";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ArrowLeft, Users, CalendarDays, Loader2,
  Plus, Trash2, Phone, Home, ShieldCheck,
  FileText, CheckSquare, Square, Camera, Save, X, BookOpen,
  TrendingUp, PackageCheck, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { inlineToast as toast } from "@/components/InlineToast";
import { useConfirm } from "@/components/ConfirmDialog";
import OrgMilestoneTasks from "./OrgMilestoneTasks";

interface Props {
  workshopId: string;
  onBack: () => void;
}

const OrgWorkshopDetail = ({ workshopId, onBack }: Props) => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workshop, setWorkshop] = useState<any>(null);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  // UI state
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ name: "", address: "", phone: "", guardian_phone: "" });
  const [savingParticipant, setSavingParticipant] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [reportForm, setReportForm] = useState({ notes: "", participant_count: "" });
  const [savingReport, setSavingReport] = useState(false);
  const [showFab, setShowFab] = useState(false);

  const load = async () => {
    setLoading(true);
    const [wsRes, clRes, repRes, rsvpRes, profRes, partRes, attRes] = await Promise.all([
      supabase.from("broedplaats_workshops" as any).select("*").eq("id", workshopId).single(),
      supabase.from("org_workshop_checklist" as any).select("*").eq("workshop_id", workshopId).order("created_at"),
      supabase.from("org_workshop_reports" as any).select("*").eq("workshop_id", workshopId).maybeSingle(),
      supabase.from("broedplaats_rsvp" as any).select("*").eq("slot_type", "workshop").eq("confirmed", true),
      supabase.from("profiles" as any).select("id, full_name, email"),
      supabase.from("org_participants" as any).select("*").eq("workshop_id", workshopId).order("name"),
      supabase.from("org_attendance" as any).select("*"),
    ]);
    setWorkshop((wsRes.data as any) || null);
    setChecklists((clRes.data as any[]) || []);
    const rep = repRes.data as any;
    setReport(rep || null);
    if (rep) setReportForm({ notes: rep.notes || "", participant_count: String(rep.participant_count || "") });
    setRsvps((rsvpRes.data as any[]) || []);
    setProfiles((profRes.data as any[]) || []);
    setParticipants((partRes.data as any[]) || []);
    setAttendance((attRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workshopId]);

  // Checklist
  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    const { data } = await (supabase.from("org_workshop_checklist" as any) as any)
      .insert({ workshop_id: workshopId, item: newChecklistItem.trim() }).select("*").single();
    if (data) setChecklists(prev => [...prev, data]);
    setNewChecklistItem("");
  };

  const toggleChecklistItem = async (itemId: string) => {
    const item = checklists.find(c => c.id === itemId);
    if (!item) return;
    await (supabase.from("org_workshop_checklist" as any) as any).update({ checked: !item.checked }).eq("id", itemId);
    setChecklists(prev => prev.map(c => c.id === itemId ? { ...c, checked: !c.checked } : c));
  };

  const removeChecklistItem = async (itemId: string) => {
    await (supabase.from("org_workshop_checklist" as any) as any).delete().eq("id", itemId);
    setChecklists(prev => prev.filter(c => c.id !== itemId));
  };

  // Report
  const saveReport = async () => {
    if (!user) return;
    setSavingReport(true);
    try {
      if (report) {
        await (supabase.from("org_workshop_reports" as any) as any).update({
          notes: reportForm.notes || null,
          participant_count: parseInt(reportForm.participant_count) || 0,
          updated_at: new Date().toISOString(),
        }).eq("id", report.id);
      } else {
        await (supabase.from("org_workshop_reports" as any) as any).insert({
          workshop_id: workshopId,
          reported_by: user.id,
          notes: reportForm.notes || null,
          participant_count: parseInt(reportForm.participant_count) || 0,
        });
      }
      toast.success("Rapport opgeslagen");
      load();
    } catch { toast.error("Opslaan mislukt"); } finally { setSavingReport(false); }
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      const path = `workshops/${workshopId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("org-reports").upload(path, file);
      if (uploadError) throw uploadError;
      if (report) {
        const urls = [...(report.file_urls || []), path];
        await (supabase.from("org_workshop_reports" as any) as any).update({ file_urls: urls }).eq("id", report.id);
      } else if (user) {
        await (supabase.from("org_workshop_reports" as any) as any).insert({
          workshop_id: workshopId, reported_by: user.id, file_urls: [path],
        });
      }
      toast.success("Foto geüpload");
      load();
    } catch { toast.error("Upload mislukt"); }
  };

  // Participants
  const addParticipant = async () => {
    if (!newParticipant.name.trim()) { toast.error("Naam is verplicht"); return; }
    setSavingParticipant(true);
    try {
      const { error } = await (supabase.from("org_participants" as any) as any).insert({
        workshop_id: workshopId,
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

  // Attendance (for workshop-level, we use a single "session" = the workshop itself)
  const toggleAttendance = async (participantId: string) => {
    // Use workshopId as a pseudo session_id for attendance tracking
    const existing = attendance.find(a => a.participant_id === participantId && a.session_id === workshopId);
    try {
      if (existing) {
        await (supabase.from("org_attendance" as any) as any).update({ present: !existing.present }).eq("id", existing.id);
        setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, present: !a.present } : a));
      } else {
        const { data } = await (supabase.from("org_attendance" as any) as any)
          .insert({ participant_id: participantId, session_id: workshopId, present: true })
          .select("*").single();
        if (data) setAttendance(prev => [...prev, data]);
      }
    } catch { toast.error("Aanwezigheid bijwerken mislukt"); }
  };

  const isPresent = (participantId: string) => {
    return attendance.find(a => a.participant_id === participantId && a.session_id === workshopId)?.present || false;
  };

  const rsvpProfiles = profiles.filter(p => rsvps.some(r => r.user_id === p.id));
  const checkedCount = checklists.filter(c => c.checked).length;

  const workshopProgress = useMemo(() => {
    if (!workshop) return 0;
    const isPastW = new Date(workshop.workshop_date) < new Date(new Date().toDateString());
    const total = 5;
    let done = 1; // created
    if (participants.length > 0 || rsvpProfiles.length > 0) done++;
    if (checkedCount === checklists.length && checklists.length > 0) done++;
    if (report) done++;
    if (isPastW && report) done++;
    return Math.round((done / total) * 100);
  }, [workshop, participants, rsvpProfiles, checklists, checkedCount, report]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  if (!workshop) return <div className="text-center py-16 text-muted-foreground">Workshop niet gevonden</div>;

  const isPast = new Date(workshop.workshop_date) < new Date(new Date().toDateString());

  return (
    <div className="space-y-6 relative pb-20">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft size={16} /> Terug naar Broedplaats
      </Button>

      {/* ── Overview Header ── */}
      <div className="p-5 rounded-xl border border-border bg-card border-l-4 border-l-primary">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <BookOpen size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-foreground">{workshop.title || "Workshop"}</h1>
            {isPast
              ? <Badge variant="outline" className="text-xs opacity-60">Verlopen</Badge>
              : <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Gepland</Badge>
            }
            {report && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Rapport ✓</Badge>}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={12} />
              {format(new Date(workshop.workshop_date), "EEEE d MMMM yyyy", { locale: nl })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              {workshop.start_time} – {workshop.end_time}
            </span>
            {(participants.length > 0 || rsvpProfiles.length > 0) && (
              <span className="flex items-center gap-1.5">
                <Users size={12} />{participants.length + rsvpProfiles.length} deelnemers
              </span>
            )}
          </div>

          {workshop.learning_module && (
            <p className="text-sm text-primary font-semibold">📚 {workshop.learning_module}</p>
          )}
          {workshop.description && <p className="text-sm text-muted-foreground">{workshop.description}</p>}
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Voortgang</span>
            <span className="text-foreground font-medium">{workshopProgress}%</span>
          </div>
          <Progress value={workshopProgress} className="h-2" />
        </div>
      </div>

      {/* ── Milestones & Taken ── */}
      <OrgMilestoneTasks
        workshopId={workshopId}
        milestones={[
          { key: "created", label: "Workshop aangemaakt", done: true },
          { key: "participants", label: "Deelnemers toegevoegd", done: participants.length > 0 || rsvpProfiles.length > 0 },
          { key: "checklist", label: "Checklist afgewerkt", done: checkedCount === checklists.length && checklists.length > 0 },
          { key: "report", label: "Rapport ingediend", done: !!report },
          { key: "completed", label: "Workshop afgerond", done: isPast && !!report },
        ]}
        progress={workshopProgress}
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

        {participants.length === 0 && rsvpProfiles.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nog geen deelnemers toegevoegd</p>
        ) : (
          <div className="space-y-1.5">
            {/* Manual participants with attendance */}
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAttendance(p.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      isPresent(p.id) ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isPresent(p.id) ? <CheckSquare size={12} /> : <Square size={12} />}
                  </button>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="font-medium text-foreground">{p.name}</span>
                    {p.address && <span className="flex items-center gap-1 text-muted-foreground"><Home size={10} />{p.address}</span>}
                    {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-primary hover:underline"><Phone size={10} />{p.phone}</a>}
                    {p.guardian_phone && <a href={`tel:${p.guardian_phone}`} className="flex items-center gap-1 text-amber-400 hover:underline" title="Voogd"><ShieldCheck size={10} />{p.guardian_phone}</a>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeParticipant(p.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}

            {/* RSVP-based profiles (from broedplaats system) */}
            {rsvpProfiles.length > 0 && (
              <>
                {participants.length > 0 && (
                  <div className="text-[10px] text-muted-foreground pt-2 pb-1 font-medium uppercase tracking-wider">
                    Online aangemeld
                  </div>
                )}
                {rsvpProfiles.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/20 text-xs">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                      {(p.full_name || "?")[0]}
                    </div>
                    <span className="font-medium text-foreground">{p.full_name || p.email}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Draaiboek & Checklist ── */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <PackageCheck size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Materiaal Checklist</h2>
          {checklists.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{checkedCount}/{checklists.length}</Badge>
          )}
        </div>

        {workshop.draaiboek_url && (
          <a href={workshop.draaiboek_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-md mb-3">
            <FileText size={13} /> Draaiboek openen (PDF)
          </a>
        )}

        <div className="space-y-1">
          {checklists.map(item => (
            <div key={item.id} className="flex items-center gap-2 text-xs group">
              <button onClick={() => toggleChecklistItem(item.id)} className="flex items-center gap-2 flex-1 text-left">
                {item.checked ? <CheckSquare size={14} className="text-emerald-400 shrink-0" /> : <Square size={14} className="text-muted-foreground shrink-0" />}
                <span className={item.checked ? "line-through text-muted-foreground" : "text-foreground"}>{item.item}</span>
              </button>
              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeChecklistItem(item.id)}>
                <Trash2 size={10} />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            value={newChecklistItem}
            onChange={e => setNewChecklistItem(e.target.value)}
            placeholder="Nieuw item (bijv. beamer, catering)..."
            className="h-7 text-xs flex-1"
            onKeyDown={e => e.key === "Enter" && addChecklistItem()}
          />
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={addChecklistItem}>
            <Plus size={10} />
          </Button>
        </div>
      </div>

      {/* ── Impact & Rapportage ── */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Impact & Rapportage</h2>
        </div>

        {/* Photos */}
        <div className="mb-4">
          <Label className="text-xs text-muted-foreground mb-1 block">Sfeerimpressies / bewijslast</Label>
          {report?.file_urls?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {report.file_urls.map((url: string, i: number) => (
                <SignedLink key={i} bucket="org-reports" urlOrPath={url} className="block w-16 h-16 rounded-md overflow-hidden border border-border hover:border-primary transition-colors">
                  <SignedImage bucket="org-reports" urlOrPath={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                </SignedLink>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline bg-primary/10 px-3 py-1.5 rounded-md">
            <Camera size={13} /> Foto uploaden
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file);
              e.target.value = "";
            }} />
          </label>
        </div>

        {/* Learning moments */}
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Leermomenten van de dag</Label>
            <Textarea
              value={reportForm.notes}
              onChange={e => setReportForm({ ...reportForm, notes: e.target.value })}
              placeholder="Wat ging goed? Wat kan beter?..."
              rows={3}
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
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={saveReport} disabled={savingReport}>
            {savingReport ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Rapport opslaan
          </Button>
        </div>
      </div>

      {/* ── Floating Action Button ── */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        {showFab && (
          <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-200">
            <Button size="sm" className="shadow-lg gap-1.5 rounded-full px-4" onClick={() => { setAddingParticipant(true); setShowFab(false); window.scrollTo({ top: 300, behavior: "smooth" }); }}>
              <Users size={14} /> Deelnemer toevoegen
            </Button>
            <Button size="sm" className="shadow-lg gap-1.5 rounded-full px-4" variant="secondary" onClick={() => { setShowFab(false); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>
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

export default OrgWorkshopDetail;
