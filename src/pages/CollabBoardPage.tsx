import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Loader2, X, Handshake, Music2, Mic, Sliders, Disc3, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { inlineToast as toast } from "@/components/InlineToast";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useConfirm } from "@/components/ConfirmDialog";
import SEO from "@/components/SEO";

interface Post {
  id: string; user_id: string; title: string; description: string | null;
  looking_for: string[]; genre: string | null; contact_info: string | null;
  status: string; created_at: string;
}

const ROLES = [
  { id: "vocalist", label: "Zanger/rapper", icon: Mic },
  { id: "producer", label: "Producer", icon: Sliders },
  { id: "beat", label: "Beat/instrumental", icon: Disc3 },
  { id: "engineer", label: "Mix engineer", icon: Music2 },
  { id: "other", label: "Anders", icon: Users },
];
const roleLabel = (id: string) => ROLES.find((r) => r.id === id)?.label || id;

const CollabBoardPage = () => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("collab_posts").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(100);
    // Don't render an empty "no posts yet" board on a transient read error.
    if (error) { console.error("Collab board load failed", error); setLoading(false); return; }
    const list = (data as Post[]) || [];
    setPosts(list);
    const ids = [...new Set(list.map((p) => p.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setNames(new Map((profs || []).map((p: any) => [p.id, p.full_name || "Artiest"])));
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const respond = async (post: Post) => {
    setResponding(post.id);
    try {
      const { data, error } = await supabase.functions.invoke("collab-respond", { body: { post_id: post.id } });
      if (error || data?.error) throw new Error(data?.error || "Mislukt");
      toast.success("Interesse verstuurd! De poster krijgt bericht.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResponding(null);
    }
  };

  const closePost = async (id: string) => {
    if (!(await confirm({ title: "Deze post sluiten?", message: "Anderen kunnen dan niet meer reageren." }))) return;
    const { error } = await supabase.from("collab_posts").update({ status: "closed" }).eq("id", id);
    if (error) {
      toast.error("Sluiten mislukt — probeer opnieuw.");
      return;
    }
    toast.success("Post gesloten");
    load();
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-full pb-28">
      <SEO title="Collab Board — Uprising Studio" description="Vind een zanger, producer, beatmaker of engineer in de Uprising community." path="/collab" />
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary shadow-glow"><Handshake size={22} className="text-primary-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold font-display">Collab Board</h1>
            <p className="text-xs text-muted-foreground">Vind je volgende samenwerking</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-xl gradient-primary px-3 py-2.5 text-sm font-bold text-primary-foreground flex items-center gap-1"><Plus size={16} /> Post</button>
      </div>

      <div className="px-5 space-y-3">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <Users size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nog geen posts. Plaats de eerste en vind je collab!</p>
          </div>
        ) : posts.map((post) => {
          const mine = post.user_id === user?.id;
          return (
            <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl card-premium border border-border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold font-display">{post.title}</h3>
                  <p className="text-[11px] text-muted-foreground">{names.get(post.user_id) || "Artiest"}{post.genre ? ` • ${post.genre}` : ""} • {format(new Date(post.created_at), "d MMM", { locale: nl })}</p>
                </div>
                {mine && <button onClick={() => closePost(post.id)} className="shrink-0 text-[11px] text-destructive flex items-center gap-1"><Trash2 size={12} /> Sluiten</button>}
              </div>
              {post.looking_for.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {post.looking_for.map((r) => <span key={r} className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary">{roleLabel(r)}</span>)}
                </div>
              )}
              {post.description && <p className="text-sm text-muted-foreground">{post.description}</p>}
              {post.contact_info && <p className="text-[11px] text-muted-foreground">Contact: <span className="text-foreground">{post.contact_info}</span></p>}
              {!mine && (
                <button onClick={() => respond(post)} disabled={responding === post.id}
                  className="mt-1 w-full rounded-lg bg-primary/10 border border-primary/30 py-2 text-xs font-semibold text-primary flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {responding === post.id ? <Loader2 size={13} className="animate-spin" /> : <Handshake size={13} />} Ik ben geïnteresseerd
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {showCreate && <CreatePost onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
};

const CreatePost = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [contact, setContact] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("collab_posts").insert({
      user_id: user.id, title: title.trim(), description: description.trim() || null,
      looking_for: roles, genre: genre.trim() || null, contact_info: contact.trim() || null,
    });
    setSaving(false);
    if (error) toast.error("Plaatsen mislukt"); else { toast.success("Post geplaatst!"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="animate-slide-up rounded-2xl card-premium border border-border p-5 max-w-sm w-full space-y-3 mb-4 sm:mb-0 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-base">Nieuwe collab-post</h3>
          <button onClick={onClose} aria-label="Sluiten" className="p-1"><X size={18} /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel — bijv. 'Zoek zangeres voor R&B hook'" className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Ik zoek een...</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => {
              const active = roles.includes(r.id);
              return (
                <button key={r.id} onClick={() => setRoles(active ? roles.filter((x) => x !== r.id) : [...roles, r.id])}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1.5 ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <r.icon size={13} /> {r.label}
                </button>
              );
            })}
          </div>
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Beschrijf je project / wat je zoekt" className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        <div className="grid grid-cols-2 gap-2">
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre" className="rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (bijv. @insta)" className="rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <button onClick={save} disabled={saving || !title.trim()} className="w-full rounded-xl gradient-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Plaatsen
        </button>
      </div>
    </div>
  );
};

export default CollabBoardPage;
