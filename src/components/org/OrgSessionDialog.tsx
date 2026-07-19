import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { inlineToast as toast } from "@/components/InlineToast";

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any | null;
  defaultDate: Date | null;
  locations: any[];
  teamMembers: any[];
  onSaved: () => void;
}

const OrgSessionDialog = ({ open, onOpenChange, session, defaultDate, locations, teamMembers, onSaved }: Props) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [futureCount, setFutureCount] = useState(0);
  const [trajecten, setTrajecten] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "",
    session_type: "project",
    session_date: "",
    start_time: "10:00",
    end_time: "12:00",
    location_id: "",
    team_member_id: "",
    traject_id: "",
    school_id: "",
    description: "",
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("org_trajecten" as any).select("id, title, location_id").eq("status", "active"),
      supabase.from("org_schools" as any).select("id, name, location_id"),
    ]).then(([trajRes, schoolRes]) => {
      setTrajecten((trajRes.data as any[]) || []);
      setSchools((schoolRes.data as any[]) || []);
    });
  }, [open]);

  useEffect(() => {
    if (session) {
      setForm({
        title: session.title || "",
        session_type: session.session_type || "project",
        session_date: session.session_date || "",
        start_time: session.start_time || "10:00",
        end_time: session.end_time || "12:00",
        location_id: session.location_id || "",
        team_member_id: session.team_member_id || "",
        traject_id: session.traject_id || "",
        school_id: session.school_id || "",
        description: session.description || "",
      });
    } else {
      setForm({
        title: "",
        session_type: "project",
        session_date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
        start_time: "10:00",
        end_time: "12:00",
        location_id: "",
        team_member_id: "",
        traject_id: "",
        school_id: "",
        description: "",
      });
    }
  }, [session, defaultDate, open]);

  // When selecting a traject, auto-fill location from that traject
  const handleTrajectChange = (v: string) => {
    const id = v === NONE ? "" : v;
    const traject = trajecten.find(t => t.id === id);
    setForm(prev => ({
      ...prev,
      traject_id: id,
      ...(traject?.location_id && !prev.location_id ? { location_id: traject.location_id } : {}),
    }));
  };

  // When selecting a school, auto-fill location from that school
  const handleSchoolChange = (v: string) => {
    const id = v === NONE ? "" : v;
    const school = schools.find(s => s.id === id);
    setForm(prev => ({
      ...prev,
      school_id: id,
      ...(school?.location_id && !prev.location_id ? { location_id: school.location_id } : {}),
    }));
  };

  const handleSessionTypeChange = (v: string) => {
    setForm(prev => ({
      ...prev,
      session_type: v,
      traject_id: "",
      school_id: "",
    }));
  };

  const save = async () => {
    if (!form.title.trim() || !form.session_date) {
      toast.error("Titel en datum zijn verplicht");
      return;
    }
    if (!user) {
      toast.error("Je bent niet ingelogd");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        session_type: form.session_type,
        session_date: form.session_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location_id: form.location_id || null,
        team_member_id: form.team_member_id || null,
        traject_id: form.traject_id || null,
        description: form.description || null,
      };

      if (session) {
        const { error } = await (supabase.from("org_sessions" as any) as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", session.id);
        if (error) throw new Error(error.message);
        toast.success("Sessie bijgewerkt");
      } else {
        const { error } = await (supabase.from("org_sessions" as any) as any)
          .insert({ ...payload, created_by: user.id });
        if (error) throw new Error(error.message);
        toast.success("Sessie aangemaakt");
      }

      // Auto-block all studios for broedplaats sessions
      if (form.session_type === "broedplaats" && form.session_date && form.start_time && form.end_time) {
        const studios = ["studio1", "studio2", "content"];
        const startH = parseInt(form.start_time.split(":")[0]);
        const endH = parseInt(form.end_time.split(":")[0]);
        const duration = Math.max(endH - startH, 1);
        for (const sid of studios) {
          const { data: existing } = await supabase.from("bookings")
            .select("id").eq("booking_date", form.session_date).eq("studio_id", sid)
            .eq("start_time", form.start_time).eq("session_type", "broedplaats").maybeSingle();
          if (!existing) {
            await (supabase.from("bookings") as any).insert({
              booking_date: form.session_date, studio_id: sid, start_time: form.start_time,
              duration_hours: duration, session_type: "broedplaats", status: "confirmed",
              user_id: user.id, total_price: 0,
              notes: `🔒 Broedplaats — Alle ruimtes geblokkeerd`,
            });
          }
        }
      }

      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message || "onbekende fout"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    // Count future sessions of the same type
    if (session) {
      let query = supabase.from("org_sessions" as any)
        .select("id", { count: "exact", head: true })
        .eq("session_type", session.session_type)
        .gt("session_date", session.session_date);

      if (session.traject_id) {
        query = query.eq("traject_id", session.traject_id);
      } else {
        query = query.eq("title", session.title);
      }

      const { count } = await query;
      setFutureCount(count || 0);
    }
    setDeleteConfirmOpen(true);
  };

  const deleteSession = async (deleteFuture: boolean) => {
    setDeleting(true);
    setDeleteConfirmOpen(false);
    try {
      if (deleteFuture) {
        // Delete this session + all future sessions with same type, traject_id (or title if no traject)
        let query = (supabase.from("org_sessions" as any) as any)
          .delete()
          .eq("session_type", session.session_type)
          .gte("session_date", session.session_date);

        if (session.traject_id) {
          query = query.eq("traject_id", session.traject_id);
        } else {
          query = query.eq("title", session.title);
        }

        const { error } = await query;
        if (error) throw new Error(error.message);
        toast.success("Sessie en alle toekomstige sessies verwijderd");
      } else {
        const { error } = await (supabase.from("org_sessions" as any) as any)
          .delete()
          .eq("id", session.id);
        if (error) throw new Error(error.message);
        toast.success("Sessie verwijderd");
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message || "onbekende fout"}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleLocationChange = (v: string) => setForm({ ...form, location_id: v === NONE ? "" : v });
  const handleTeamChange = (v: string) => setForm({ ...form, team_member_id: v === NONE ? "" : v });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session ? "Sessie Bewerken" : "Nieuwe Sessie"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Titel *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Naam van sessie..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.session_type} onValueChange={handleSessionTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="traject">Traject</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="broedplaats">Broedplaats</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Datum *</Label>
              <Input type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} />
            </div>
          </div>

          {/* Sub-selector: Traject */}
          {form.session_type === "traject" && (
            <div>
              <Label>Welk traject?</Label>
              <Select value={form.traject_id || NONE} onValueChange={handleTrajectChange}>
                <SelectTrigger><SelectValue placeholder="Selecteer traject..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Geen specifiek traject</SelectItem>
                  {trajecten.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sub-selector: Workshop → School */}
          {form.session_type === "workshop" && (
            <div>
              <Label>Welke school / partner?</Label>
              <Select value={form.school_id || NONE} onValueChange={handleSchoolChange}>
                <SelectTrigger><SelectValue placeholder="Selecteer school..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Geen specifieke school</SelectItem>
                  {schools.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Also allow linking to a traject if it's part of one */}
              <div className="mt-3">
                <Label>Gekoppeld aan traject (optioneel)</Label>
                <Select value={form.traject_id || NONE} onValueChange={v => setForm({ ...form, traject_id: v === NONE ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Koppel aan traject..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Geen</SelectItem>
                    {trajecten.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <Label>Eind</Label>
              <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Locatie</Label>
            <Select value={form.location_id || NONE} onValueChange={handleLocationChange}>
              <SelectTrigger className="truncate"><SelectValue placeholder="Selecteer locatie..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Geen</SelectItem>
                {locations.map(l => {
                  const short = l.address && l.address.length > 40 ? l.address.slice(0, 40) + "…" : l.address;
                  return (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="truncate block max-w-[280px]">{l.name}{short ? ` — ${short}` : ""}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Teamlid</Label>
            <Select value={form.team_member_id || NONE} onValueChange={handleTeamChange}>
              <SelectTrigger><SelectValue placeholder="Selecteer teamlid..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Geen</SelectItem>
                {teamMembers.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Legacy traject link for project type */}
          {form.session_type === "project" && (
            <div>
              <Label>Traject (optioneel)</Label>
              <Select value={form.traject_id || NONE} onValueChange={v => setForm({ ...form, traject_id: v === NONE ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Koppel aan traject..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Geen</SelectItem>
                  {trajecten.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Beschrijving</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optionele beschrijving..." rows={3} />
          </div>

          {form.session_type === "broedplaats" && (
            <p className="text-[10px] text-muted-foreground bg-primary/5 rounded-lg p-2">
              ⚠️ Bij het opslaan worden automatisch alle ruimtes (Studio 1, Studio 2 & Content) geblokkeerd.
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
             {session ? (
              <Button variant="destructive" size="sm" onClick={handleDeleteClick} disabled={deleting}>
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span className="ml-1">Verwijderen</span>
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin mr-1" />}
                {session ? "Opslaan" : "Aanmaken"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sessie verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Wil je alleen deze sessie verwijderen, of ook alle toekomstige sessies van hetzelfde type?
              {futureCount > 0 && (
                <span className="block mt-2 font-medium text-destructive">
                  Er {futureCount === 1 ? "is" : "zijn"} nog {futureCount} toekomstige {futureCount === 1 ? "sessie" : "sessies"} die ook verwijderd {futureCount === 1 ? "wordt" : "worden"}.
                </span>
              )}
              {futureCount === 0 && (
                <span className="block mt-2 text-muted-foreground">
                  Er zijn geen toekomstige sessies van dit type.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSession(false)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Alleen deze
            </AlertDialogAction>
            <AlertDialogAction onClick={() => deleteSession(true)} disabled={futureCount === 0} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
              Deze + {futureCount} toekomstige
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OrgSessionDialog;
