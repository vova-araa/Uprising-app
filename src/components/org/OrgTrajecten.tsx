import { useState, useEffect, useMemo } from "react";
import OrgTrajectDetail from "./OrgTrajectDetail";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addWeeks, addDays, startOfWeek, getDay } from "date-fns";
import { nl } from "date-fns/locale";
import { Route, Plus, Loader2, Edit3, Trash2, Save, X, CalendarDays, Users, Search, Repeat, CalendarPlus, MapPin, PlusCircle, Phone, Building2, ChevronDown, ChevronUp, Home, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inlineToast as toast } from "@/components/InlineToast";
import { useConfirm } from "@/components/ConfirmDialog";
import AddressInput from "@/components/AddressInput";
import { Progress } from "@/components/ui/progress";

const ALL = "__all__";
const NONE = "__none__";

const statusLabels: Record<string, string> = {
  active: "Actief", completed: "Afgerond", paused: "Gepauzeerd", planned: "Gepland",
};
const statusColors: Record<string, string> = {
  active: "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]",
  completed: "bg-primary/20 text-primary",
  paused: "bg-yellow-500/20 text-yellow-400",
  planned: "bg-blue-500/20 text-blue-400",
};

const DAY_LABELS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

const OrgTrajecten = () => {
  const confirm = useConfirm();
  const [selectedTrajectId, setSelectedTrajectId] = useState<string | null>(null);
  const { user } = useAuth();
  const [trajecten, setTrajecten] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedParticipants, setExpandedParticipants] = useState<string | null>(null);
  const [newParticipant, setNewParticipant] = useState({ name: "", city: "", phone: "", address: "", guardian_phone: "" });
  const [savingParticipant, setSavingParticipant] = useState(false);
  const [filterStatus, setFilterStatus] = useState(ALL);

  // Quick forward-planning state
  const [planningTrajectId, setPlanningTrajectId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    day: "1", start_time: "10:00", end_time: "12:00",
    weeks: "8", frequency: "weekly",
    start_date: format(new Date(), "yyyy-MM-dd"),
  });
  const [planSaving, setPlanSaving] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", status: "active",
    start_date: "", end_date: "", participant_count: "0", notes: "",
    location_id: "", new_location_address: "", team_member_id: "",
  });

  // Recurring schedule state
  const [enableRecurring, setEnableRecurring] = useState(false);
  const [recurring, setRecurring] = useState({
    day: "1", // 0=sun, 1=mon, ...
    start_time: "10:00",
    end_time: "12:00",
    weeks: "8",
    frequency: "weekly", // weekly | biweekly
    location_id: "",
    team_member_id: "",
  });
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, sRes, sessRes, locRes, tmRes, pRes, repRes] = await Promise.all([
        supabase.from("org_trajecten" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("org_schools" as any).select("*").order("name"),
        supabase.from("org_sessions" as any).select("id, title, session_date, traject_id").not("traject_id", "is", null),
        supabase.from("org_locations" as any).select("*").order("name"),
        supabase.from("org_team_members" as any).select("*").order("name"),
        supabase.from("org_participants" as any).select("*").order("name"),
        supabase.from("org_session_reports" as any).select("id, session_id"),
      ]);
      if (tRes.error) throw tRes.error;
      setTrajecten((tRes.data as any[]) || []);
      setSchools((sRes.data as any[]) || []);
      setSessions((sessRes.data as any[]) || []);
      setLocations((locRes.data as any[]) || []);
      setTeamMembers((tmRes.data as any[]) || []);
      setParticipants((pRes.data as any[]) || []);
      setReports((repRes.data as any[]) || []);
    } catch (err: any) {
      toast.error(`Laden mislukt: ${err.message || "Onbekende fout"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ title: "", description: "", status: "active", start_date: "", end_date: "", participant_count: "0", notes: "", location_id: "", new_location_address: "", team_member_id: "" });
    setEnableRecurring(false);
    setRecurring({ day: "1", start_time: "10:00", end_time: "12:00", weeks: "8", frequency: "weekly", location_id: "", team_member_id: "" });
    setAdding(false);
    setEditingId(null);
  };

  // Generate recurring dates
  const getRecurringDates = () => {
    if (!form.start_date) return [];
    const targetDay = parseInt(recurring.day);
    const startDate = new Date(form.start_date);
    // Find the first occurrence of the target day on or after start_date
    let firstDate = new Date(startDate);
    while (getDay(firstDate) !== targetDay) {
      firstDate = addDays(firstDate, 1);
    }
    const weeks = parseInt(recurring.weeks) || 1;
    const step = recurring.frequency === "biweekly" ? 2 : 1;
    const dates: Date[] = [];
    for (let i = 0; i < weeks; i++) {
      dates.push(addWeeks(firstDate, i * step));
    }
    return dates;
  };

  const previewDates = enableRecurring ? getRecurringDates() : [];

  const save = async () => {
    if (!form.title.trim()) { toast.error("Titel is verplicht"); return; }
    if (!user) { toast.error("Je bent niet ingelogd"); return; }
    if (enableRecurring && !form.start_date) { toast.error("Startdatum is verplicht voor terugkerende planning"); return; }
    setSaving(true);
    try {
      // Auto-create location if new address provided
      let resolvedLocationId: string | null = form.location_id || null;
      if (!resolvedLocationId && form.new_location_address.trim()) {
        const locName = form.title.trim();
        const { data: locData, error: locError } = await (supabase.from("org_locations" as any) as any)
          .insert({
            name: locName,
            address: form.new_location_address.trim(),
          })
          .select("id")
          .single();
        if (!locError && locData) resolvedLocationId = locData.id;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        school_id: null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || (enableRecurring && previewDates.length > 0 ? format(previewDates[previewDates.length - 1], "yyyy-MM-dd") : null),
        participant_count: parseInt(form.participant_count) || 0,
        notes: form.notes || null,
        location_id: resolvedLocationId,
        team_member_id: form.team_member_id || null,
        updated_at: new Date().toISOString(),
      };

      let trajectId = editingId;

      if (editingId) {
        const { error } = await (supabase.from("org_trajecten" as any) as any).update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await (supabase.from("org_trajecten" as any) as any).insert({ ...payload, created_by: user.id }).select("id").single();
        if (error) throw new Error(error.message);
        trajectId = data.id;
      }

      // Create recurring sessions if enabled and it's a new traject (or user explicitly wants)
      if (enableRecurring && previewDates.length > 0 && trajectId) {
        const sessionPayloads = previewDates.map(date => ({
          title: form.title.trim(),
          session_type: "workshop",
          session_date: format(date, "yyyy-MM-dd"),
          start_time: recurring.start_time,
          end_time: recurring.end_time,
          location_id: recurring.location_id || resolvedLocationId || null,
          team_member_id: recurring.team_member_id || null,
          traject_id: trajectId,
          created_by: user.id,
        }));

        const { error: sessError } = await (supabase.from("org_sessions" as any) as any).insert(sessionPayloads);
        if (sessError) {
          toast.error(`Traject opgeslagen, maar sessies aanmaken mislukt: ${sessError.message}`);
        } else {
          toast.success(`${editingId ? "Traject bijgewerkt" : "Traject aangemaakt"} met ${previewDates.length} sessies`);
        }
      } else {
        toast.success(editingId ? "Traject bijgewerkt" : "Traject aangemaakt");
      }

      resetForm();
      load();
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message}`);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Traject verwijderen?", message: "Gekoppelde sessies behouden hun data.", destructive: true }))) return;
    const { error } = await (supabase.from("org_trajecten" as any) as any).delete().eq("id", id);
    if (error) { toast.error(`Verwijderen mislukt: ${error.message}`); return; }
    toast.success("Verwijderd");
    load();
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setAdding(false);
    setForm({
      title: t.title || "", description: t.description || "",
      status: t.status || "active", start_date: t.start_date || "", end_date: t.end_date || "",
      participant_count: String(t.participant_count || 0), notes: t.notes || "",
      location_id: t.location_id || "", new_location_address: "", team_member_id: t.team_member_id || "",
    });
    setEnableRecurring(false);
  };

  const getSchoolName = (id: string) => schools.find(s => s.id === id)?.name || "—";
  const getLocationName = (id: string) => {
    const loc = locations.find(l => l.id === id);
    return loc ? (loc.address ? `${loc.name} — ${loc.address}` : loc.name) : null;
  };
  const getSessionCount = (trajectId: string) => sessions.filter(s => s.traject_id === trajectId).length;
  const getTeamMemberName = (id: string) => teamMembers.find(m => m.id === id)?.name || null;
  const getParticipants = (trajectId: string) => participants.filter(p => p.traject_id === trajectId);

  const getTrajectProgress = (t: any) => {
    const tSessions = sessions.filter(s => s.traject_id === t.id);
    const tParticipants = getParticipants(t.id);
    const tReports = tSessions.filter(s => reports.some(r => r.session_id === s.id));
    
    const milestones = [
      true, // traject aangemaakt
      tParticipants.length > 0,
      tSessions.length > 0,
      ...tSessions.map(s => reports.some(r => r.session_id === s.id)),
      t.status === "completed",
    ];
    const done = milestones.filter(Boolean).length;
    return { done, total: milestones.length, percent: milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0 };
  };

  const addParticipant = async (trajectId: string) => {
    if (!newParticipant.name.trim()) { toast.error("Naam is verplicht"); return; }
    setSavingParticipant(true);
    try {
      const { error } = await (supabase.from("org_participants" as any) as any).insert({
        traject_id: trajectId,
        name: newParticipant.name.trim(),
        city: newParticipant.city.trim() || null,
        phone: newParticipant.phone.trim() || null,
        address: newParticipant.address.trim() || null,
        guardian_phone: newParticipant.guardian_phone.trim() || null,
      });
      if (error) throw new Error(error.message);
      setNewParticipant({ name: "", city: "", phone: "", address: "", guardian_phone: "" });
      toast.success("Deelnemer toegevoegd");
      load();
    } catch (err: any) {
      toast.error(`Toevoegen mislukt: ${err.message}`);
    } finally { setSavingParticipant(false); }
  };

  const removeParticipant = async (id: string) => {
    if (!(await confirm({ title: "Deelnemer verwijderen?", destructive: true }))) return;
    const { error } = await (supabase.from("org_participants" as any) as any).delete().eq("id", id);
    if (error) { toast.error(`Verwijderen mislukt: ${error.message}`); return; }
    toast.success("Verwijderd");
    load();
  };

  // Quick forward-plan: generate dates
  const getPlanDates = () => {
    const targetDay = parseInt(planForm.day);
    const startDate = new Date(planForm.start_date);
    let firstDate = new Date(startDate);
    while (getDay(firstDate) !== targetDay) {
      firstDate = addDays(firstDate, 1);
    }
    const weeks = parseInt(planForm.weeks) || 1;
    const step = planForm.frequency === "biweekly" ? 2 : 1;
    const dates: Date[] = [];
    for (let i = 0; i < weeks; i++) {
      dates.push(addWeeks(firstDate, i * step));
    }
    return dates;
  };

  const quickPlanSessions = async (trajectId: string) => {
    if (!user) return;
    setPlanSaving(true);
    try {
      const traject = trajecten.find(t => t.id === trajectId);
      const dates = getPlanDates();
      if (dates.length === 0) { toast.error("Geen datums gegenereerd"); setPlanSaving(false); return; }

      const sessionPayloads = dates.map(date => ({
        title: traject?.title || "Sessie",
        session_type: "workshop",
        session_date: format(date, "yyyy-MM-dd"),
        start_time: planForm.start_time,
        end_time: planForm.end_time,
        location_id: traject?.location_id || null,
        team_member_id: traject?.team_member_id || null,
        traject_id: trajectId,
        created_by: user.id,
      }));

      const { error } = await (supabase.from("org_sessions" as any) as any).insert(sessionPayloads);
      if (error) throw new Error(error.message);
      toast.success(`${dates.length} sessies ingepland in de kalender`);
      setPlanningTrajectId(null);
      load();
    } catch (err: any) {
      toast.error(`Inplannen mislukt: ${err.message}`);
    } finally { setPlanSaving(false); }
  };

  const filtered = useMemo(() => {
    return trajecten.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== ALL && t.status !== filterStatus) return false;
      return true;
    });
  }, [trajecten, search, filterStatus]);

  if (selectedTrajectId) {
    return <OrgTrajectDetail trajectId={selectedTrajectId} onBack={() => setSelectedTrajectId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Trajecten</h1>
          <p className="text-sm text-muted-foreground">Beheer lopende en afgeronde trajecten</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setAdding(true); }}>
          <Plus size={16} className="mr-1" /> Nieuw traject
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken..." className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle statussen</SelectItem>
            <SelectItem value="active">Actief</SelectItem>
            <SelectItem value="planned">Gepland</SelectItem>
            <SelectItem value="paused">Gepauzeerd</SelectItem>
            <SelectItem value="completed">Afgerond</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(adding || editingId) && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div>
            <Label>Titel *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Naam van het traject..." />
          </div>
          <div>
            <Label>Beschrijving</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Omschrijving..." rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actief</SelectItem>
                  <SelectItem value="planned">Gepland</SelectItem>
                  <SelectItem value="paused">Gepauzeerd</SelectItem>
                  <SelectItem value="completed">Afgerond</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sessie-begeleider</Label>
              <Select value={form.team_member_id || NONE} onValueChange={v => setForm({ ...form, team_member_id: v === NONE ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecteer..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Geen</SelectItem>
                  {teamMembers.filter(m => m.is_active).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}{m.role ? ` (${m.role})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deelnemers</Label>
              <Input type="number" min="0" value={form.participant_count} onChange={e => setForm({ ...form, participant_count: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Startdatum</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>Einddatum</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notities</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Extra notities..." rows={2} />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Locatie</Label>
              <Select value={form.location_id || NONE} onValueChange={v => setForm({ ...form, location_id: v === NONE ? "" : v, new_location_address: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecteer locatie..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    <span className="flex items-center gap-1.5">
                      <PlusCircle size={12} className="shrink-0 text-primary" />
                      Nieuw adres invoeren
                    </span>
                  </SelectItem>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={12} className="shrink-0" />
                        {l.name}{l.address ? ` — ${l.address}` : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(!form.location_id || form.location_id === NONE) && (
              <AddressInput
                value={form.new_location_address}
                onChange={val => setForm({ ...form, new_location_address: val })}
                label="Nieuw adres"
                placeholder="Zoek en selecteer adres..."
              />
            )}
          </div>

          {/* Recurring schedule section */}
          <div className="border-t border-border pt-3 mt-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-primary" />
                <Label className="text-sm font-semibold mb-0">Terugkerende planning</Label>
              </div>
              <Switch checked={enableRecurring} onCheckedChange={setEnableRecurring} />
            </div>

            {enableRecurring && (
              <div className="space-y-3 p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Dag</Label>
                    <Select value={recurring.day} onValueChange={v => setRecurring({ ...recurring, day: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_LABELS.map((label, i) => (
                          <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Frequentie</Label>
                    <Select value={recurring.frequency} onValueChange={v => setRecurring({ ...recurring, frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Elke week</SelectItem>
                        <SelectItem value="biweekly">Om de week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Aantal weken</Label>
                    <Select value={recurring.weeks} onValueChange={v => setRecurring({ ...recurring, weeks: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[4, 6, 8, 10, 12, 16, 20, 24, 30, 36, 40, 52].map(w => (
                          <SelectItem key={w} value={String(w)}>{w} sessies</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 sm:col-span-1" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Starttijd</Label>
                    <Input type="time" value={recurring.start_time} onChange={e => setRecurring({ ...recurring, start_time: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Eindtijd</Label>
                    <Input type="time" value={recurring.end_time} onChange={e => setRecurring({ ...recurring, end_time: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Locatie</Label>
                    <Select value={recurring.location_id || NONE} onValueChange={v => setRecurring({ ...recurring, location_id: v === NONE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Locatie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Geen</SelectItem>
                        {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Teamlid</Label>
                    <Select value={recurring.team_member_id || NONE} onValueChange={v => setRecurring({ ...recurring, team_member_id: v === NONE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Teamlid..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Geen</SelectItem>
                        {teamMembers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview */}
                {previewDates.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CalendarPlus size={14} className="text-primary" />
                      <span className="text-xs font-medium text-foreground">{previewDates.length} sessies worden aangemaakt:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {previewDates.slice(0, 12).map((d, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] py-0.5">
                          {format(d, "EEE d MMM", { locale: nl })}
                        </Badge>
                      ))}
                      {previewDates.length > 12 && (
                        <Badge variant="outline" className="text-[10px] py-0.5 text-muted-foreground">
                          +{previewDates.length - 12} meer
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {!form.start_date && (
                  <p className="text-xs text-destructive">⚠ Vul een startdatum in om de planning te genereren</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
              {enableRecurring && previewDates.length > 0 ? `Opslaan + ${previewDates.length} sessies` : "Opslaan"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              <X size={14} className="mr-1" /> Annuleren
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Route size={40} className="mx-auto mb-3 opacity-40" />
          <p>Geen trajecten gevonden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Route size={16} className="text-primary shrink-0" />
                    <button onClick={() => setSelectedTrajectId(t.id)} className="font-medium text-foreground hover:text-primary hover:underline text-left">{t.title}</button>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabels[t.status] || t.status}
                    </span>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground ml-[24px]">{t.description}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ml-[24px]">
                    
                    {t.start_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={11} />
                        {format(new Date(t.start_date), "d MMM yyyy", { locale: nl })}
                        {t.end_date && ` — ${format(new Date(t.end_date), "d MMM yyyy", { locale: nl })}`}
                      </span>
                    )}
                    {t.location_id && getLocationName(t.location_id) && (
                      <button
                        onClick={() => {
                          const loc = locations.find(l => l.id === t.location_id);
                          if (loc?.address) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`, "_blank");
                        }}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <MapPin size={11} />{getLocationName(t.location_id)}
                      </button>
                    )}
                    {t.team_member_id && getTeamMemberName(t.team_member_id) && (
                      <span className="flex items-center gap-1"><Users size={11} />{getTeamMemberName(t.team_member_id)}</span>
                    )}
                    {getParticipants(t.id).length > 0 && (
                      <button
                        onClick={() => setExpandedParticipants(expandedParticipants === t.id ? null : t.id)}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Users size={11} />{getParticipants(t.id).length} deelnemers
                        {expandedParticipants === t.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    )}
                    {getParticipants(t.id).length === 0 && (
                      <button
                        onClick={() => setExpandedParticipants(expandedParticipants === t.id ? null : t.id)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                      >
                        <Users size={11} />Deelnemers toevoegen
                        {expandedParticipants === t.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    )}
                    {getSessionCount(t.id) > 0 && (
                      <Badge variant="outline" className="text-[10px] py-0 h-5">{getSessionCount(t.id)} sessies</Badge>
                    )}
                  </div>
                  {/* Progress bar */}
                  {(() => {
                    const prog = getTrajectProgress(t);
                    return (
                      <div className="ml-[24px] mt-2 flex items-center gap-2">
                        <Progress value={prog.percent} className="h-1.5 flex-1 max-w-[200px]" />
                        <span className="text-[10px] text-muted-foreground">{prog.done}/{prog.total}</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Vooruit inplannen"
                    onClick={() => {
                      setPlanningTrajectId(planningTrajectId === t.id ? null : t.id);
                      setPlanForm({
                        day: "1", start_time: "10:00", end_time: "12:00",
                        weeks: "8", frequency: "weekly",
                        start_date: format(new Date(), "yyyy-MM-dd"),
                      });
                    }}
                  >
                    <CalendarPlus size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(t)}>
                    <Edit3 size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(t.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              {/* Expandable participants section */}
              {expandedParticipants === t.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-2 ml-[24px]">
                  {getParticipants(t.id).map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-md bg-secondary/30">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span className="font-medium text-foreground">{p.name}</span>
                        {p.address && <span className="flex items-center gap-1 text-muted-foreground"><Home size={10} />{p.address}</span>}
                        {p.city && <span className="flex items-center gap-1 text-muted-foreground"><Building2 size={10} />{p.city}</span>}
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                            <Phone size={10} />{p.phone}
                          </a>
                        )}
                        {p.guardian_phone && (
                          <a href={`tel:${p.guardian_phone}`} className="flex items-center gap-1 text-amber-400 hover:underline" title="Voogd nummer">
                            <ShieldCheck size={10} />{p.guardian_phone}
                          </a>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeParticipant(p.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                  {/* Add new participant */}
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={newParticipant.name}
                        onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })}
                        placeholder="Naam *"
                        className="h-8 text-xs flex-1"
                      />
                      <Input
                        value={newParticipant.address}
                        onChange={e => setNewParticipant({ ...newParticipant, address: e.target.value })}
                        placeholder="Adres"
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={newParticipant.phone}
                        onChange={e => setNewParticipant({ ...newParticipant, phone: e.target.value })}
                        placeholder="Telefoon"
                        className="h-8 text-xs flex-1"
                      />
                      <Input
                        value={newParticipant.guardian_phone}
                        onChange={e => setNewParticipant({ ...newParticipant, guardian_phone: e.target.value })}
                        placeholder="Voogd nummer"
                        className="h-8 text-xs flex-1"
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => addParticipant(t.id)} disabled={savingParticipant}>
                        {savingParticipant ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        <span className="ml-1">Toevoegen</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick forward-planning panel */}
              {planningTrajectId === t.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-3 ml-[24px]">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarPlus size={14} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">Vooruit inplannen</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Startdatum</Label>
                      <Input type="date" value={planForm.start_date} onChange={e => setPlanForm({ ...planForm, start_date: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Dag</Label>
                      <select value={planForm.day} onChange={e => setPlanForm({ ...planForm, day: e.target.value })} className="w-full rounded-md bg-secondary border border-border px-2 py-1.5 text-xs">
                        {["Zondag","Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag"].map((l, i) => (
                          <option key={i} value={String(i)}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Frequentie</Label>
                      <select value={planForm.frequency} onChange={e => setPlanForm({ ...planForm, frequency: e.target.value })} className="w-full rounded-md bg-secondary border border-border px-2 py-1.5 text-xs">
                        <option value="weekly">Elke week</option>
                        <option value="biweekly">Om de week</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Aantal sessies</Label>
                      <select value={planForm.weeks} onChange={e => setPlanForm({ ...planForm, weeks: e.target.value })} className="w-full rounded-md bg-secondary border border-border px-2 py-1.5 text-xs">
                        {[4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 52].map(w => (
                          <option key={w} value={String(w)}>{w} sessies</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-w-xs">
                    <div>
                      <Label className="text-xs">Starttijd</Label>
                      <Input type="time" value={planForm.start_time} onChange={e => setPlanForm({ ...planForm, start_time: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Eindtijd</Label>
                      <Input type="time" value={planForm.end_time} onChange={e => setPlanForm({ ...planForm, end_time: e.target.value })} className="h-8 text-xs" />
                    </div>
                  </div>
                  {getPlanDates().length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {getPlanDates().length} sessies: {format(getPlanDates()[0], "d MMM", { locale: nl })} t/m {format(getPlanDates()[getPlanDates().length - 1], "d MMM yyyy", { locale: nl })}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-xs" onClick={() => quickPlanSessions(t.id)} disabled={planSaving}>
                      {planSaving ? <Loader2 size={12} className="animate-spin mr-1" /> : <CalendarPlus size={12} className="mr-1" />}
                      {getPlanDates().length} sessies inplannen
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setPlanningTrajectId(null)}>
                      <X size={12} className="mr-1" /> Annuleren
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrgTrajecten;
