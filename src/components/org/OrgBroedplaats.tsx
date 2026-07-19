import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import OrgWorkshopDetail from "./OrgWorkshopDetail";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Edit3, Save, Trash2, Loader2, Plus,
  Users, CalendarDays, Settings, BookOpen, Check, Lock, Calendar,
  Phone, Shield, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { inlineToast as toast } from "@/components/InlineToast";

const OrgBroedplaats = () => {
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bpWeek, setBpWeek] = useState(new Date());
  const [bpConfig, setBpConfig] = useState<{ weekly_days: Record<string, any> } | null>(null);
  const [bpRsvps, setBpRsvps] = useState<any[]>([]);
  const [bpWorkshops, setBpWorkshops] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  // Config editing
  const [editingConfig, setEditingConfig] = useState(false);
  type DayEntry = { label: string; weekday: number; start_time: string; end_time: string };
  const [configDays, setConfigDays] = useState<DayEntry[]>([]);

  // Workshop editing
  const [addingWorkshop, setAddingWorkshop] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<string | null>(null);
  const [workshopForm, setWorkshopForm] = useState({
    title: "Maandelijkse Workshop", description: "", learning_module: "",
    workshop_date: "", start_time: "14:00", end_time: "17:00",
  });

  // Auto-blocking state
  const [blockWeeks, setBlockWeeks] = useState(4);
  const [blocking, setBlocking] = useState(false);

  // Ambassadors
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [addingAmbassador, setAddingAmbassador] = useState(false);
  const [ambassadorForm, setAmbassadorForm] = useState({ name: "", role: "", phone: "" });
  const [savingAmbassador, setSavingAmbassador] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, rsvpRes, workshopsRes, profilesRes, ambassadorRes] = await Promise.all([
        (supabase.from as any)("broedplaats_config").select("*"),
        supabase.from("broedplaats_rsvp").select("*"),
        (supabase.from as any)("broedplaats_workshops").select("*").order("workshop_date", { ascending: true }),
        supabase.from("profiles").select("id, full_name, email"),
        (supabase.from as any)("org_ambassadors").select("*").order("name"),
      ]);
      setAmbassadors((ambassadorRes.data as any[]) || []);
      const configRows = configRes.data || [];
      const weeklyRow = configRows.find((r: any) => r.config_key === "weekly_days");
      if (weeklyRow) {
        const wd = weeklyRow.config_value || {};
        setBpConfig({ weekly_days: wd });
        // Convert object to array for editing
        const dayKeys = Object.keys(wd).sort();
        setConfigDays(dayKeys.map(k => ({
          label: wd[k]?.label || "",
          weekday: wd[k]?.weekday || 1,
          start_time: wd[k]?.start_time || "10:00",
          end_time: wd[k]?.end_time || "17:00",
        })));
      }
      setBpRsvps((rsvpRes.data as any[]) || []);
      setBpWorkshops((workshopsRes.data as any[]) || []);
      setProfiles((profilesRes.data as any[]) || []);
    } catch (err) {
      console.error("Failed to load broedplaats data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const saveConfig = async () => {
    try {
      const configValue: Record<string, any> = {};
      configDays.forEach((d, i) => {
        configValue[`day${i + 1}`] = { label: d.label, weekday: d.weekday, start_time: d.start_time, end_time: d.end_time };
      });
      await (supabase.from as any)("broedplaats_config").update({
        config_value: configValue,
        updated_at: new Date().toISOString(),
      }).eq("config_key", "weekly_days");
      toast.success("Instellingen opgeslagen");
      setEditingConfig(false);
      loadData();
    } catch {
      toast.error("Opslaan mislukt");
    }
  };

  const saveWorkshop = async () => {
    try {
      if (editingWorkshop) {
        await (supabase.from as any)("broedplaats_workshops").update({
          ...workshopForm, updated_at: new Date().toISOString(),
        }).eq("id", editingWorkshop);
        toast.success("Workshop bijgewerkt");
      } else {
        await (supabase.from as any)("broedplaats_workshops").insert(workshopForm);
        toast.success("Workshop toegevoegd");
      }
      setAddingWorkshop(false);
      setEditingWorkshop(null);
      setWorkshopForm({ title: "Maandelijkse Workshop", description: "", learning_module: "", workshop_date: "", start_time: "14:00", end_time: "17:00" });

      // Auto-create bookings for all studios to block them
      if (workshopForm.workshop_date && workshopForm.start_time && workshopForm.end_time && user) {
        await createStudioBlockBookings(workshopForm.workshop_date, workshopForm.start_time, workshopForm.end_time, "Broedplaats Workshop");
      }

      loadData();
    } catch {
      toast.error("Opslaan mislukt");
    }
  };

  const deleteWorkshop = async (id: string) => {
    if (!confirm("Workshop verwijderen?")) return;
    try {
      await (supabase.from as any)("broedplaats_workshops").delete().eq("id", id);
      toast.success("Workshop verwijderd");
      loadData();
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  // Create bookings for ALL studios to block them during broedplaats
  const createStudioBlockBookings = async (date: string, startTime: string, endTime: string, title: string) => {
    if (!user) return;
    const studios = ["studio1", "studio2", "content"];
    const startH = parseInt(startTime.split(":")[0]);
    const endH = parseInt(endTime.split(":")[0]);
    const duration = endH - startH;
    if (duration <= 0) return;

    for (const studioId of studios) {
      try {
        // Check if already blocked
        const { data: existing } = await supabase.from("bookings")
          .select("id")
          .eq("booking_date", date)
          .eq("studio_id", studioId)
          .eq("start_time", startTime)
          .eq("session_type", "broedplaats")
          .maybeSingle();

        if (!existing) {
          await (supabase.from("bookings") as any).insert({
            booking_date: date,
            studio_id: studioId,
            start_time: startTime,
            duration_hours: duration,
            session_type: "broedplaats",
            status: "confirmed",
            user_id: user.id,
            total_price: 0,
            notes: `🔒 ${title} — Alle ruimtes geblokkeerd`,
          });
        }
      } catch (err) {
        console.error(`Failed to block ${studioId}`, err);
      }
    }
  };

  // Auto-block all fixed days for the next N weeks
  const blockFixedDays = async () => {
    if (!user || !bpConfig?.weekly_days) return;
    setBlocking(true);
    const days = Object.values(bpConfig.weekly_days) as DayEntry[];
    if (days.length === 0) {
      toast.error("Geen vaste dagen geconfigureerd");
      setBlocking(false);
      return;
    }

    let created = 0;
    let skipped = 0;
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });

    for (let w = 0; w < blockWeeks; w++) {
      const thisWeekStart = addWeeks(weekStart, w);
      for (const day of days) {
        const dayDate = addDays(thisWeekStart, (day.weekday - 1));
        // Skip past dates
        if (dayDate < today && dayDate.toDateString() !== today.toDateString()) {
          skipped++;
          continue;
        }
        const dateStr = format(dayDate, "yyyy-MM-dd");
        const startH = parseInt(day.start_time.split(":")[0]);
        const endH = parseInt(day.end_time.split(":")[0]);
        const duration = endH - startH;
        if (duration <= 0) continue;

        const studios = ["studio1", "studio2", "content"];
        for (const studioId of studios) {
          try {
            const { data: existing } = await supabase.from("bookings")
              .select("id")
              .eq("booking_date", dateStr)
              .eq("studio_id", studioId)
              .eq("start_time", day.start_time)
              .eq("session_type", "broedplaats")
              .maybeSingle();

            if (!existing) {
              await (supabase.from("bookings") as any).insert({
                booking_date: dateStr,
                studio_id: studioId,
                start_time: day.start_time,
                duration_hours: duration,
                session_type: "broedplaats",
                status: "confirmed",
                user_id: user.id,
                total_price: 0,
                notes: `🔒 Broedplaats ${day.label} — Alle ruimtes geblokkeerd`,
              });
              created++;
            } else {
              skipped++;
            }
          } catch (err) {
            console.error(`Failed to block ${studioId} on ${dateStr}`, err);
          }
        }
      }
    }

    toast.success(`${created} blokkeringen aangemaakt, ${skipped} overgeslagen (al geblokkeerd of verlopen)`);
    setBlocking(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  if (selectedWorkshopId) {
    return <OrgWorkshopDetail workshopId={selectedWorkshopId} onBack={() => setSelectedWorkshopId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Broedplaats</h1>
        <p className="text-sm text-muted-foreground">Beheer vaste dagen, workshops, aanmeldingen & ruimteblokkering</p>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4">
        <Button variant="ghost" size="icon" onClick={() => setBpWeek(subWeeks(bpWeek, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {format(startOfWeek(bpWeek, { weekStartsOn: 1 }), "d MMM", { locale: nl })} – {format(endOfWeek(bpWeek, { weekStartsOn: 1 }), "d MMM yyyy", { locale: nl })}
          </p>
          <button onClick={() => setBpWeek(new Date())} className="text-[10px] text-primary font-medium mt-0.5">
            Vandaag
          </button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setBpWeek(addWeeks(bpWeek, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Weekly day RSVPs */}
      {bpConfig && Object.keys(bpConfig.weekly_days || {}).sort().map((dayKey) => {
        const dayConfig = bpConfig.weekly_days?.[dayKey];
        if (!dayConfig) return null;
        const weekStart = startOfWeek(bpWeek, { weekStartsOn: 1 });
        const dayDate = addDays(weekStart, (dayConfig.weekday - 1));
        const dayRsvps = bpRsvps.filter((r: any) => r.slot_type === dayKey && r.confirmed);
        const dayProfiles = profiles.filter((p: any) => dayRsvps.some((r: any) => r.user_id === p.id));

        return (
          <div key={dayKey} className="rounded-xl bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays size={14} className="text-primary" />
                  {dayConfig.label}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {format(dayDate, "EEEE d MMMM", { locale: nl })} • {dayConfig.start_time || "10:00"} – {dayConfig.end_time || "17:00"}
                </p>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <Users size={12} className="mr-1" /> {dayProfiles.length} aangemeld
              </Badge>
            </div>
            {dayProfiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nog niemand aangemeld</p>
            ) : (
              <div className="space-y-2">
                {dayProfiles.map((p: any) => {
                  const rsvp = dayRsvps.find((r: any) => r.user_id === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg bg-secondary p-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                        {(p.full_name || "?")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{p.full_name || p.email}</p>
                        {rsvp?.activity && (
                          <p className="text-[10px] text-muted-foreground capitalize">{rsvp.activity}</p>
                        )}
                      </div>
                      <Check size={14} className="text-[hsl(var(--success))]" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Workshops */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-primary" /> Maandelijkse Workshops
          </h3>
          <Button size="sm" variant="outline" onClick={() => {
            setAddingWorkshop(true);
            setEditingWorkshop(null);
            setWorkshopForm({ title: "Maandelijkse Workshop", description: "", learning_module: "", workshop_date: "", start_time: "14:00", end_time: "17:00" });
          }}>
            <Plus size={14} className="mr-1" /> Nieuw
          </Button>
        </div>

        {(addingWorkshop || editingWorkshop) && (
          <div className="space-y-3 mb-4 rounded-lg bg-secondary/50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={workshopForm.workshop_date} onChange={e => setWorkshopForm(prev => ({ ...prev, workshop_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">📚 Leermodule</Label>
                <Input value={workshopForm.learning_module} onChange={e => setWorkshopForm(prev => ({ ...prev, learning_module: e.target.value }))}
                  placeholder="Bijv. Songwriting, Mixing..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Starttijd</Label>
                <Input type="time" value={workshopForm.start_time} onChange={e => setWorkshopForm(prev => ({ ...prev, start_time: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Eindtijd</Label>
                <Input type="time" value={workshopForm.end_time} onChange={e => setWorkshopForm(prev => ({ ...prev, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setAddingWorkshop(false); setEditingWorkshop(null); }}>
                Annuleer
              </Button>
              <Button className="flex-1" onClick={saveWorkshop}>
                <Save size={14} className="mr-1" /> {editingWorkshop ? "Bijwerken" : "Toevoegen"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              ⚠️ Bij het opslaan worden automatisch alle ruimtes (Studio 1, Studio 2 & Content) geblokkeerd om dubbele boekingen te voorkomen.
            </p>
          </div>
        )}

        {bpWorkshops.length === 0 && !addingWorkshop ? (
          <p className="text-xs text-muted-foreground">Nog geen workshops gepland</p>
        ) : (
          <div className="space-y-2">
            {bpWorkshops.map((ws: any) => {
              const isPast = new Date(ws.workshop_date) < new Date(new Date().toDateString());
              const upcoming = bpWorkshops
                .filter((w: any) => new Date(w.workshop_date) >= new Date(new Date().toDateString()))
                .sort((a: any, b: any) => a.workshop_date.localeCompare(b.workshop_date));
              const isNext = !isPast && upcoming[0]?.id === ws.id;
              const workshopRsvps = bpRsvps.filter((r: any) => r.slot_type === "workshop" && r.confirmed);
              const workshopProfiles = isNext ? profiles.filter((p: any) => workshopRsvps.some((r: any) => r.user_id === p.id)) : [];

              return (
                <div key={ws.id} className={`rounded-lg p-3 ${isPast ? "bg-secondary/40 opacity-60" : isNext ? "bg-primary/5 border border-primary/20" : "bg-secondary/60"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedWorkshopId(ws.id)} className="text-xs font-semibold hover:text-primary hover:underline text-left">Maandelijkse Workshop</button>
                        {isNext && <Badge className="text-[9px] bg-primary/20 text-primary">VOLGENDE</Badge>}
                        {isPast && <span className="text-[9px] text-muted-foreground">(verlopen)</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(ws.workshop_date), "d MMMM yyyy", { locale: nl })} • {ws.start_time} – {ws.end_time}
                      </p>
                      {ws.learning_module && <p className="text-[10px] text-primary font-semibold mt-0.5">📚 {ws.learning_module}</p>}
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setEditingWorkshop(ws.id);
                        setAddingWorkshop(false);
                        setWorkshopForm({ title: "Maandelijkse Workshop", description: "", learning_module: ws.learning_module || "", workshop_date: ws.workshop_date, start_time: ws.start_time, end_time: ws.end_time });
                      }}>
                        <Edit3 size={12} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteWorkshop(ws.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                  {isNext && workshopProfiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground">{workshopProfiles.length} aangemeld:</p>
                      {workshopProfiles.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-2 rounded bg-background/50 p-1.5">
                          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                            {(p.full_name || "?")[0]}
                          </div>
                          <p className="text-[10px] font-medium truncate">{p.full_name || p.email}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Config: vaste dagen */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Settings size={14} className="text-primary" /> Vaste dagen
          </h3>
          {!editingConfig ? (
            <Button size="sm" variant="outline" onClick={() => setEditingConfig(true)}>
              <Edit3 size={12} className="mr-1" /> Bewerk
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditingConfig(false)}>Annuleer</Button>
              <Button size="sm" onClick={saveConfig}>
                <Save size={12} className="mr-1" /> Opslaan
              </Button>
            </div>
          )}
        </div>
        {editingConfig ? (
          <div className="space-y-4">
            {configDays.map((day, i) => (
              <div key={i} className="space-y-2 relative">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Dag {i + 1}</p>
                  {configDays.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                      onClick={() => setConfigDays(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Naam</Label>
                    <Input value={day.label}
                      onChange={e => setConfigDays(prev => prev.map((d, idx) => idx === i ? { ...d, label: e.target.value } : d))} />
                  </div>
                  <div>
                    <Label className="text-xs">Weekdag</Label>
                    <select value={day.weekday}
                      onChange={e => setConfigDays(prev => prev.map((d, idx) => idx === i ? { ...d, weekday: Number(e.target.value) } : d))}
                      className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm">
                      {[{ v: 1, l: "Maandag" }, { v: 2, l: "Dinsdag" }, { v: 3, l: "Woensdag" }, { v: 4, l: "Donderdag" }, { v: 5, l: "Vrijdag" }, { v: 6, l: "Zaterdag" }, { v: 7, l: "Zondag" }].map(d => (
                        <option key={d.v} value={d.v}>{d.l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Starttijd</Label>
                    <Input type="time" value={day.start_time}
                      onChange={e => setConfigDays(prev => prev.map((d, idx) => idx === i ? { ...d, start_time: e.target.value } : d))} />
                  </div>
                  <div>
                    <Label className="text-xs">Eindtijd</Label>
                    <Input type="time" value={day.end_time}
                      onChange={e => setConfigDays(prev => prev.map((d, idx) => idx === i ? { ...d, end_time: e.target.value } : d))} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setConfigDays(prev => [...prev, { label: "", weekday: 1, start_time: "10:00", end_time: "17:00" }])}>
              <Plus size={14} className="mr-1" /> Dag toevoegen
            </Button>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {Object.keys(bpConfig?.weekly_days || {}).sort().map((dk, i) => {
              const d = bpConfig?.weekly_days?.[dk];
              if (!d) return null;
              const weekdayLabels = ["", "Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
              return (
                <div key={dk} className="flex items-center gap-2 rounded-lg bg-secondary p-2.5">
                  <CalendarDays size={14} className="text-primary shrink-0" />
                  <span className="text-xs font-medium">
                    {d?.label || `Dag ${i + 1}`} ({weekdayLabels[d?.weekday || 0]}) • {d?.start_time || "10:00"} – {d?.end_time || "17:00"}
                  </span>
                </div>
              );
            })}
            {Object.keys(bpConfig?.weekly_days || {}).length === 0 && (
              <p className="text-xs text-muted-foreground">Nog geen vaste dagen ingesteld</p>
            )}
          </div>
        )}
      </div>

      {/* Auto-block fixed days */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Lock size={14} className="text-primary" /> Automatisch blokkeren
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Blokkeer alle ruimtes (Studio 1, Studio 2 & Content) op de vaste broedplaats-dagen voor de komende weken. Bestaande blokkeringen worden overgeslagen.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Aantal weken:</Label>
            <select
              value={blockWeeks}
              onChange={e => setBlockWeeks(Number(e.target.value))}
              className="rounded-md bg-secondary border border-border px-3 py-1.5 text-sm"
            >
              {[2, 4, 6, 8, 12, 16, 26, 52].map(w => (
                <option key={w} value={w}>{w} weken</option>
              ))}
            </select>
          </div>
          <Button onClick={blockFixedDays} disabled={blocking || Object.keys(bpConfig?.weekly_days || {}).length === 0}>
            {blocking ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Calendar size={14} className="mr-1" />}
            {blocking ? "Bezig..." : "Blokkeer nu"}
          </Button>
        </div>
      </div>

      {/* Ambassadeurs */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Ambassadeurs</h2>
            <Badge variant="secondary" className="text-[10px]">{ambassadors.length}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddingAmbassador(!addingAmbassador)}>
            {addingAmbassador ? <X size={14} className="mr-1" /> : <Plus size={14} className="mr-1" />}
            {addingAmbassador ? "Annuleren" : "Toevoegen"}
          </Button>
        </div>

        {addingAmbassador && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={ambassadorForm.name}
              onChange={e => setAmbassadorForm({ ...ambassadorForm, name: e.target.value })}
              placeholder="Naam *"
              className="flex-1"
            />
            <Input
              value={ambassadorForm.role}
              onChange={e => setAmbassadorForm({ ...ambassadorForm, role: e.target.value })}
              placeholder="Functie"
              className="w-full sm:w-36"
            />
            <Input
              value={ambassadorForm.phone}
              onChange={e => setAmbassadorForm({ ...ambassadorForm, phone: e.target.value })}
              placeholder="Telefoonnummer"
              className="w-full sm:w-36"
            />
            <Button size="sm" disabled={savingAmbassador} onClick={async () => {
              if (!ambassadorForm.name.trim()) { toast.error("Naam is verplicht"); return; }
              setSavingAmbassador(true);
              try {
                const { error } = await (supabase.from("org_ambassadors" as any) as any).insert({
                  name: ambassadorForm.name.trim(),
                  role: ambassadorForm.role.trim() || null,
                  phone: ambassadorForm.phone.trim() || null,
                });
                if (error) throw new Error(error.message);
                setAmbassadorForm({ name: "", role: "", phone: "" });
                setAddingAmbassador(false);
                toast.success("Ambassadeur toegevoegd");
                loadData();
              } catch (err: any) { toast.error(err.message); }
              finally { setSavingAmbassador(false); }
            }}>
              {savingAmbassador ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </Button>
          </div>
        )}

        {ambassadors.length === 0 && !addingAmbassador ? (
          <p className="text-xs text-muted-foreground">Nog geen ambassadeurs toegevoegd.</p>
        ) : (
          <div className="space-y-1">
            {ambassadors.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-secondary/30">
                <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                  <span className="font-medium text-foreground">{a.name}</span>
                  {a.role && <span className="text-xs text-muted-foreground">{a.role}</span>}
                  {a.phone && (
                    <a href={`tel:${a.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Phone size={10} />{a.phone}
                    </a>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                  if (!confirm("Ambassadeur verwijderen?")) return;
                  const { error } = await (supabase.from("org_ambassadors" as any) as any).delete().eq("id", a.id);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Verwijderd");
                  loadData();
                }}>
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info about studio blocking */}
      <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">🔒 Ruimteblokkering:</strong> Vaste broedplaats-dagen en workshops blokkeren automatisch alle ruimtes (Studio 1, Studio 2, Content Room) in het boekingssysteem om dubbele boekingen te voorkomen. Broedplaats-dagen verschijnen ook in de stichting-kalender.
        </p>
      </div>
    </div>
  );
};

export default OrgBroedplaats;
