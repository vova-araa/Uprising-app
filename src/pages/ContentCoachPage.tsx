import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Send, Loader2, Sparkles, Video, PenLine, Rocket, CalendarClock,
  ChevronLeft, Settings2, Plus, Trophy, Check, ListChecks, MessageCircle, Copy, RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { inlineToast as toast } from "@/components/InlineToast";
import { PageSkeleton } from "@/components/PageSkeleton";
import SEO from "@/components/SEO";

type Msg = { role: "user" | "assistant"; content: string };
type PlanItem = { id: string; day: string; format: string; idea: string; caption: string; hashtags: string; done: boolean };
type ContentPlan = { id: string; week_start: string; title: string; items: PlanItem[]; source: string; booking_id: string | null };

interface CreatorProfile {
  user_id: string;
  artist_name: string | null;
  genre: string | null;
  goals: string | null;
  socials: Record<string, string>;
  followers_total: number | null;
  releases: string | null;
  process_stage: string;
  reference_artists: string | null;
  release_plan: { title: string; date: string; type: string }[];
  weekly_content_goal: number | null;
  weekly_reminder: boolean;
  milestones: { text: string; achieved_at: string }[];
  brand_description: string | null;
  target_audience: string | null;
  time_budget: string | null;
  money_budget: string | null;
  camera_comfort: string | null;
  strengths: string | null;
  struggles: string | null;
  posting_platforms: string[] | null;
}

const STAGES = [
  { id: "idee", label: "Idee-fase" },
  { id: "opnemen", label: "Opnemen" },
  { id: "mixen", label: "Mixen/masteren" },
  { id: "release", label: "Release voorbereiden" },
  { id: "promo", label: "Promoten" },
];

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Spotify", "Snapchat"];

const QUICK_PROMPTS = [
  { text: "Geef me 3 post-ideeën voor mijn volgende sessie", icon: Video },
  { text: "Schrijf captions voor mijn laatste sessievideo", icon: PenLine },
  { text: "Maak een release-rollout plan voor me", icon: Rocket },
  { text: "Wat post ik deze week?", icon: CalendarClock },
];

type View = "plans" | "chat";

const ContentCoachPage = () => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("plans");
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const [checkinPlan, setCheckinPlan] = useState<ContentPlan | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    artist_name: "", genre: "", goals: "", brand_description: "", target_audience: "",
    instagram: "", tiktok: "", spotify: "", followers_total: "",
    releases: "", process_stage: "idee", reference_artists: "",
    time_budget: "", money_budget: "", camera_comfort: "", strengths: "", struggles: "",
    posting_platforms: [] as string[],
    weekly_content_goal: "3", weekly_reminder: true,
    release_title: "", release_date: "",
  });

  const loadPlans = useCallback(async () => {
    if (!user) return;
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const since = new Date(monday.getTime() - 14 * 86_400_000).toISOString().split("T")[0];
    const { data } = await supabase
      .from("content_plans")
      .select("*")
      .eq("user_id", user.id)
      .gte("week_start", since)
      .order("created_at", { ascending: false });
    setPlans((data as unknown as ContentPlan[]) || []);
  }, [user]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("creator_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      const p = data as unknown as CreatorProfile;
      setProfile(p);
      setForm((f) => ({
        ...f,
        artist_name: p.artist_name || "", genre: p.genre || "", goals: p.goals || "",
        brand_description: p.brand_description || "", target_audience: p.target_audience || "",
        instagram: p.socials?.instagram || "", tiktok: p.socials?.tiktok || "", spotify: p.socials?.spotify || "",
        followers_total: p.followers_total != null ? String(p.followers_total) : "",
        releases: p.releases || "", process_stage: p.process_stage || "idee",
        reference_artists: p.reference_artists || "",
        time_budget: p.time_budget || "", money_budget: p.money_budget || "",
        camera_comfort: p.camera_comfort || "", strengths: p.strengths || "", struggles: p.struggles || "",
        posting_platforms: p.posting_platforms || [],
        weekly_content_goal: p.weekly_content_goal != null ? String(p.weekly_content_goal) : "3",
        weekly_reminder: p.weekly_reminder,
      }));
    } else {
      setShowIntake(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProfile(); loadPlans(); }, [loadProfile, loadPlans]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const saveIntake = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const releasePlan = [...(profile?.release_plan || [])];
      if (form.release_title.trim() && form.release_date) {
        releasePlan.push({ title: form.release_title.trim(), date: form.release_date, type: "release" });
      }
      const payload = {
        user_id: user.id,
        artist_name: form.artist_name.trim() || null,
        genre: form.genre.trim() || null,
        goals: form.goals.trim() || null,
        brand_description: form.brand_description.trim() || null,
        target_audience: form.target_audience.trim() || null,
        socials: {
          ...(form.instagram.trim() ? { instagram: form.instagram.trim() } : {}),
          ...(form.tiktok.trim() ? { tiktok: form.tiktok.trim() } : {}),
          ...(form.spotify.trim() ? { spotify: form.spotify.trim() } : {}),
        },
        followers_total: form.followers_total ? parseInt(form.followers_total, 10) || null : null,
        releases: form.releases.trim() || null,
        process_stage: form.process_stage,
        reference_artists: form.reference_artists.trim() || null,
        time_budget: form.time_budget.trim() || null,
        money_budget: form.money_budget.trim() || null,
        camera_comfort: form.camera_comfort.trim() || null,
        strengths: form.strengths.trim() || null,
        struggles: form.struggles.trim() || null,
        posting_platforms: form.posting_platforms,
        release_plan: releasePlan,
        weekly_content_goal: form.weekly_content_goal ? parseInt(form.weekly_content_goal, 10) || null : null,
        weekly_reminder: form.weekly_reminder,
        intake_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("creator_profiles").upsert(payload as never);
      if (error) throw error;
      toast.success(profile ? "Profiel bijgewerkt!" : "Intake compleet — de coach kent je nu! 🚀");
      setShowIntake(false);
      await loadProfile();
    } catch (err) {
      toast.error((err as Error).message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const generateWeekPlan = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("coach-generate", {
        body: { mode: "weekly", force: true },
      });
      if (error || data?.error) throw new Error(data?.error || "Genereren mislukt");
      toast.success("Weekplan klaar! 🎯");
      await loadPlans();
    } catch (err) {
      toast.error((err as Error).message || "Genereren mislukt");
    } finally {
      setGenerating(false);
    }
  };

  const toggleItem = async (plan: ContentPlan, itemId: string) => {
    const items = plan.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, items } : p)));
    const { error } = await supabase.from("content_plans").update({ items: items as never, updated_at: new Date().toISOString() }).eq("id", plan.id);
    if (error) {
      // Revert the optimistic toggle so the UI matches the server.
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, items: plan.items } : p)));
      toast.error("Opslaan mislukt — probeer opnieuw.");
    }
  };

  const addMilestone = async () => {
    if (!user || !profile || !newMilestone.trim()) return;
    const milestones = [...(profile.milestones || []), { text: newMilestone.trim(), achieved_at: new Date().toISOString() }];
    const { error } = await supabase.from("creator_profiles")
      .update({ milestones: milestones as never, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (error) { toast.error("Toevoegen mislukt — probeer opnieuw."); return; }
    setNewMilestone(""); toast.success("Mijlpaal toegevoegd! 🏆"); loadProfile();
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const updated = [...messages, { role: "user" as const, content: text.trim() }];
    setMessages(updated);
    setInput("");
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-coach", {
        body: { messages: updated, lang },
      });
      if (error) throw error;
      setMessages((prev) => [...prev, { role: "assistant", content: data?.content || "Sorry, geen antwoord." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Er ging iets mis — probeer opnieuw." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  // ── Intake wizard ──
  if (showIntake) {
    const field = (label: string, key: keyof typeof form, placeholder: string, textarea = false) => (
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
        {textarea ? (
          <textarea value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder={placeholder} rows={2}
            className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        ) : (
          <input value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder={placeholder}
            className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        )}
      </div>
    );

    return (
      <div className="min-h-full bg-background pb-28">
        <SEO title="Content Coach — Uprising Studio" description="Jouw persoonlijke content-coach." path="/coach" />
        <div className="glass hairline-top sticky top-0 z-40 border-b border-border px-5 py-4" style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => (profile ? setShowIntake(false) : navigate(-1))} className="p-1 -ml-1"><ChevronLeft size={22} /></button>
            <h1 className="text-lg font-bold font-display">{profile ? "Profiel bewerken" : "Vertel over jezelf"}</h1>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {!profile && (
            <p className="text-sm text-muted-foreground">
              Hoe beter de coach je kent, hoe scherper het advies. Vul in wat je kwijt wil — je kunt het altijd bijwerken.
            </p>
          )}
          {field("Artiestennaam *", "artist_name", "bijv. YUNG AMFO")}
          {field("Genre *", "genre", "Hip-hop, drill, R&B, house...")}
          {field("Waar sta je voor? (jouw verhaal/merk)", "brand_description", "Waar draait jouw muziek om? Wat maakt jou anders?", true)}
          {field("Wie wil je bereiken?", "target_audience", "bijv. jongeren 16-24 die van melodische drill houden", true)}

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Waar sta je nu?</label>
            <div className="grid grid-cols-2 gap-2">
              {STAGES.map((s) => (
                <button key={s.id} onClick={() => setForm({ ...form, process_stage: s.id })}
                  className={`rounded-lg py-2.5 px-2 text-xs font-semibold transition-all ${form.process_stage === s.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {field("Doelen", "goals", "bijv. Eerste EP uitbrengen, 1000 volgers, optreden boeken", true)}

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Waar post je (het meest)?</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = form.posting_platforms.includes(p);
                return (
                  <button key={p} onClick={() => setForm({ ...form, posting_platforms: active ? form.posting_platforms.filter((x) => x !== p) : [...form.posting_platforms, p] })}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${active ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {field("Instagram", "instagram", "@handle")}
            {field("TikTok", "tiktok", "@handle")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("Spotify", "spotify", "link of naam")}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Totaal volgers (±)</label>
              <input value={form.followers_total} onChange={(e) => setForm({ ...form, followers_total: e.target.value.replace(/\D/g, "") })}
                placeholder="250" inputMode="numeric" className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm" />
            </div>
          </div>

          {field("Wat heb je al uitgebracht?", "releases", "bijv. 2 singles op Spotify, wat freestyles op TikTok", true)}
          {field("Referentie-artiesten (jouw sound)", "reference_artists", "bijv. Frenna, SFB, Travis Scott")}

          <div className="grid grid-cols-2 gap-2">
            {field("Tijd voor content/week", "time_budget", "bijv. 2 uur")}
            {field("Budget voor promo", "money_budget", "bijv. €0 / €50 p/m")}
          </div>
          {field("Hoe zit je op camera?", "camera_comfort", "bijv. verlegen, liever B-roll / juist graag in beeld")}
          {field("Waar ben je al goed in?", "strengths", "bijv. energie live, mooie visuals maken")}
          {field("Waar loop je tegenaan?", "struggles", "bijv. weet niet wat te posten, geen tijd")}

          <div className="rounded-xl bg-card border border-border p-4 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">Komende release (optioneel)</label>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.release_title} onChange={(e) => setForm({ ...form, release_title: e.target.value })}
                placeholder="Titel" className="rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm" />
              <input type="date" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })}
                className="rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4">
            <div>
              <p className="text-sm font-semibold">Wekelijks content-doel</p>
              <p className="text-[11px] text-muted-foreground">Posts per week + maandag-plan</p>
            </div>
            <div className="flex items-center gap-2">
              <input value={form.weekly_content_goal} onChange={(e) => setForm({ ...form, weekly_content_goal: e.target.value.replace(/\D/g, "") })}
                inputMode="numeric" className="w-14 rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-center" />
              <button onClick={() => setForm({ ...form, weekly_reminder: !form.weekly_reminder })}
                className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${form.weekly_reminder ? "bg-primary justify-end" : "bg-secondary justify-start"}`}>
                <span className="h-5 w-5 rounded-full bg-background" />
              </button>
            </div>
          </div>

          <button onClick={saveIntake} disabled={saving || !form.artist_name.trim() || !form.genre.trim()}
            className="w-full rounded-xl gradient-primary py-4 font-bold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {profile ? "Opslaan" : "Start met de coach"}
          </button>
        </div>
      </div>
    );
  }

  // ── Main coach ──
  return (
    <div className="min-h-full flex flex-col">
      <SEO title="Content Coach — Uprising Studio" description="Jouw persoonlijke content-coach: weekplannen, captions en releaseplannen." path="/coach" />
      <div className="px-5 pt-6 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow">
            <Megaphone size={20} className="text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold font-display">Content Coach</h1>
            <p className="text-xs text-muted-foreground truncate">
              {profile?.artist_name} • {STAGES.find((s) => s.id === profile?.process_stage)?.label}
            </p>
          </div>
          <button onClick={() => setShowMilestones(!showMilestones)} className="p-2 rounded-lg bg-card border border-border"><Trophy size={16} className="text-primary" /></button>
          <button onClick={() => setShowIntake(true)} className="p-2 rounded-lg bg-card border border-border"><Settings2 size={16} className="text-muted-foreground" /></button>
        </div>

        {showMilestones && (
          <div className="mt-3 rounded-xl bg-card border border-border p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5"><Trophy size={12} className="text-primary" /> Mijlpalen</p>
            {(profile?.milestones || []).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nog geen mijlpalen — voeg je eerste toe!</p>
            ) : (
              (profile?.milestones || []).map((m, i) => (
                <p key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Check size={11} className="text-success shrink-0" /> {m.text}</p>
              ))
            )}
            <div className="flex gap-2">
              <input value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                placeholder="bijv. Eerste single uit!" className="flex-1 rounded-lg bg-secondary border border-border px-3 py-2 text-xs" />
              <button onClick={addMilestone} disabled={!newMilestone.trim()} className="rounded-lg bg-primary/20 px-3 text-primary disabled:opacity-40"><Plus size={14} /></button>
            </div>
          </div>
        )}

        {/* View switch */}
        <div className="mt-3 flex gap-1 rounded-xl bg-secondary p-1">
          <button onClick={() => setView("plans")} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${view === "plans" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <ListChecks size={14} /> Mijn plannen
          </button>
          <button onClick={() => setView("chat")} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${view === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <MessageCircle size={14} /> Vraag de coach
          </button>
        </div>
      </div>

      {/* ── PLANS VIEW ── */}
      {view === "plans" && (
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-28 space-y-4">
          <button onClick={generateWeekPlan} disabled={generating}
            className="w-full rounded-xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98]">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {plans.some((p) => p.source === "weekly") ? "Genereer nieuw weekplan" : "Genereer mijn weekplan"}
          </button>

          {plans.length === 0 && !generating && (
            <div className="text-center py-10">
              <Sparkles size={28} className="text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nog geen plannen. Genereer je weekplan of boek een sessie — dan zet de coach automatisch een shot list klaar.
              </p>
            </div>
          )}

          {plans.map((plan) => {
            const doneCount = plan.items.filter((it) => it.done).length;
            return (
              <div key={plan.id} className="rounded-2xl card-premium border border-border overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-bold font-display truncate flex items-center gap-1.5">
                      {plan.source === "session" && <Video size={13} className="text-primary shrink-0" />}
                      {plan.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {plan.source === "session" ? "Sessieplan" : "Weekplan"} • {doneCount}/{plan.items.length} klaar
                    </p>
                  </div>
                  <button onClick={() => setCheckinPlan(plan)} className="shrink-0 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
                    Check-in
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {plan.items.map((it) => (
                    <div key={it.id} className="p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleItem(plan, it.id)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${it.done ? "bg-success text-success-foreground" : "border-2 border-muted-foreground/30"}`}>
                          {it.done && <Check size={13} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{it.day}</span>
                            <span className="text-[10px] font-semibold text-muted-foreground">{it.format}</span>
                          </div>
                          <p className={`text-sm ${it.done ? "line-through text-muted-foreground" : ""}`}>{it.idea}</p>
                        </div>
                      </div>
                      {it.caption && (
                        <div className="ml-8 rounded-lg bg-secondary/50 border border-border p-2.5">
                          <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{it.caption}</p>
                          {it.hashtags && <p className="text-[11px] text-primary mt-1">{it.hashtags}</p>}
                          <button onClick={() => { navigator.clipboard.writeText(`${it.caption}\n\n${it.hashtags}`); toast.success("Caption gekopieerd"); }}
                            className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                            <Copy size={11} /> Kopieer caption
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CHAT VIEW ── */}
      {view === "chat" && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 pb-40 space-y-4">
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="text-center py-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow mx-auto mb-3">
                    <Sparkles size={24} className="text-primary-foreground" />
                  </div>
                  <h2 className="text-base font-bold font-display">Vraag me alles, {profile?.artist_name}</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button key={q.text} onClick={() => sendMessage(q.text)}
                      className="flex items-center gap-2 rounded-xl bg-card border border-border p-3 text-left text-xs font-medium transition-all hover:border-primary/40 active:scale-[0.98]">
                      <q.icon size={14} className="text-primary shrink-0" />{q.text}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "gradient-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"}`}>
                    {msg.role === "assistant" ? <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-card border border-border px-4 py-3 rounded-bl-md">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Coach denkt na...</div>
                </div>
              </div>
            )}
          </div>
          <div className="fixed left-0 right-0 z-40 pb-3 bg-gradient-to-t from-background via-background to-transparent pt-6"
            style={{ bottom: "var(--bottom-nav-total-offset)", paddingLeft: "calc(var(--safe-area-left) + 1rem)", paddingRight: "calc(var(--safe-area-right) + 1rem)" }}>
            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder="Vraag de coach iets..." disabled={isLoading}
                className="flex-1 rounded-xl bg-card border border-border px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-50" />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
                className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow active:scale-[0.95] disabled:opacity-50">
                <Send size={18} className="text-primary-foreground" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Check-in sheet */}
      {checkinPlan && <CheckinSheet plan={checkinPlan} onClose={() => setCheckinPlan(null)} onDone={() => { setCheckinPlan(null); toast.success("Bedankt! De coach leert hiervan 🙌"); }} />}
    </div>
  );
};

const CheckinSheet = ({ plan, onClose, onDone }: { plan: ContentPlan; onClose: () => void; onDone: () => void }) => {
  const { user } = useAuth();
  const [posted, setPosted] = useState<boolean | null>(null);
  const [reflection, setReflection] = useState("");
  const [reach, setReach] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("coach_checkins").insert({
      user_id: user.id, content_plan_id: plan.id, posted,
      reflection: reflection.trim() || null, reach_note: reach.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Opslaan mislukt — probeer opnieuw.");
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="animate-slide-up rounded-2xl card-premium border border-border p-5 max-w-sm w-full space-y-4 mb-4 sm:mb-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <RefreshCw size={17} className="text-primary" />
          <h3 className="font-display font-semibold text-base">Check-in</h3>
        </div>
        <p className="text-xs text-muted-foreground">Hoe ging het met "{plan.title}"? De coach past je volgende plan hierop aan.</p>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Heb je gepost?</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPosted(true)} className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${posted === true ? "bg-success text-success-foreground" : "bg-secondary text-muted-foreground"}`}>Ja ✅</button>
            <button onClick={() => setPosted(false)} className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${posted === false ? "bg-warning text-warning-foreground" : "bg-secondary text-muted-foreground"}`}>Nog niet</button>
          </div>
        </div>
        <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={2} placeholder="Wat ging goed / minder goed?"
          className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        <input value={reach} onChange={(e) => setReach(e.target.value)} placeholder="Bereik? (bijv. 1.2k views, 40 likes)"
          className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">Sluit</button>
          <button onClick={submit} disabled={saving} className="flex-1 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Opslaan
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentCoachPage;
