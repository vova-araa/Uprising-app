import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Plus, Loader2, Edit3, Trash2, Save, X, User, Mail, Phone, ExternalLink, School, Route, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inlineToast as toast } from "@/components/InlineToast";
import AddressInput from "@/components/AddressInput";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ConfirmDialog";

const emptyForm = { name: "", address: "", contact_person: "", contact_phone: "", contact_email: "" };

const OrgLocations = () => {
  const confirm = useConfirm();
  const [locations, setLocations] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [trajecten, setTrajecten] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [locRes, schoolRes, trajRes] = await Promise.all([
        supabase.from("org_locations" as any).select("*").order("name"),
        supabase.from("org_schools" as any).select("id, name, location_id, address, contact_person, contact_phone, contact_email"),
        supabase.from("org_trajecten" as any).select("id, title, location_id, school_id"),
      ]);
      if (locRes.error) throw locRes.error;
      const locs = (locRes.data as any[]) || [];
      const schs = (schoolRes.data as any[]) || [];
      const trajs = (trajRes.data as any[]) || [];

      // Auto-create locations for schools that have an address but no location_id
      const unlinkedSchools = schs.filter(s => s.address && !s.location_id);
      for (const s of unlinkedSchools) {
        const existing = locs.find(l => l.address === s.address);
        if (existing) {
          await (supabase.from("org_schools" as any) as any).update({ location_id: existing.id }).eq("id", s.id);
          s.location_id = existing.id;
        } else {
          const { data: newLoc } = await (supabase.from("org_locations" as any) as any).insert({
            name: `${s.name}`,
            address: s.address,
            contact_person: s.contact_person || null,
            contact_phone: s.contact_phone || null,
            contact_email: s.contact_email || null,
          }).select("id").single();
          if (newLoc) {
            await (supabase.from("org_schools" as any) as any).update({ location_id: newLoc.id }).eq("id", s.id);
            s.location_id = newLoc.id;
            locs.push({ id: newLoc.id, name: s.name, address: s.address, contact_person: s.contact_person, contact_phone: s.contact_phone, contact_email: s.contact_email, is_active: true });
          }
        }
      }

      setLocations(locs);
      setSchools(schs);
      setTrajecten(trajs);
    } catch (err: any) {
      toast.error(`Laden mislukt: ${err.message || "Onbekende fout"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Naam is verplicht"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address || null,
        contact_person: form.contact_person || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await (supabase.from("org_locations" as any) as any).update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
        toast.success("Locatie bijgewerkt");
      } else {
        const { error } = await (supabase.from("org_locations" as any) as any).insert(payload);
        if (error) throw new Error(error.message);
        toast.success("Locatie toegevoegd");
      }
      setAdding(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message || "onbekende fout"}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Locatie verwijderen?", destructive: true }))) return;
    const { error } = await (supabase.from("org_locations" as any) as any).delete().eq("id", id);
    if (error) { toast.error(`Verwijderen mislukt: ${error.message}`); return; }
    toast.success("Verwijderd");
    load();
  };

  const startEdit = (l: any) => {
    setEditingId(l.id);
    setAdding(false);
    setForm({
      name: l.name || "", address: l.address || "",
      contact_person: l.contact_person || "", contact_phone: l.contact_phone || "",
      contact_email: l.contact_email || "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Locatiebeheer</h1>
          <p className="text-sm text-muted-foreground">Locaties toevoegen en beheren</p>
        </div>
        <Button size="sm" onClick={() => { setAdding(true); setEditingId(null); setForm(emptyForm); }}>
          <Plus size={16} className="mr-1" /> Toevoegen
        </Button>
      </div>

      {(adding || editingId) && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div>
            <Label>Locatienaam *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Naam van de locatie..." />
          </div>
          <AddressInput
            value={form.address}
            onChange={val => setForm({ ...form, address: val })}
            label="Adres"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Contactpersoon</Label>
              <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Naam" />
            </div>
            <div>
              <Label>Telefoon</Label>
              <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="+31..." />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="email@locatie.nl" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
              Opslaan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setEditingId(null); }}>
              <X size={14} className="mr-1" /> Annuleren
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : locations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nog geen locaties</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map(l => (
            <div key={l.id} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                   <div className="font-medium text-foreground flex items-center gap-2">
                     <MapPin size={14} className="text-primary" />
                     {l.name}
                     {!l.is_active && <span className="text-xs text-muted-foreground">(inactief)</span>}
                   </div>
                   {/* Used-by badges */}
                   {(() => {
                     const linkedSchools = schools.filter(s => s.location_id === l.id);
                     const linkedTrajecten = trajecten.filter(t => t.location_id === l.id);
                     const hasTags = linkedSchools.length > 0 || linkedTrajecten.length > 0;
                     if (!hasTags) return null;
                     return (
                       <div className="flex flex-wrap gap-1 ml-[22px]">
                         {linkedSchools.map(s => (
                           <Badge key={s.id} variant="secondary" className="text-[10px] gap-1 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20">
                             <School size={10} /> Workshop — {s.name}
                           </Badge>
                         ))}
                          {linkedTrajecten.map(t => (
                            <Badge key={t.id} variant="secondary" className="text-[10px] gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                              <Route size={10} /> Traject — {t.title}
                            </Badge>
                          ))}
                       </div>
                     );
                   })()}
                   <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ml-[22px]">
                     {l.address && (
                       <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}`, "_blank")} className="flex items-center gap-1 text-primary hover:underline">
                         <MapPin size={11} />{l.address}<ExternalLink size={9} className="opacity-60" />
                       </button>
                     )}
                     {l.contact_person && <span className="flex items-center gap-1"><User size={11} />{l.contact_person}</span>}
                     {l.contact_phone && (
                       <a href={`tel:${l.contact_phone}`} className="flex items-center gap-1 text-primary hover:underline">
                         <Phone size={11} />{l.contact_phone}
                       </a>
                     )}
                     {l.contact_email && (
                       <a href={`mailto:${l.contact_email}`} className="flex items-center gap-1 text-primary hover:underline">
                         <Mail size={11} />{l.contact_email}
                       </a>
                     )}
                   </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(l)}>
                    <Edit3 size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(l.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrgLocations;
