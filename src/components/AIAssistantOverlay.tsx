import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, Mic, Music, Camera, Sliders, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

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

interface Props {
  open: boolean;
  onClose: () => void;
}

const AIAssistantOverlay = ({ open, onClose }: Props) => {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const assistantContent = data?.content || data?.choices?.[0]?.message?.content ||
        (t("sorryNoResponse"));
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
    } catch (err: any) {
      console.error("AI error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("sorryError") },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const questions = quickQuestions[lang] || quickQuestions.nl;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-x-0 z-40 flex flex-col bg-background/95 backdrop-blur-xl"
          style={{
            top: "var(--safe-area-top)",
            bottom: "var(--bottom-nav-total-offset)",
            left: "var(--safe-area-left)",
            right: "var(--safe-area-right)",
          }}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-border flex items-center gap-3">
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 transition-colors active:scale-[0.95]">
              <X size={18} className="text-foreground" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-glow">
              <span className="text-sm font-bold text-primary-foreground">Ai</span>
            </div>
            <div>
              <h2 className="text-base font-bold font-display">
                {t("aiAssistant")}
              </h2>
              <p className="text-[10px] text-foreground/70">
                {t("askAboutStudios")}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow mx-auto mb-3">
                    <Sparkles size={24} className="text-primary-foreground" />
                  </div>
                  <h3 className="text-base font-bold font-display">
                    {t("howCanIHelp")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("iKnowAll")}
                  </p>
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
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user" ? "gradient-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-card border border-border px-4 py-3 rounded-bl-md">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    {t("thinking")}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 pb-3 pt-2 border-t border-border">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder={t("askQuestion")}
                disabled={isLoading}
                className="flex-1 rounded-xl bg-card border border-border px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-50"
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
                className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary shadow-glow active:scale-[0.95] disabled:opacity-50">
                <Send size={16} className="text-primary-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIAssistantOverlay;
