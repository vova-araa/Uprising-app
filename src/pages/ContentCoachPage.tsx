import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Send, Loader2, Sparkles, Video, PenLine, Rocket, CalendarClock,
  ChevronLeft, Settings2, Plus, X, Trophy, Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { inlineToast as toast } from "@/components/InlineToast";
import PageLoader from "@/components/PageLoader";
import SEO from "@/components/SEO";

type Msg = { role: "user" | "assistant"; content: string };

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
}

const STAGES = [
  { id: "idee", label: "Idee-fase" },
  { id: "opnemen", label: "Opnemen" },
  { id: "mixen", label: "Mixen/masteren" },
  { id: "release", label: "Release voorbereiden" },
  { id: "promo", label: "Promoten" },
];

const QUICK_PROMPTS = [
  { text: "Geef me 3 post-ideeën voor mijn volgende sessie", icon: Video },
  { text: "Schrijf captions voor mijn laatste sessievideo", icon: PenLine },
  { text: "Maak een release-rollout plan voor me", icon: Rocket },
  { text: "Wat post ik deze week?", icon: CalendarClock },
];

const ContentCoachPage = () => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Intake form state
  const [form, setForm] = useState({
    artist_name: "",
    genre: "",
    goals: "",
    instagram: "",
    tiktok: "",
    spotify: "",
    followers_total: "",
    releases: "",
    process_stage: "idee",
    reference_artists: "",
    weekly_content_goal: "3",
    weekly_reminder: true,
    release_title: "",
    release_date: "",
  });

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("creator_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      const p = data as unknown as CreatorProfile;
      setProfile(p);
      setForm({
        artist_name: p.artist_name || "",
        genre: p.genre || "",
        goals: p.goals || "",
        instagram: p.socials?.instagram || "",
        tiktok: p.socials?.tiktok || "",
        spotify: p.socials?.spotify || "",
        followers_total: p.followers_total != null ? String(p.followers_total) : "",
        releases: p.releases || "",
        process_stage: p.process_stage || "idee",
        reference_artists: p.reference_artists || "",
        weekly_content_goal: p.weekly_content_goal != null ? String(p.weekly_content_goal) : "3",
        weekly_reminder: p.weekly_reminder,
        release_title: "",
        release_date: "",
      });
    } else {
      setShowIntake(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

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
        socials: {
          ...(form.instagram.trim() ? { instagram: form.instagram.trim() } : {}),
          ...(form.tiktok.trim() ? { tiktok: form.tiktok.trim() } : {}),
          ...(form.spotify.trim() ? { spotify: form.spotify.trim() } : {}),
        },
        followers_total: form.followers_total ? parseInt(form.followers_total, 10) || null : null,
        releases: form.releases.trim() || null,
        process_stage: form.process_stage,
        reference_artists: form.reference_artists.trim() || null,
        release_plan: releasePlan,
        weekly_content_goal: form.weekly_content_goal ? parseInt(form.weekly_content_goal, 10) || null : null,
        weekly_reminder: form.weekly_reminder,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("creator_profiles").upsert(payload as any);
      if (error) throw error;
      toast.success(profile ? "Profiel bijgewerkt!" : "Intake compleet — de coach kent je nu! 🚀");
      setShowIntake(false);
      await loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const addMilestone = async () => {
    if (!user || !profile || !newMilestone.trim()) return;
    const milestones = [...(profile.milestones || []), { text: newMilestone.trim(), achieved_at: new Date().toISOString() }];
    const { error } = await supabase.from("creator_profiles")
      .update({ milestones, updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id);
    if (!error) {
      setNewMilestone("");
      toast.success("Mijlpaal toegevoegd! 🏆");
      loadProfile();
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-coach", {
        body: { messages: updatedMessages, lang },
      });
      if (error) throw error;
      const content = data?.content || "Sorry, ik kon geen antwoord genereren.";
      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Er ging iets mis — probeer het opnieuw." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  // ── Intake wizard ──
  if (showIntake) {
    return (
      <div className="min-h-full bg-background pb-28">
        <SEO title="Content Coach — Uprising Studio" description="Jouw persoonlijke content-coach: post-ideeën, captions en releaseplannen." path="/coach" />
        <div className="sticky top-0 z-40 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-xl" style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => (profile ? setShowIntake(false) : navigate(-1))} className="p-1 -ml-1">
              <ChevronLeft size={22} />
            </button>
            <h1 className="text-lg font-bold font-display">{profile ? "Profiel bewerken" : "Vertel over jezelf"}</h1>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {!profile && (
            <p className="text-sm text-muted-foreground">
              De coach werkt vanaf jouw situatie: waar je staat, wat je al hebt bereikt en waar je naartoe wil. Hoe meer je invult, hoe beter de hulp.
            </p>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Artiestennaam *</label>
            <input value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })}
              placeholder="bijv. YUNG AMFO"
              className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Genre *</label>
            <input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}
              placeholder="Hip-hop, drill, R&B, house..."
              className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm" />
          </div>
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
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Doelen</label>
            <textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })}
              placeholder="bijv. Eerste EP uitbrengen, 1000 volgers op Insta, optreden boeken"
              rows={2}
              className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Instagram</label>
              <input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                placeholder="@handle" className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">TikTok</label>
              <input value={form.tiktok} onChange={(e) => setForm({ ...form, tiktok: e.target.value })}
                placeholder="@handle" className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Spotify-profiel</label>
              <input value={form.spotify} onChange={(e) => setForm({ ...form, spotify: e.target.value })}
                placeholder="link of naam" className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Totaal volgers (±)</label>
              <input value={form.followers_total} onChange={(e) => setForm({ ...form, followers_total: e.target.value.replace(/\D/g, "") })}
                placeholder="250" inputMode="numeric" className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Wat heb je al uitgebracht?</label>
            <textarea value={form.releases} onChange={(e) => setForm({ ...form, releases: e.target.value })}
              placeholder="bijv. 2 singles op Spotify, wat freestyles op TikTok" rows={2}
              className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Referentie-artiesten (jouw sound)</label>
            <input value={form.reference_artists} onChange={(e) => setForm({ ...form, reference_artists: e.target.value })}
              placeholder="bijv. Frenna, SFB, Travis Scott"
              className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm" />
          </div>
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
              <p className="text-[11px] text-muted-foreground">Posts per week + maandag-reminder</p>
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

  // ── Coach chat ──
  return (
    <div className="min-h-full flex flex-col">
      <SEO title="Content Coach — Uprising Studio" description="Jouw persoonlijke content-coach: post-ideeën, captions en releaseplannen." path="/coach" />
      <div className="px-5 pt-6 pb-4 border-b border-border">
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
          <button onClick={() => setShowMilestones(!showMilestones)} className="p-2 rounded-lg bg-card border border-border">
            <Trophy size={16} className="text-primary" />
          </button>
          <button onClick={() => setShowIntake(true)} className="p-2 rounded-lg bg-card border border-border">
            <Settings2 size={16} className="text-muted-foreground" />
          </button>
        </div>

        {showMilestones && (
          <div className="mt-3 rounded-xl bg-card border border-border p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5"><Trophy size={12} className="text-primary" /> Mijlpalen</p>
            {(profile?.milestones || []).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nog geen mijlpalen — voeg je eerste toe!</p>
            ) : (
              (profile?.milestones || []).map((m, i) => (
                <p key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Check size={11} className="text-success shrink-0" /> {m.text}
                </p>
              ))
            )}
            <div className="flex gap-2">
              <input value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                placeholder="bijv. Eerste single uit!" className="flex-1 rounded-lg bg-secondary border border-border px-3 py-2 text-xs" />
              <button onClick={addMilestone} disabled={!newMilestone.trim()}
                className="rounded-lg bg-primary/20 px-3 text-primary disabled:opacity-40"><Plus size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 pb-40 space-y-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="text-center py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow mx-auto mb-4">
                <Sparkles size={28} className="text-primary-foreground" />
              </div>
              <h2 className="text-lg font-bold font-display">Klaar om te groeien, {profile?.artist_name}?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Post-ideeën, captions, shot lists en releaseplannen — op maat voor jou.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button key={q.text} onClick={() => sendMessage(q.text)}
                  className="flex items-center gap-2 rounded-xl bg-card border border-border p-3 text-left text-xs font-medium transition-all hover:border-primary/40 active:scale-[0.98]">
                  <q.icon size={14} className="text-primary shrink-0" />
                  {q.text}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user" ? "gradient-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                ) : msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="rounded-2xl bg-card border border-border px-4 py-3 rounded-bl-md">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                Coach denkt na...
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div
        className="fixed left-0 right-0 z-40 pb-3 bg-gradient-to-t from-background via-background to-transparent pt-6"
        style={{
          bottom: "var(--bottom-nav-total-offset)",
          paddingLeft: "calc(var(--safe-area-left) + 1rem)",
          paddingRight: "calc(var(--safe-area-right) + 1rem)",
        }}
      >
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Vraag de coach iets..." disabled={isLoading}
            className="flex-1 rounded-xl bg-card border border-border px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-50" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
            className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow active:scale-[0.95] disabled:opacity-50">
            <Send size={18} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentCoachPage;
