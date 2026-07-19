import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Loader2, Sparkles, Mic, Music, Camera, Sliders, Calendar, Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { redirectToExternal } from "@/lib/redirect";
import { inlineToast as toast } from "@/components/InlineToast";

interface BookingProposal {
  studio_id: string;
  booking_date: string;
  start_time: string;
  duration_hours: number;
  studio_name: string;
  available: boolean;
  alternatives: string[];
}

type Msg = { role: "user" | "assistant"; content: string; proposal?: BookingProposal | null; proposalHandled?: boolean };

const quickQuestions = {
  nl: [
    { text: "Welke studio past bij mij?", icon: Mic },
    { text: "Hoeveel uur heb ik nodig?", icon: Music },
    { text: "Heb ik een producer nodig?", icon: Sliders },
    { text: "Welke dienst past bij mijn project?", icon: Camera },
  ],
  en: [
    { text: "Which studio is right for me?", icon: Mic },
    { text: "How many hours do I need?", icon: Music },
    { text: "Do I need a producer?", icon: Sliders },
    { text: "Which service fits my project?", icon: Camera },
  ],
};

const AIAssistantPage = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const confirmProposal = async (msgIndex: number, proposal: BookingProposal) => {
    setConfirmingBooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-booking", {
        body: {
          studio_id: proposal.studio_id,
          booking_date: proposal.booking_date,
          start_time: proposal.start_time,
          duration_hours: proposal.duration_hours,
          extras: [],
          use_wallet: true,
        },
      });

      let serverError: string | null = null;
      if (error && (error as any).context) {
        try {
          const ctx = (error as any).context;
          const body = typeof ctx?.json === "function" ? await ctx.json() : ctx;
          if (body?.error) serverError = body.error;
        } catch { /* ignore */ }
      }
      if (!serverError && data?.error) serverError = data.error;

      if (serverError) {
        toast.error(serverError);
        setMessages((prev) => [...prev, { role: "assistant", content: `Dat lukte net niet: ${serverError}` }]);
        return;
      }
      if (error) throw error;

      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, proposalHandled: true } : m)));

      if (data?.url) {
        redirectToExternal(data.url);
      } else if (data?.success) {
        toast.success(lang === "nl" ? "Geboekt! 🎉" : "Booked! 🎉");
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: lang === "nl"
            ? `✅ Staat vast! ${proposal.studio_name} op ${proposal.booking_date} om ${proposal.start_time} (${proposal.duration_hours} uur). Je vindt de boeking bij je account — daar open je straks ook de deur.`
            : `✅ Locked in! ${proposal.studio_name} on ${proposal.booking_date} at ${proposal.start_time} (${proposal.duration_hours}h). Find it in your account — that's also where you open the door.`,
        }]);
        setTimeout(() => navigate("/account?tab=bookings"), 2500);
      }
    } catch {
      toast.error(t("paymentError"));
    } finally {
      setConfirmingBooking(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: updatedMessages, lang },
      });

      if (error) throw error;

      const assistantContent = data?.content || data?.choices?.[0]?.message?.content || t("sorryNoResponse");
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent, proposal: data?.proposal || null }]);
    } catch (err: any) {
      console.error("AI error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: t("sorryError") }]);
    } finally {
      setIsLoading(false);
    }
  };

  const questions = quickQuestions[lang as keyof typeof quickQuestions] || quickQuestions.nl;

  return (
    <div className="min-h-full flex flex-col">
      <div className="px-5 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow">
            <Bot size={20} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display">{t("aiAssistant")}</h1>
            <p className="text-xs text-muted-foreground">{t("askAboutStudios")}</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 pb-40 space-y-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="text-center py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow mx-auto mb-4">
                <Sparkles size={28} className="text-primary-foreground" />
              </div>
              <h2 className="text-lg font-bold font-display">{t("howCanIHelp")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("iKnowAll")}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {questions.map((q) => (
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
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user" ? "gradient-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                ) : msg.content}
              </div>

              {/* Booking proposal card */}
              {msg.proposal && !msg.proposalHandled && (
                <div className="mt-2 max-w-[85%] w-full rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-primary" />
                    <span className="text-sm font-semibold">
                      {msg.proposal.studio_name} • {msg.proposal.booking_date} • {msg.proposal.start_time} ({msg.proposal.duration_hours}u)
                    </span>
                  </div>
                  {msg.proposal.available ? (
                    <button
                      onClick={() => confirmProposal(i, msg.proposal!)}
                      disabled={confirmingBooking}
                      className="w-full rounded-xl gradient-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98]"
                    >
                      {confirmingBooking ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {lang === "nl" ? "Bevestig boeking" : "Confirm booking"}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <X size={13} /> {lang === "nl" ? "Dit tijdslot is helaas bezet." : "This slot is taken."}
                      </p>
                      {msg.proposal.alternatives.length > 0 && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1.5">
                            {lang === "nl" ? "Wel vrij die dag:" : "Free that day:"}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.proposal.alternatives.map((alt) => (
                              <button
                                key={alt}
                                onClick={() => sendMessage(lang === "nl" ? `Doe maar ${alt}` : `Let's do ${alt}`)}
                                className="rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-semibold"
                              >
                                {alt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="rounded-2xl bg-card border border-border px-4 py-3 rounded-bl-md">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                {t("thinking")}
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
            placeholder={t("askQuestion")} disabled={isLoading}
            className="flex-1 rounded-xl bg-card border border-border px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-50" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
            aria-label={lang === "nl" ? "Verstuur" : "Send"}
            className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow active:scale-[0.95] disabled:opacity-50">
            <Send size={18} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
