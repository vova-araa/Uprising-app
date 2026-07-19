import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Loader2, Sparkles, Mic, Music, Camera, Sliders } from "lucide-react";
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

const AIAssistantPage = () => {
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

      const assistantContent = data?.content || data?.choices?.[0]?.message?.content || t("sorryNoResponse");
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
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
            className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow active:scale-[0.95] disabled:opacity-50">
            <Send size={18} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
