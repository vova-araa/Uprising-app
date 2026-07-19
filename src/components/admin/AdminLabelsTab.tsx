import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inlineToast as toast } from "@/components/InlineToast";
import {
  Building2, Plus, Loader2, ChevronLeft, Users, Clock, FileText, Send, Check,
  Mic, X, Download, BadgeEuro,
} from "lucide-react";

// Uprising staff manage label accounts: create them, assign a manager account,
// add artists, top up hours manually, and invoice new terms (PDF + email).

interface Label {
  id: string; name: string; contact_name: string | null; contact_email: string | null;
  billing_address: string | null; vat_number: string | null; manager_user_id: string | null;
  hours_balance: number; default_rate: number; active: boolean;
}
interface Artist { id: string; name: string; }
interface Invoice { id: string; invoice_number: string; hours: number; total: number; status: string; term: string | null; created_at: string; pdf_path: string | null; }
interface Profile { id: string; full_name: string | null; email: string | null; }

const AdminLabelsTab = () => {
  const [labels, setLabels] = useState<Label[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Label | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const [labelsRes, profilesRes] = await Promise.all([
      supabase.from("labels").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]);
    setLabels((labelsRes.data as Label[]) || []);
    setProfiles((profilesRes.data as Profile[]) || []);
    if (selected) setSelected(((labelsRes.data as Label[]) || []).find((l) => l.id === selected.id) || null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  if (selected) return <LabelDetail label={selected} profiles={profiles} onBack={() => setSelected(null)} onChanged={load} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-display flex items-center gap-2"><Building2 size={17} className="text-primary" /> Labels</h3>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary flex items-center gap-1"><Plus size={13} /> Nieuw label</button>
      </div>
      {labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen labels. Maak er een aan voor je zakelijke klanten.</p>
      ) : (
        <div className="space-y-1.5">
          {labels.map((l) => (
            <button key={l.id} onClick={() => setSelected(l)} className="w-full flex items-center gap-3 rounded-lg bg-card border border-border p-3 text-left hover:border-primary/40">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 shrink-0"><Building2 size={15} className="text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{l.name}</p>
                <p className="text-[11px] text-muted-foreground">{l.hours_balance} uur in de pot • €{l.default_rate}/u</p>
              </div>
              {!l.manager_user_id && <span className="text-[10px] text-warning">geen manager</span>}
            </button>
          ))}
        </div>
      )}
      {showCreate && <CreateLabel onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
};

const CreateLabel = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rate, setRate] = useState("45");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("labels").insert({ name: name.trim(), contact_email: email.trim() || null, default_rate: Number(rate) || 45 });
    setSaving(false);
    if (error) toast.error("Aanmaken mislukt"); else { toast.success("Label aangemaakt"); onCreated(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-6" onClick={onClose}>
      <div className="animate-fade-in rounded-2xl card-premium border border-border p-5 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-semibold">Nieuw label</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Labelnaam" className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Factuur-e-mail" className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tarief €/u</span>
          <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="w-20 rounded-lg bg-secondary border border-border px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium">Terug</button>
          <button onClick={save} disabled={saving || !name.trim()} className="flex-1 rounded-xl gradient-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Aanmaken</button>
        </div>
      </div>
    </div>
  );
};

const LabelDetail = ({ label, profiles, onBack, onChanged }: { label: Label; profiles: Profile[]; onBack: () => void; onChanged: () => void }) => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [managers, setManagers] = useState<{ id: string; user_id: string }[]>([]);
  const [newArtist, setNewArtist] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [artistsRes, invoicesRes, managersRes] = await Promise.all([
      supabase.from("label_artists").select("id, name").eq("label_id", label.id).eq("active", true).order("name"),
      supabase.from("label_invoices").select("id, invoice_number, hours, total, status, term, created_at, pdf_path").eq("label_id", label.id).order("created_at", { ascending: false }),
      supabase.from("label_managers").select("id, user_id").eq("label_id", label.id),
    ]);
    setArtists((artistsRes.data as Artist[]) || []);
    setInvoices((invoicesRes.data as Invoice[]) || []);
    setManagers((managersRes.data as { id: string; user_id: string }[]) || []);
  };
  useEffect(() => { load(); }, [label.id]);

  const addManager = async (userId: string) => {
    const { error } = await supabase.from("label_managers").insert({ label_id: label.id, user_id: userId });
    if (error && !String(error.message).includes("duplicate")) { toast.error("Koppelen mislukt"); return; }
    // Keep the first-added manager as the primary for legacy compatibility
    if (managers.length === 0) await supabase.from("labels").update({ manager_user_id: userId }).eq("id", label.id);
    toast.success("Manager gekoppeld");
    setManagerSearch("");
    load(); onChanged();
  };

  const removeManager = async (row: { id: string; user_id: string }) => {
    await supabase.from("label_managers").delete().eq("id", row.id);
    if (label.manager_user_id === row.user_id) {
      const next = managers.find((m) => m.user_id !== row.user_id);
      await supabase.from("labels").update({ manager_user_id: next?.user_id || null }).eq("id", label.id);
    }
    toast.success("Manager losgekoppeld");
    load(); onChanged();
  };

  const addArtist = async () => {
    if (!newArtist.trim()) return;
    await supabase.from("label_artists").insert({ label_id: label.id, name: newArtist.trim() });
    setNewArtist(""); load();
  };

  const invoiceAction = async (action: string, invoice_id: string) => {
    setBusy(invoice_id + action);
    const { data, error } = await supabase.functions.invoke("label-invoice", { body: { action, invoice_id } });
    setBusy(null);
    if (error || data?.error) { toast.error(data?.error || "Mislukt"); return; }
    if (action === "get_pdf" && data?.url) window.open(data.url, "_blank");
    else if (action === "send") toast.success(`Verstuurd naar ${data.sent_to}`);
    else if (action === "mark_paid") { toast.success(`Betaald — pot nu ${data.hours_balance} uur`); onChanged(); }
    load();
  };

  const profileName = (id: string) => { const p = profiles.find((x) => x.id === id); return p?.full_name || p?.email || "Onbekend"; };
  const managerIds = new Set(managers.map((m) => m.user_id));
  const managerMatches = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    if (!q) return [];
    return profiles.filter((p) => !managerIds.has(p.id) && ((p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q))).slice(0, 5);
  }, [managerSearch, profiles, managers]);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground"><ChevronLeft size={14} /> Terug</button>
      <div>
        <h3 className="text-lg font-bold font-display">{label.name}</h3>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock size={13} className="text-primary" /> {label.hours_balance} uur in de pot • €{label.default_rate}/u</p>
      </div>

      {/* Managers (multiple) */}
      <div className="rounded-xl bg-card border border-border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Label-managers (boeken namens artiesten)</p>
        {managers.length === 0 && <p className="text-xs text-warning">Nog geen manager gekoppeld.</p>}
        {managers.map((m) => (
          <div key={m.id} className="flex items-center justify-between">
            <span className="text-sm">{profileName(m.user_id)}{label.manager_user_id === m.user_id && <span className="ml-1.5 text-[10px] text-primary">primair</span>}</span>
            <button onClick={() => removeManager(m)} className="text-xs text-destructive">Loskoppelen</button>
          </div>
        ))}
        <div className="relative pt-1">
          <input value={managerSearch} onChange={(e) => setManagerSearch(e.target.value)} placeholder="Manager toevoegen — zoek gebruiker..." className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm" />
          {managerMatches.length > 0 && (
            <div className="mt-1 rounded-lg bg-secondary border border-border overflow-hidden">
              {managerMatches.map((p) => (
                <button key={p.id} onClick={() => addManager(p.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10">{p.full_name || p.email}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual top-up */}
      <TopUp labelId={label.id} onDone={onChanged} />

      {/* Artists */}
      <div className="rounded-xl bg-card border border-border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Users size={13} /> Artiesten ({artists.length})</p>
        {artists.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm"><Mic size={13} className="text-primary" /> {a.name}</div>
        ))}
        <div className="flex gap-2 pt-1">
          <input value={newArtist} onChange={(e) => setNewArtist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addArtist()} placeholder="Nieuwe artiest" className="flex-1 rounded-lg bg-secondary border border-border px-3 py-2 text-sm" />
          <button onClick={addArtist} disabled={!newArtist.trim()} className="rounded-lg bg-primary/20 px-3 text-primary disabled:opacity-40"><Plus size={14} /></button>
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-xl bg-card border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><FileText size={13} /> Facturen</p>
          <button onClick={() => setShowInvoice(true)} className="text-xs font-semibold text-primary flex items-center gap-1"><BadgeEuro size={13} /> Nieuwe factuur</button>
        </div>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nog geen facturen.</p>
        ) : invoices.map((inv) => (
          <div key={inv.id} className="rounded-lg bg-secondary/40 border border-border p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{inv.invoice_number}</p>
                <p className="text-[11px] text-muted-foreground">{inv.hours}u • €{Number(inv.total).toFixed(2)} • <span className={inv.status === "paid" ? "text-success" : inv.status === "sent" ? "text-primary" : "text-muted-foreground"}>{inv.status}</span></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {inv.pdf_path && <button onClick={() => invoiceAction("get_pdf", inv.id)} disabled={busy === inv.id + "get_pdf"} className="rounded-md bg-secondary px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1"><Download size={12} /> PDF</button>}
              {inv.status !== "paid" && <button onClick={() => invoiceAction("send", inv.id)} disabled={busy === inv.id + "send"} className="rounded-md bg-primary/20 text-primary px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1">{busy === inv.id + "send" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Mail label</button>}
              {inv.status !== "paid" && <button onClick={() => invoiceAction("mark_paid", inv.id)} disabled={busy === inv.id + "mark_paid"} className="rounded-md bg-success/20 text-success px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1">{busy === inv.id + "mark_paid" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Betaald → pot +{inv.hours}u</button>}
            </div>
          </div>
        ))}
      </div>

      {showInvoice && <NewInvoice label={label} onClose={() => setShowInvoice(false)} onCreated={() => { setShowInvoice(false); load(); }} />}
    </div>
  );
};

const TopUp = ({ labelId, onDone }: { labelId: string; onDone: () => void }) => {
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    const h = Number(hours);
    if (!h) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("label-invoice", {
      body: { action: "adjust_hours", label_id: labelId, hours: h },
    });
    setBusy(false);
    if (error || data?.error) toast.error(data?.error || "Aanpassen mislukt");
    else { toast.success(`Pot aangepast — nu ${data.hours_balance} uur`); setHours(""); onDone(); }
  };
  return (
    <div className="rounded-xl bg-card border border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">Handmatige uren-correctie</p>
      <div className="flex gap-2">
        <input value={hours} onChange={(e) => setHours(e.target.value.replace(/[^-\d]/g, ""))} inputMode="numeric" placeholder="+/- uren" className="flex-1 rounded-lg bg-secondary border border-border px-3 py-2 text-sm" />
        <button onClick={apply} disabled={busy || !hours} className="rounded-lg bg-primary/20 px-4 text-primary text-sm font-semibold disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : "Toepassen"}</button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">Voor een reguliere termijn: gebruik een factuur en markeer 'Betaald' — dan wordt de pot netjes opgehoogd.</p>
    </div>
  );
};

const NewInvoice = ({ label, onClose, onCreated }: { label: Label; onClose: () => void; onCreated: () => void }) => {
  const [hours, setHours] = useState("40");
  const [rate, setRate] = useState(String(label.default_rate));
  const [term, setTerm] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [saving, setSaving] = useState(false);

  const subtotal = (Number(hours) || 0) * (Number(rate) || 0);
  const total = subtotal * 1.21;

  const create = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("label-invoice", { body: { action: "create", label_id: label.id, hours: Number(hours), rate: Number(rate), term: term.trim() || null } });
    if (error || data?.error) { setSaving(false); toast.error(data?.error || "Aanmaken mislukt"); return; }
    if (sendNow && data?.invoice?.id) {
      await supabase.functions.invoke("label-invoice", { body: { action: "send", invoice_id: data.invoice.id } });
      toast.success("Factuur aangemaakt en gemaild");
    } else {
      toast.success("Factuur aangemaakt");
    }
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-6" onClick={onClose}>
      <div className="animate-fade-in rounded-2xl card-premium border border-border p-5 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold">Nieuwe factuur — {label.name}</h3>
          <button onClick={onClose} aria-label="Sluiten" className="p-1"><X size={17} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Uren</label>
            <input value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tarief €/u</label>
            <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Termijn / omschrijving</label>
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="bijv. Q1 2026" className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm" />
        </div>
        <div className="rounded-lg bg-secondary/50 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotaal</span><span>€{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">BTW 21%</span><span>€{(total - subtotal).toFixed(2)}</span></div>
          <div className="flex justify-between font-bold"><span>Totaal</span><span className="text-primary">€{total.toFixed(2)}</span></div>
        </div>
        <button onClick={() => setSendNow(!sendNow)} className="flex items-center gap-2 text-xs">
          <div className={`flex h-5 w-5 items-center justify-center rounded ${sendNow ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"}`}>{sendNow && <Check size={13} />}</div>
          Direct mailen naar {label.contact_email || "label"}
        </button>
        <button onClick={create} disabled={saving || !hours} className="w-full rounded-xl gradient-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Factuur aanmaken (PDF)
        </button>
      </div>
    </div>
  );
};

export default AdminLabelsTab;
