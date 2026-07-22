import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, Mail, Clock, Trash2, Edit3,
  Users, CalendarClock, Eye, ChevronDown, ChevronRight,
  Megaphone, Plus, X
} from "lucide-react";
import { format, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { inlineToast as toast } from "@/components/InlineToast";

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface BlastDraft {
  id: string;
  subject: string;
  body: string;
  scheduled_at: string | null;
  status: string;
  recipient_count: number;
  created_at: string;
  sent_at: string | null;
}

const AdminBlastTab = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [drafts, setDrafts] = useState<BlastDraft[]>([]);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  // Compose state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [targetGroup, setTargetGroup] = useState<"all" | "members" | "non-members">("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, draftsRes] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, membership"),
        (supabase.from as any)("app_config")
          .select("*")
          .eq("config_key", "email_blasts")
          .maybeSingle(),
      ]);
      setProfiles(profilesRes.data || []);
      if (draftsRes.data?.config_value) {
        setDrafts(draftsRes.data.config_value as BlastDraft[]);
      }
    } catch {
      toast.error("Laden mislukt");
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipients = profiles.filter(p => {
    if (!p.email) return false;
    if (targetGroup === "members") return !!p.membership;
    if (targetGroup === "non-members") return !p.membership;
    return true;
  });

  const saveDrafts = async (updated: BlastDraft[]) => {
    try {
      // Check if config exists
      const { data: existing } = await (supabase.from as any)("app_config")
        .select("id")
        .eq("config_key", "email_blasts")
        .maybeSingle();

      // supabase-js resolves on a DB error, so capture and throw it explicitly
      // — otherwise a failed save would optimistically update state and the
      // scheduled blast would silently vanish on the next reload.
      const { error } = existing
        ? await (supabase.from as any)("app_config")
            .update({ config_value: updated, updated_at: new Date().toISOString() })
            .eq("config_key", "email_blasts")
        : await (supabase.from as any)("app_config")
            .insert({
              config_key: "email_blasts",
              config_value: updated,
              category: "general",
              description: "Opgeslagen e-mail blasts en geplande deals",
              sort_order: 99,
            });
      if (error) throw error;
      setDrafts(updated);
    } catch {
      toast.error("Opslaan mislukt");
    }
  };

  const handleSendNow = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Vul onderwerp en bericht in");
      return;
    }
    setSending(true);
    try {
      // Send via edge function
      const { error } = await supabase.functions.invoke("send-blast-email", {
        body: {
          subject,
          body,
          recipients: filteredRecipients.map(p => ({ email: p.email, name: p.full_name })),
        },
      });
      if (error) throw error;

      // Save to history
      const blast: BlastDraft = {
        id: crypto.randomUUID(),
        subject,
        body,
        scheduled_at: null,
        status: "sent",
        recipient_count: filteredRecipients.length,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      };
      await saveDrafts([blast, ...drafts]);

      toast.success(`✅ ${filteredRecipients.length} e-mails verstuurd!`);
      resetCompose();
    } catch (err: any) {
      toast.error("Versturen mislukt: " + (err.message || "onbekende fout"));
    } finally {
      setSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Vul onderwerp en bericht in");
      return;
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    const blast: BlastDraft = {
      id: crypto.randomUUID(),
      subject,
      body,
      scheduled_at: scheduledAt,
      status: "scheduled",
      recipient_count: filteredRecipients.length,
      created_at: new Date().toISOString(),
      sent_at: null,
    };
    await saveDrafts([blast, ...drafts]);
    toast.success(`📅 Deal bom ingepland voor ${format(new Date(scheduledAt), "d MMM yyyy HH:mm", { locale: nl })}`);
    resetCompose();
  };

  const handleDeleteDraft = async (id: string) => {
    const updated = drafts.filter(d => d.id !== id);
    await saveDrafts(updated);
    toast.success("Verwijderd");
  };

  const resetCompose = () => {
    setShowCompose(false);
    setShowPreview(false);
    setSubject("");
    setBody("");
    setIsScheduled(false);
    setTargetGroup("all");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  const totalWithEmail = profiles.filter(p => p.email).length;
  const membersCount = profiles.filter(p => p.email && p.membership).length;

  return (
    <div className="space-y-4" data-toast-section>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold font-display">📣 Mail & Deal Bom</h2>
          <p className="text-[10px] text-muted-foreground">
            Stuur e-mails naar alle gebruikers of plan deal bommen in
          </p>
        </div>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="flex items-center gap-1.5 rounded-xl gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          {showCompose ? <X size={12} /> : <Plus size={12} />}
          {showCompose ? "Sluiten" : "Nieuwe Blast"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-lg font-bold text-primary">{totalWithEmail}</p>
          <p className="text-[9px] text-muted-foreground">Totaal e-mails</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-lg font-bold text-success">{membersCount}</p>
          <p className="text-[9px] text-muted-foreground">Leden</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-lg font-bold text-warning">
            {drafts.filter(d => d.status === "scheduled").length}
          </p>
          <p className="text-[9px] text-muted-foreground">Ingepland</p>
        </div>
      </div>

      {/* Compose */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-card border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Megaphone size={14} className="text-primary" />
                Nieuwe E-mail Blast
              </h3>

              {/* Target Group */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Doelgroep</label>
                <div className="flex gap-2">
                  {([
                    { id: "all" as const, label: "Iedereen", count: totalWithEmail },
                    { id: "members" as const, label: "Leden", count: membersCount },
                    { id: "non-members" as const, label: "Niet-leden", count: totalWithEmail - membersCount },
                  ]).map(g => (
                    <button
                      key={g.id}
                      onClick={() => setTargetGroup(g.id)}
                      className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-all ${
                        targetGroup === g.id
                          ? "gradient-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {g.label} ({g.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Onderwerp</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="bijv. 🔥 Exclusive Deal - 50% korting op studio sessies!"
                  className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">
                  Bericht <span className="text-muted-foreground/50">(gebruik {"{{naam}}"} voor personalisatie)</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Hey {{naam}},\n\nWe hebben een speciale deal voor je!\n\n🎵 50% korting op alle studio sessies deze week.\n\nBoek nu via de app!\n\nGroeten,\nUprising Studio`}
                  rows={8}
                  className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-xs font-mono resize-y min-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* Schedule toggle */}
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 border border-border/50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <CalendarClock size={14} className="text-primary" />
                  <span className="text-xs font-semibold">Inplannen voor later</span>
                </div>
                <button
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    isScheduled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    isScheduled ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>

              {isScheduled && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground block mb-1">Datum</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={format(new Date(), "yyyy-MM-dd")}
                      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground block mb-1">Tijd</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Preview */}
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <Eye size={12} />
                {showPreview ? "Verberg voorbeeld" : "Bekijk voorbeeld"}
              </button>

              <AnimatePresence>
                {showPreview && subject && body && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">E-mail voorbeeld</p>
                      <p className="text-xs font-bold mb-2">{subject}</p>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {body.replace(/\{\{naam\}\}/g, "Jan")}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {isScheduled ? (
                  <button
                    onClick={handleSchedule}
                    disabled={!subject || !body}
                    className="flex-1 rounded-xl gradient-primary py-3 text-xs font-bold text-primary-foreground flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CalendarClock size={14} />
                    Inplannen ({filteredRecipients.length} ontvangers)
                  </button>
                ) : (
                  <button
                    onClick={handleSendNow}
                    disabled={sending || !subject || !body}
                    className="flex-1 rounded-xl gradient-primary py-3 text-xs font-bold text-primary-foreground flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Direct versturen ({filteredRecipients.length} ontvangers)
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheduled & History */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">📋 Geplande & Verstuurde Blasts</h3>
        {drafts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nog geen blasts verstuurd of ingepland
          </p>
        ) : (
          drafts.map(d => {
            const isExpanded = expandedDraft === d.id;
            return (
              <motion.div key={d.id} variants={item} className="rounded-xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => setExpandedDraft(isExpanded ? null : d.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                    d.status === "scheduled" ? "bg-warning/20" : "bg-success/20"
                  }`}>
                    {d.status === "scheduled" ? (
                      <Clock size={14} className="text-warning" />
                    ) : (
                      <Mail size={14} className="text-success" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{d.subject}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.status === "scheduled"
                        ? `📅 Gepland: ${format(new Date(d.scheduled_at!), "d MMM yyyy HH:mm", { locale: nl })}`
                        : `✅ Verstuurd: ${d.sent_at ? format(new Date(d.sent_at), "d MMM yyyy HH:mm", { locale: nl }) : "—"}`
                      }
                      {" • "}{d.recipient_count} ontvangers
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 ${
                      d.status === "scheduled" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
                    }`}>
                      {d.status === "scheduled" ? "Ingepland" : "Verstuurd"}
                    </span>
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
                      <ChevronRight size={12} className="text-muted-foreground" />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-3 pb-3 space-y-2">
                        <div className="pt-2">
                          <p className="text-[10px] text-muted-foreground mb-1">Bericht:</p>
                          <pre className="text-xs text-foreground whitespace-pre-wrap bg-secondary/50 rounded-lg p-2">
                            {d.body}
                          </pre>
                        </div>
                        <div className="flex gap-2">
                          {d.status === "scheduled" && (
                            <>
                              <button
                                onClick={async () => {
                                  // Send now
                                  setSending(true);
                                  try {
                                    const recipients = profiles.filter(p => p.email).map(p => ({ email: p.email, name: p.full_name }));
                                    const { data: sendData, error: sendErr } = await supabase.functions.invoke("send-blast-email", {
                                      body: { subject: d.subject, body: d.body, recipients },
                                    });
                                    // Don't mark the blast as sent (or claim success) if the send failed.
                                    if (sendErr || sendData?.error) { toast.error("Versturen mislukt — niet verstuurd."); return; }
                                    const updated = drafts.map(dr =>
                                      dr.id === d.id ? { ...dr, status: "sent", sent_at: new Date().toISOString() } : dr
                                    );
                                    await saveDrafts(updated);
                                    toast.success("✅ Blast verstuurd!");
                                  } catch {
                                    toast.error("Versturen mislukt");
                                  } finally {
                                    setSending(false);
                                  }
                                }}
                                disabled={sending}
                                className="flex-1 rounded-lg gradient-primary py-2 text-xs font-semibold text-primary-foreground flex items-center justify-center gap-1"
                              >
                                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                Nu versturen
                              </button>
                              <button
                                onClick={() => handleDeleteDraft(d.id)}
                                className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs font-semibold flex items-center gap-1"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                          {d.status === "sent" && (
                            <button
                              onClick={() => handleDeleteDraft(d.id)}
                              className="flex-1 rounded-lg bg-secondary py-2 text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1"
                            >
                              <Trash2 size={12} /> Verwijder uit historie
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminBlastTab;
