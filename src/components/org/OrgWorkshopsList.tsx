import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addWeeks, addDays, getDay } from "date-fns";
import { nl } from "date-fns/locale";
import {
  BookOpen, Plus, Loader2, Edit3, Trash2, Save, X, CalendarDays, Users,
  Search, MapPin, School, GraduationCap, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { inlineToast as toast } from "@/components/InlineToast";
import { useConfirm } from "@/components/ConfirmDialog";
import OrgWorkshopDetailNew from "./OrgWorkshopDetailNew";

const ALL = "__all__";
const NONE = "__none__";

const statusLabels: Record<string, string> = {
  active: "Lopend", completed: "Afgerond", paused: "Gepauzeerd", planned: "Gepland",
};
const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400",
  completed: "bg-primary/20 text-primary",
  paused: "bg-amber-500/20 text-amber-400",
  planned: "bg-sky-500/20 text-sky-400",
};

const OrgWorkshopsList = () => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(ALL);

  // CRUD
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", status: "active",
    start_date: "", total_lessons: "6",
    class_name: "", class_size: "0",
    team_member_id: "", location_id: "", school_id: "",
    last_lesson_at_studio: false, notes: "",
  });

  // Recurring schedule
  const [enableRecurring, setEnableRecurring] = useState(true);
  const [recurring, setRecurring] = useState({
    day: "1", start_time: "10:00", end_time: "12:00", frequency: "weekly",
  });

  const load = async () => {
    setLoading(true);
    const [wRes, sessRes, repRes, locRes, tmRes, sRes] = await Promise.all([
      supabase.from("org_workshops" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("org_sessions" as any).select("id, title, session_date, org_workshop_id, guest_teacher, team_member_id").not("org_workshop_id", "is", null),
      supabase.from("org_workshop_session_reports" as any).select("id, session_id, org_workshop_id"),
      supabase.from("org_locations" as any).select("*").order("name"),
      supabase.from("org_team_members" as any).select("*").order("name"),
      supabase.from("org_schools" as any).select("id, name").order("name"),
    ]);
    setWorkshops((wRes.data as any[]) || []);
    setSessions((sessRes.data as any[]) || []);
    setReports((repRes.data as any[]) || []);
    setLocations((locRes.data as any[]) || []);
    setTeamMembers((tmRes.data as any[]) || []);
    setSchools((sRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ title: "", description: "", status: "active", start_date: "", total_lessons: "6", class_name: "", class_size: "0", team_member_id: "", location_id: "", school_id: "", last_lesson_at_studio: false, notes: "" });
    setEnableRecurring(true);
    setRecurring({ day: "1", start_time: "10:00", end_time: "12:00", frequency: "weekly" });
    setAdding(false);
    setEditingId(null);
  };

  const getRecurringDates = () => {
    if (!form.start_date) return [];
    const targetDay = parseInt(recurring.day);
    let firstDate = new Date(form.start_date);
    while (getDay(firstDate) !== targetDay) firstDate = addDays(firstDate, 1);
    const weeks = parseInt(form.total_lessons) || 6;
    const step = recurring.frequency === "biweekly" ? 2 : 1;
    const dates: Date[] = [];
    for (let i = 0; i < weeks; i++) dates.push(addWeeks(firstDate, i * step));
    return dates;
  };

  const startEdit = (w: any) => {
    setEditingId(w.id);
    setAdding(false);
    setForm({
      title: w.title || "", description: w.description || "", status: w.status || "active",
      start_date: w.start_date || "", total_lessons: String(w.total_lessons || 6),
      class_name: w.class_name || "", class_size: String(w.class_size || 0),
      team_member_id: w.team_member_id || "", location_id: w.location_id || "",
      school_id: w.school_id || "", last_lesson_at_studio: w.last_lesson_at_studio || false,
      notes: w.notes || "",
    });
  };

  const saveWorkshop = async () => {
    if (!form.title.trim() || !user) { toast.error("Titel is verplicht"); return; }
    setSaving(true);
    try {
      const endDate = enableRecurring && form.start_date ? getRecurringDates().pop() : null;
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        total_lessons: parseInt(form.total_lessons) || 6,
        class_name: form.class_name.trim() || null,
        class_size: parseInt(form.class_size) || 0,
        team_member_id: form.team_member_id || null,
        location_id: form.location_id || null,
        school_id: form.school_id || null,
        last_lesson_at_studio: form.last_lesson_at_studio,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await (supabase.from("org_workshops" as any) as any).update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
        toast.success("Workshop bijgewerkt");
      } else {
        const { data: newWorkshop, error } = await (supabase.from("org_workshops" as any) as any)
          .insert({ ...payload, created_by: user.id }).select("*").single();
        if (error) throw new Error(error.message);

        // Generate recurring sessions
        if (enableRecurring && form.start_date && newWorkshop) {
          const dates = getRecurringDates();
          const totalLessons = dates.length;
          const sessionInserts = dates.map((d, i) => {
            const isLast = i === totalLessons - 1;
            return {
              title: `${form.title.trim()} - Les ${i + 1}`,
              session_date: format(d, "yyyy-MM-dd"),
              start_time: recurring.start_time,
              end_time: recurring.end_time,
              session_type: "workshop",
              org_workshop_id: newWorkshop.id,
              location_id: (isLast && form.last_lesson_at_studio) ? null : (form.location_id || null),
              team_member_id: form.team_member_id || null,
              created_by: user.id,
              status: "planned",
            };
          });
          const { error: sessErr } = await (supabase.from("org_sessions" as any) as any).insert(sessionInserts);
          if (sessErr) throw new Error(`Workshop aangemaakt, maar lessen plannen mislukt: ${sessErr.message}`);

          // If last lesson at studio, book all 3 studios
          if (form.last_lesson_at_studio && dates.length > 0) {
            const lastDate = dates[dates.length - 1];
            const studioIds = ["studio-1", "studio-2", "content"];
            const bookingInserts = studioIds.map(studioId => ({
              booking_date: format(lastDate, "yyyy-MM-dd"),
              start_time: recurring.start_time,
              duration_hours: Math.max(1, Math.ceil((parseInt(recurring.end_time.split(":")[0]) - parseInt(recurring.start_time.split(":")[0])))),
              studio_id: studioId,
              user_id: user.id,
              status: "confirmed",
              session_type: "member",
              notes: `Workshop: ${form.title.trim()} - Eindpresentatie`,
              total_price: 0,
            }));
            const { error: bookErr } = await (supabase.from("bookings" as any) as any).insert(bookingInserts);
            if (bookErr) throw new Error(`Workshop en lessen aangemaakt, maar studio's boeken mislukt (mogelijk al bezet): ${bookErr.message}`);
          }
        }
        toast.success("Workshop aangemaakt");
      }
      resetForm();
      load();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const removeWorkshop = async (id: string) => {
    if (!(await confirm({ title: "Workshop verwijderen?", message: "Alle sessies worden ook verwijderd.", destructive: true }))) return;
    // Delete sessions first
    await (supabase.from("org_sessions" as any) as any).delete().eq("org_workshop_id", id);
    const { error } = await (supabase.from("org_workshops" as any) as any).delete().eq("id", id);
    if (error) { toast.error("Verwijderen mislukt"); return; }
    toast.success("Workshop verwijderd");
    load();
  };

  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || null;
  const getTeamMemberName = (id: string) => teamMembers.find(m => m.id === id)?.name || null;
  const getSchoolName = (id: string) => schools.find(s => s.id === id)?.name || null;
  const getSessionCount = (wId: string) => sessions.filter(s => s.org_workshop_id === wId).length;

  const getProgress = (w: any) => {
    const wSessions = sessions.filter(s => s.org_workshop_id === w.id);
    const milestones = [
      true,
      !!w.class_name,
      wSessions.length > 0,
      ...wSessions.map(s => reports.some(r => r.session_id === s.id)),
      w.status === "completed",
    ];
    const done = milestones.filter(Boolean).length;
    return { done, total: milestones.length, percent: milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0 };
  };

  const filtered = workshops.filter(w => {
    if (filterStatus !== ALL && w.status !== filterStatus) return false;
    if (search && !w.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const DAY_LABELS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

  if (selectedId) {
    return <OrgWorkshopDetailNew workshopId={selectedId} onBack={() => { setSelectedId(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BookOpen size={20} className="text-primary" /> Workshops
          <Badge variant="outline" className="text-xs">{workshops.length}</Badge>
        </h1>
        <Button size="sm" onClick={() => { setAdding(true); setEditingId(null); resetForm(); setAdding(true); }} className="gap-1.5">
          <Plus size={14} /> Workshop toevoegen
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek workshop..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle statussen</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Add/Edit form */}
      {(adding || editingId) && (
        <div className="p-4 rounded-xl border border-primary/30 bg-card space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{editingId ? "Workshop bewerken" : "Nieuwe workshop"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Titel *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Klasnaam</Label>
              <Input value={form.class_name} onChange={e => setForm({ ...form, class_name: e.target.value })} placeholder="Bijv. Klas 3B" className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Klasgrootte</Label>
              <Input type="number" min="0" value={form.class_size} onChange={e => setForm({ ...form, class_size: e.target.value })} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Aantal lessen</Label>
              <Input type="number" min="1" max="52" value={form.total_lessons} onChange={e => setForm({ ...form, total_lessons: e.target.value })} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Startdatum</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Vaste docent</Label>
              <Select value={form.team_member_id || NONE} onValueChange={v => setForm({ ...form, team_member_id: v === NONE ? "" : v })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecteer..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Geen</SelectItem>
                  {teamMembers.filter(m => m.is_active).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Locatie</Label>
              <Select value={form.location_id || NONE} onValueChange={v => setForm({ ...form, location_id: v === NONE ? "" : v })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecteer..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Geen</SelectItem>
                  {locations.filter(l => l.is_active).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">School (optioneel)</Label>
              <Select value={form.school_id || NONE} onValueChange={v => setForm({ ...form, school_id: v === NONE ? "" : v })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Geen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Geen</SelectItem>
                  {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Omschrijving</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="text-xs mt-1" />
            </div>
          </div>

          {/* Recurring schedule */}
          {!editingId && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Switch checked={enableRecurring} onCheckedChange={setEnableRecurring} />
                <Label className="text-xs font-medium">Sessies automatisch inplannen</Label>
              </div>
              {enableRecurring && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Dag</Label>
                    <Select value={recurring.day} onValueChange={v => setRecurring({ ...recurring, day: v })}>
                      <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>{DAY_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Starttijd</Label>
                    <Input type="time" value={recurring.start_time} onChange={e => setRecurring({ ...recurring, start_time: e.target.value })} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Eindtijd</Label>
                    <Input type="time" value={recurring.end_time} onChange={e => setRecurring({ ...recurring, end_time: e.target.value })} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Frequentie</Label>
                    <Select value={recurring.frequency} onValueChange={v => setRecurring({ ...recurring, frequency: v })}>
                      <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Wekelijks</SelectItem>
                        <SelectItem value="biweekly">Tweewekelijks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {enableRecurring && form.start_date && (
                <p className="text-[10px] text-muted-foreground">
                  {getRecurringDates().length} lessen worden ingepland vanaf {format(getRecurringDates()[0] || new Date(), "d MMMM yyyy", { locale: nl })}
                </p>
              )}
            </div>
          )}

          {/* Last lesson at studio */}
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={form.last_lesson_at_studio} onCheckedChange={v => setForm({ ...form, last_lesson_at_studio: v })} />
            <Label className="text-xs">Laatste les bij ons (alle studio's boeken)</Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={saveWorkshop} disabled={saving}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {editingId ? "Opslaan" : "Aanmaken"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={resetForm}><X size={12} /> Annuleren</Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Geen workshops gevonden</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(w => {
            const prog = getProgress(w);
            return (
              <div key={w.id} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BookOpen size={16} className="text-primary shrink-0" />
                      <button onClick={() => setSelectedId(w.id)} className="font-medium text-foreground hover:text-primary hover:underline text-left">{w.title}</button>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[w.status] || "bg-muted text-muted-foreground"}`}>
                        {statusLabels[w.status] || w.status}
                      </span>
                    </div>
                    {w.description && <p className="text-xs text-muted-foreground ml-[24px]">{w.description}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ml-[24px]">
                      {w.class_name && (
                        <span className="flex items-center gap-1"><GraduationCap size={11} />{w.class_name} ({w.class_size || 0} leerlingen)</span>
                      )}
                      {w.start_date && (
                        <span className="flex items-center gap-1"><CalendarDays size={11} />{format(new Date(w.start_date), "d MMM yyyy", { locale: nl })}</span>
                      )}
                      {w.location_id && getLocationName(w.location_id) && (
                        <span className="flex items-center gap-1"><MapPin size={11} />{getLocationName(w.location_id)}</span>
                      )}
                      {w.team_member_id && getTeamMemberName(w.team_member_id) && (
                        <span className="flex items-center gap-1"><Users size={11} />{getTeamMemberName(w.team_member_id)}</span>
                      )}
                      {w.school_id && getSchoolName(w.school_id) && (
                        <span className="flex items-center gap-1"><School size={11} />{getSchoolName(w.school_id)}</span>
                      )}
                      <Badge variant="outline" className="text-[10px] py-0 h-5">{getSessionCount(w.id)}/{w.total_lessons} lessen</Badge>
                      {w.last_lesson_at_studio && <Badge variant="outline" className="text-[10px] py-0 h-5">📍 Eindpresentatie bij ons</Badge>}
                    </div>
                    {/* Progress */}
                    <div className="ml-[24px] mt-2 flex items-center gap-2">
                      <Progress value={prog.percent} className="h-1.5 flex-1 max-w-[200px]" />
                      <span className="text-[10px] text-muted-foreground">{prog.done}/{prog.total}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(w)}><Edit3 size={14} /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeWorkshop(w.id)}><Trash2 size={14} /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrgWorkshopsList;
