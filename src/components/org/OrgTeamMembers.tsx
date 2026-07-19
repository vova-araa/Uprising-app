import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Loader2, Edit3, Trash2, Save, X, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inlineToast as toast } from "@/components/InlineToast";
import { useConfirm } from "@/components/ConfirmDialog";

const emptyForm = { name: "", email: "", role: "member", phone: "", city: "" };

const OrgTeamMembers = () => {
  const confirm = useConfirm();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("org_team_members" as any).select("*").order("name");
      if (error) throw error;
      setMembers((data as any[]) || []);
    } catch (err: any) {
      toast.error(`Laden mislukt: ${err.message || "Onbekende fout"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Naam is verplicht"); return; }
    if (form.name.trim().length > 100) { toast.error("Naam mag maximaal 100 tekens zijn"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Ongeldig e-mailadres"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email || null,
        role: form.role || "member",
        phone: form.phone || null,
        city: form.city || null,
      };
      if (editingId) {
        const { error } = await (supabase.from("org_team_members" as any) as any).update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
        toast.success("Teamlid bijgewerkt");
      } else {
        const { error } = await (supabase.from("org_team_members" as any) as any).insert(payload);
        if (error) throw new Error(error.message);
        toast.success("Teamlid toegevoegd");
      }
      setAdding(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message || "onbekende fout"}`);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Teamlid verwijderen?", destructive: true }))) return;
    const { error } = await (supabase.from("org_team_members" as any) as any).delete().eq("id", id);
    if (error) { toast.error(`Verwijderen mislukt: ${error.message}`); return; }
    toast.success("Verwijderd");
    load();
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setAdding(false);
    setForm({ name: m.name || "", email: m.email || "", role: m.role || "member", phone: m.phone || "", city: m.city || "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Teambeheer</h1>
          <p className="text-sm text-muted-foreground">Teamleden toevoegen en beheren</p>
        </div>
        <Button size="sm" onClick={() => { setAdding(true); setEditingId(null); setForm(emptyForm); }}>
          <Plus size={16} className="mr-1" /> Toevoegen
        </Button>
      </div>

      {(adding || editingId) && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div>
            <Label>Naam *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Volledige naam" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@voorbeeld.nl" />
            </div>
            <div>
              <Label>Telefoon</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+31..." />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Stad</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Woonplaats" />
            </div>
            <div>
              <Label>Rol</Label>
              <Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="bijv. trainer, coördinator" />
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
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p>Nog geen teamleden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <Users size={14} className="text-primary shrink-0" />
                    {m.name}
                    {m.role && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m.role}</span>}
                    {!m.is_active && <span className="text-xs text-muted-foreground">(inactief)</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ml-[22px]">
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Mail size={11} />{m.email}
                      </a>
                    )}
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Phone size={11} />{m.phone}
                      </a>
                    )}
                    {m.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />{m.city}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(m)}>
                    <Edit3 size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(m.id)}>
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

export default OrgTeamMembers;
