import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inlineToast as toast } from "@/components/InlineToast";
import { Loader2, Search, UserCheck, UserPlus, Save, X, ChevronRight, Megaphone } from "lucide-react";

// The team runs the coach intake so Uprising knows each member's process from
// day one. This tab lists members and lets staff fill/edit their creator
// profile (admin RLS on creator_profiles allows the write).

interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
  membership: string | null;
}

interface Intake {
  user_id: string;
  artist_name: string | null;
  genre: string | null;
  goals: string | null;
  brand_description: string | null;
  target_audience: string | null;
  process_stage: string;
  releases: string | null;
  reference_artists: string | null;
  time_budget: string | null;
  money_budget: string | null;
  camera_comfort: string | null;
  strengths: string | null;
  struggles: string | null;
  followers_total: number | null;
  weekly_content_goal: number | null;
  socials: Record<string, string>;
  coach_notes: string | null;
  intake_completed_at: string | null;
}

const STAGES = [
  { id: "idee", label: "Idee" },
  { id: "opnemen", label: "Opnemen" },
  { id: "mixen", label: "Mixen" },
  { id: "release", label: "Release" },
  { id: "promo", label: "Promo" },
];

const emptyForm = {
  artist_name: "", genre: "", goals: "", brand_description: "", target_audience: "",
  process_stage: "idee", releases: "", reference_artists: "",
  time_budget: "", money_budget: "", camera_comfort: "", strengths: "", struggles: "",
  instagram: "", tiktok: "", spotify: "", followers_total: "", weekly_content_goal: "3", coach_notes: "",
};

const AdminIntakesTab = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [intakes, setIntakes] = useState<Map<string, Intake>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [membersRes, intakesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, membership").order("full_name"),
      supabase.from("creator_profiles").select("*"),
    ]);
    const mems = ((membersRes.data as any[]) || []).filter((m) => m.membership || true) as Member[];
    setMembers(mems);
    setIntakes(new Map(((intakesRes.data as any[]) || []).map((i) => [i.user_id, i as Intake])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEditor = (member: Member) => {
    const existing = intakes.get(member.id);
    setForm(existing ? {
      artist_name: existing.artist_name || "", genre: existing.genre || "", goals: existing.goals || "",
      brand_description: existing.brand_description || "", target_audience: existing.target_audience || "",
      process_stage: existing.process_stage || "idee", releases: existing.releases || "",
      reference_artists: existing.reference_artists || "", time_budget: existing.time_budget || "",
      money_budget: existing.money_budget || "", camera_comfort: existing.camera_comfort || "",
      strengths: existing.strengths || "", struggles: existing.struggles || "",
      instagram: existing.socials?.instagram || "", tiktok: existing.socials?.tiktok || "", spotify: existing.socials?.spotify || "",
      followers_total: existing.followers_total != null ? String(existing.followers_total) : "",
      weekly_content_goal: existing.weekly_content_goal != null ? String(existing.weekly_content_goal) : "3",
      coach_notes: existing.coach_notes || "",
    } : { ...emptyForm, artist_name: member.full_name || "" });
    setEditing(member);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        user_id: editing.id,
        artist_name: form.artist_name.trim() || null,
        genre: form.genre.trim() || null,
        goals: form.goals.trim() || null,
        brand_description: form.brand_description.trim() || null,
        target_audience: form.target_audience.trim() || null,
        process_stage: form.process_stage,
        releases: form.releases.trim() || null,
        reference_artists: form.reference_artists.trim() || null,
        time_budget: form.time_budget.trim() || null,
        money_budget: form.money_budget.trim() || null,
        camera_comfort: form.camera_comfort.trim() || null,
        strengths: form.strengths.trim() || null,
        struggles: form.struggles.trim() || null,
        socials: {
          ...(form.instagram.trim() ? { instagram: form.instagram.trim() } : {}),
          ...(form.tiktok.trim() ? { tiktok: form.tiktok.trim() } : {}),
          ...(form.spotify.trim() ? { spotify: form.spotify.trim() } : {}),
        },
        followers_total: form.followers_total ? parseInt(form.followers_total, 10) || null : null,
        weekly_content_goal: form.weekly_content_goal ? parseInt(form.weekly_content_goal, 10) || null : null,
        coach_notes: form.coach_notes.trim() || null,
        intake_by: "team",
        intake_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("creator_profiles").upsert(payload as never);
      if (error) throw error;
      // Let the member know their coach is ready
      await supabase.from("notifications").insert({
        user_id: editing.id,
        title: "Je Content Coach staat klaar 🎯",
        message: "We hebben je intake ingevuld. Open de Content Coach voor je weekplan en persoonlijke tips.",
        type: "success",
        link: "/coach",
      });
      toast.success("Intake opgeslagen");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? members.filter((m) => (m.full_name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q))
      : members;
    // Members without a completed intake first
    return [...list].sort((a, b) => {
      const ai = intakes.get(a.id)?.intake_completed_at ? 1 : 0;
      const bi = intakes.get(b.id)?.intake_completed_at ? 1 : 0;
      return ai - bi;
    });
  }, [members, intakes, search]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  // ── Editor ──
  if (editing) {
    const field = (label: string, key: keyof typeof form, placeholder = "", textarea = false) => (
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
        {textarea ? (
          <textarea value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} rows={2}
            className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm resize-none" />
        ) : (
          <input value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder}
            className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm" />
        )}
      </div>
    );
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-display">Intake — {editing.full_name || editing.email}</h3>
            <p className="text-[11px] text-muted-foreground">Vul in wat je van de artiest weet; de coach bouwt hierop.</p>
          </div>
          <button onClick={() => setEditing(null)} className="p-2 rounded-lg bg-secondary"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {field("Artiestennaam", "artist_name")}
          {field("Genre", "genre")}
        </div>
        {field("Merk/verhaal", "brand_description", "Waar draait hun muziek om?", true)}
        {field("Doelgroep", "target_audience", "Wie willen ze bereiken?", true)}
        {field("Doelen", "goals", "", true)}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Fase</label>
          <div className="grid grid-cols-5 gap-1">
            {STAGES.map((s) => (
              <button key={s.id} onClick={() => setForm({ ...form, process_stage: s.id })}
                className={`rounded-lg py-2 text-[11px] font-semibold ${form.process_stage === s.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {field("Instagram", "instagram", "@handle")}
          {field("TikTok", "tiktok", "@handle")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {field("Spotify", "spotify")}
          {field("Volgers (±)", "followers_total", "250")}
        </div>
        {field("Releases tot nu toe", "releases", "", true)}
        {field("Referentie-artiesten", "reference_artists")}
        <div className="grid grid-cols-2 gap-2">
          {field("Tijd/week", "time_budget", "2 uur")}
          {field("Budget promo", "money_budget", "€0")}
        </div>
        {field("Comfort op camera", "camera_comfort")}
        <div className="grid grid-cols-2 gap-2">
          {field("Sterke kanten", "strengths")}
          {field("Worstelt met", "struggles")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {field("Content-doel/week", "weekly_content_goal", "3")}
        </div>
        {field("Interne notities (privé)", "coach_notes", "Alleen zichtbaar voor het team", true)}

        <button onClick={save} disabled={saving}
          className="w-full rounded-xl gradient-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Intake opslaan
        </button>
      </div>
    );
  }

  // ── List ──
  const doneCount = members.filter((m) => intakes.get(m.id)?.intake_completed_at).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-display flex items-center gap-2"><Megaphone size={17} className="text-primary" /> Coach-intakes</h3>
        <span className="text-[11px] text-muted-foreground">{doneCount}/{members.length} ingevuld</span>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek lid..."
          className="w-full rounded-lg bg-card border border-border pl-9 pr-3 py-2.5 text-sm" />
      </div>
      <div className="space-y-1.5">
        {filtered.map((m) => {
          const intake = intakes.get(m.id);
          const done = !!intake?.intake_completed_at;
          return (
            <button key={m.id} onClick={() => openEditor(m)}
              className="w-full flex items-center gap-3 rounded-lg bg-card border border-border p-3 text-left hover:border-primary/40 transition-colors">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${done ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                {done ? <UserCheck size={16} /> : <UserPlus size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{intake?.artist_name || m.full_name || "Onbekend"}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {done ? `${intake?.genre || "geen genre"} • ${STAGES.find((s) => s.id === intake?.process_stage)?.label || ""}` : "Intake nog niet ingevuld"}
                </p>
              </div>
              <ChevronRight size={15} className="text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminIntakesTab;
