import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addWeeks, addDays, getDay } from "date-fns";
import { nl } from "date-fns/locale";
import { School, Plus, Loader2, Edit3, Trash2, Save, X, Mail, Phone, MapPin, User, ExternalLink, CalendarPlus, Users, Route, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inlineToast as toast } from "@/components/InlineToast";
import { useConfirm } from "@/components/ConfirmDialog";
import AddressInput from "@/components/AddressInput";
import OrgTrajectDetail from "./OrgTrajectDetail";
import OrgSchoolDetail from "./OrgSchoolDetail";

const DURATION_OPTIONS = [
  { value: "6_weeks", label: "6 weken" },
  { value: "8_weeks", label: "8 weken" },
  { value: "10_weeks", label: "10 weken" },
  { value: "3_months", label: "3 maanden" },
  { value: "6_months", label: "6 maanden" },
  { value: "1_year", label: "1 jaar" },
  { value: "ongoing", label: "Doorlopend" },
];

const durationLabel = (val: string | null) =>
  DURATION_OPTIONS.find(o => o.value === val)?.label || val || "—";

const OrgSchools = () => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [trajecten, setTrajecten] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", contact_person: "", contact_email: "", contact_phone: "", address: "", notes: "", default_traject_duration: "",
  });

  // Selected detail views
  const [selectedTrajectId, setSelectedTrajectId] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  // Forward-planning state
  const [planningSchoolId, setPlanningSchoolId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    day: "1", start_time: "10:00", end_time: "12:00",
    weeks: "6", frequency: "weekly",
    start_date: format(new Date(), "yyyy-MM-dd"),
    vaste_docent: "",
  });
  const [planSaving, setPlanSaving] = useState(false);
  // Per-session teacher overrides: index -> team_member_id
  const [sessionTeachers, setSessionTeachers] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [schoolRes, locRes, teamRes, trajRes] = await Promise.all([
        supabase.from("org_schools" as any).select("*").order("name"),
        supabase.from("org_locations" as any).select("*"),
        supabase.from("org_team_members" as any).select("*").eq("is_active", true).order("name"),
        supabase.from("org_trajecten" as any).select("*").order("created_at", { ascending: false }),
      ]);
      if (schoolRes.error) throw schoolRes.error;
      setSchools((schoolRes.data as any[]) || []);
      setLocations((locRes.data as any[]) || []);
      setTeamMembers((teamRes.data as any[]) || []);
      setTrajecten((trajRes.data as any[]) || []);
    } catch (err: any) {
      toast.error(`Laden mislukt: ${err.message || "Onbekende fout"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: "", contact_person: "", contact_email: "", contact_phone: "", address: "", notes: "", default_traject_duration: "" });
    setAdding(false);
    setEditingId(null);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Naam is verplicht"); return; }
    setSaving(true);
    try {
      // Auto-create or update location if address is provided
      let locationId: string | null = null;
      if (form.address.trim()) {
        // Check if a location already exists for this school
        const existingSchool = editingId ? schools.find(s => s.id === editingId) : null;
        if (existingSchool?.location_id) {
          // Update existing location
          await (supabase.from("org_locations" as any) as any).update({
            name: form.name.trim(),
            address: form.address.trim(),
            contact_person: form.contact_person || null,
            contact_phone: form.contact_phone || null,
            contact_email: form.contact_email || null,
            updated_at: new Date().toISOString(),
          }).eq("id", existingSchool.location_id);
          locationId = existingSchool.location_id;
        } else {
          // Create new location
          const { data: locData, error: locError } = await (supabase.from("org_locations" as any) as any)
            .insert({
              name: form.name.trim(),
              address: form.address.trim(),
              contact_person: form.contact_person || null,
              contact_phone: form.contact_phone || null,
              contact_email: form.contact_email || null,
            })
            .select("id")
            .single();
          if (!locError && locData) locationId = locData.id;
        }
      }

      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        address: form.address || null,
        notes: form.notes || null,
        default_traject_duration: form.default_traject_duration || null,
        location_id: locationId,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await (supabase.from("org_schools" as any) as any).update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
        toast.success("School bijgewerkt");
      } else {
        const { error } = await (supabase.from("org_schools" as any) as any).insert(payload);
        if (error) throw new Error(error.message);
        toast.success("School toegevoegd");
      }
      resetForm();
      load();
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message}`);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "School verwijderen?", message: "Gekoppelde trajecten behouden hun data.", destructive: true }))) return;
    const { error } = await (supabase.from("org_schools" as any) as any).delete().eq("id", id);
    if (error) { toast.error(`Verwijderen mislukt: ${error.message}`); return; }
    toast.success("Verwijderd");
    load();
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setAdding(false);
    setForm({
      name: s.name || "", contact_person: s.contact_person || "",
      contact_email: s.contact_email || "", contact_phone: s.contact_phone || "",
      address: s.address || "", notes: s.notes || "",
      default_traject_duration: s.default_traject_duration || "",
    });
  };

  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
  };

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

  const quickPlanSessions = async (schoolId: string) => {
    if (!user) return;
    setPlanSaving(true);
    try {
      const school = schools.find(s => s.id === schoolId);
      const dates = getPlanDates();
      if (dates.length === 0) { toast.error("Geen datums gegenereerd"); setPlanSaving(false); return; }

      const sessionPayloads = dates.map((date, i) => {
        const teacherId = sessionTeachers[i] || planForm.vaste_docent || null;
        const teacher = teacherId ? teamMembers.find(m => m.id === teacherId) : null;
        const teacherNote = teacher ? ` (${teacher.name})` : "";
        return {
          title: `Workshop — ${school?.name || "School"}${teacherNote}`,
          session_type: "workshop",
          session_date: format(date, "yyyy-MM-dd"),
          start_time: planForm.start_time,
          end_time: planForm.end_time,
          location_id: school?.location_id || null,
          team_member_id: teacherId,
          traject_id: null,
          created_by: user.id,
        };
      });

      const { error } = await (supabase.from("org_sessions" as any) as any).insert(sessionPayloads);
      if (error) throw new Error(error.message);
      toast.success(`${dates.length} sessies ingepland in de kalender`);
      setPlanningSchoolId(null);
      setSessionTeachers({});
    } catch (err: any) {
      toast.error(`Inplannen mislukt: ${err.message}`);
    } finally { setPlanSaving(false); }
  };

  if (selectedSchoolId) {
    return <OrgSchoolDetail schoolId={selectedSchoolId} onBack={() => setSelectedSchoolId(null)} />;
  }

  // If a traject is selected, show its detail page
  if (selectedTrajectId) {
    return <OrgTrajectDetail trajectId={selectedTrajectId} onBack={() => setSelectedTrajectId(null)} />;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Scholen & Partners</h1>
          <p className="text-sm text-muted-foreground">Beheer de scholen waarmee de stichting samenwerkt</p>
        </div>
        <Button size="sm" onClick={() => { setAdding(true); setEditingId(null); setForm({ name: "", contact_person: "", contact_email: "", contact_phone: "", address: "", notes: "", default_traject_duration: "" }); }}>
          <Plus size={16} className="mr-1" /> Toevoegen
        </Button>
      </div>

      {(adding || editingId) && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div>
            <Label>Schoolnaam *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Naam van de school..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Contactpersoon</Label>
              <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Naam contactpersoon" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="email@school.nl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Telefoon</Label>
              <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="+31..." />
            </div>
            <AddressInput
              value={form.address}
              onChange={val => setForm({ ...form, address: val })}
            />
          </div>
          <div>
            <Label>Standaard trajectduur</Label>
            <Select value={form.default_traject_duration} onValueChange={val => setForm({ ...form, default_traject_duration: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer duur..." />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notities</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Extra informatie..." rows={2} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
              Opslaan
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              <X size={14} className="mr-1" /> Annuleren
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : schools.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <School size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nog geen scholen toegevoegd</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schools.map(s => (
            <div key={s.id} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <School size={16} className="text-primary shrink-0" />
                    <button onClick={() => setSelectedSchoolId(s.id)} className="hover:text-primary hover:underline transition-colors text-left">
                      {s.name}
                    </button>
                    {!s.is_active && <span className="text-xs text-muted-foreground">(inactief)</span>}
                    {s.default_traject_duration && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {durationLabel(s.default_traject_duration)}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-muted-foreground ml-auto cursor-pointer hover:text-foreground" onClick={() => setSelectedSchoolId(s.id)} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ml-[24px]">
                    {s.contact_person && <span className="flex items-center gap-1"><User size={11} />{s.contact_person}</span>}
                    {s.contact_email && (
                      <a href={`mailto:${s.contact_email}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Mail size={11} />{s.contact_email}
                      </a>
                    )}
                    {s.contact_phone && (
                      <a href={`tel:${s.contact_phone}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Phone size={11} />{s.contact_phone}
                      </a>
                    )}
                    {s.address && (
                      <button
                        onClick={() => openMaps(s.address)}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <MapPin size={11} />{s.address}
                        <ExternalLink size={9} className="opacity-60" />
                      </button>
                    )}
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground ml-[24px] mt-1">{s.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Vooruit inplannen"
                    onClick={() => {
                      setPlanningSchoolId(planningSchoolId === s.id ? null : s.id);
                      setPlanForm({ day: "1", start_time: "10:00", end_time: "12:00", weeks: "6", frequency: "weekly", start_date: format(new Date(), "yyyy-MM-dd"), vaste_docent: "" });
                      setSessionTeachers({});
                    }}
                  >
                    <CalendarPlus size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(s)}>
                    <Edit3 size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(s.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              {/* Forward-planning panel */}
              {planningSchoolId === s.id && (
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

                  {/* Docenten toewijzing */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">Docenten</span>
                    </div>
                    <div>
                      <Label className="text-xs">Vaste docent</Label>
                      <select
                        value={planForm.vaste_docent}
                        onChange={e => setPlanForm({ ...planForm, vaste_docent: e.target.value })}
                        className="w-full rounded-md bg-secondary border border-border px-2 py-1.5 text-xs"
                      >
                        <option value="">Geen vaste docent</option>
                        {teamMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}{m.role ? ` (${m.role})` : ""}</option>
                        ))}
                      </select>
                    </div>

                    {getPlanDates().length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Per sessie (gastdocent overschrijft vaste docent)</Label>
                        <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-border p-2 bg-background">
                          {getPlanDates().map((date, i) => {
                            const teacher = sessionTeachers[i] || "";
                            const vasteNaam = planForm.vaste_docent ? teamMembers.find(m => m.id === planForm.vaste_docent)?.name : null;
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-20 shrink-0">{format(date, "d MMM", { locale: nl })}</span>
                                <select
                                  value={teacher}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setSessionTeachers(prev => {
                                      const next = { ...prev };
                                      if (val) next[i] = val; else delete next[i];
                                      return next;
                                    });
                                  }}
                                  className="flex-1 rounded bg-secondary border border-border px-1.5 py-1 text-xs"
                                >
                                  <option value="">{vasteNaam ? `${vasteNaam} (vast)` : "— Geen —"}</option>
                                  {teamMembers.filter(m => m.id !== planForm.vaste_docent).map(m => (
                                    <option key={m.id} value={m.id}>🎤 {m.name}{m.role ? ` (${m.role})` : ""}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {getPlanDates().length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {getPlanDates().length} sessies: {format(getPlanDates()[0], "d MMM", { locale: nl })} t/m {format(getPlanDates()[getPlanDates().length - 1], "d MMM yyyy", { locale: nl })}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-xs" onClick={() => quickPlanSessions(s.id)} disabled={planSaving}>
                      {planSaving ? <Loader2 size={12} className="animate-spin mr-1" /> : <CalendarPlus size={12} className="mr-1" />}
                      {getPlanDates().length} sessies inplannen
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setPlanningSchoolId(null)}>
                      <X size={12} className="mr-1" /> Annuleren
                    </Button>
                  </div>
                </div>
              )}

              {/* Linked trajecten */}
              {(() => {
                const schoolTrajecten = trajecten.filter(t => t.school_id === s.id);
                if (schoolTrajecten.length === 0) return null;
                return (
                  <div className="mt-3 pt-3 border-t border-border ml-[24px]">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Route size={11} className="text-primary" /> Trajecten ({schoolTrajecten.length})
                    </p>
                    <div className="space-y-1">
                      {schoolTrajecten.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTrajectId(t.id)}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "active" ? "bg-emerald-500" : t.status === "completed" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                            <span className="text-xs font-medium text-foreground truncate">{t.title}</span>
                            <Badge className={`text-[9px] border ${statusColors[t.status] || "bg-muted"}`}>
                              {statusLabels[t.status] || t.status}
                            </Badge>
                          </div>
                          <ChevronRight size={12} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrgSchools;
