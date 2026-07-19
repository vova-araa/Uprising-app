import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { inlineToast as toast } from "@/components/InlineToast";
import { motion } from "framer-motion";

const FeedbackPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    if (!user || !bookingId) return;
    (supabase as any)
      .from("booking_feedback")
      .select("id")
      .eq("booking_id", bookingId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setAlreadySubmitted(true);
      });
  }, [user, bookingId]);

  const handleSubmit = async () => {
    if (!user || !bookingId) return;
    if (rating === 0) {
      toast.error(t("selectRating"));
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("booking_feedback")
        .insert({ booking_id: bookingId, user_id: user.id, rating, comment: comment.trim() || null });
      if (error) throw error;
      toast.success(t("thanksFeedback"));
      navigate("/account");
    } catch (err: any) {
      console.error(err);
      toast.error(t("somethingWentWrong"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) { navigate("/auth"); return null; }

  if (alreadySubmitted) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-5 text-center">
        <p className="text-lg font-semibold mb-2">{t("alreadySubmittedFeedback")}</p>
        <button onClick={() => navigate("/account")} className="text-primary font-medium text-sm mt-2">{t("backToAccount")}</button>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-card" data-toast-section>
        <h1 className="text-xl font-bold font-display text-center mb-1">{t("howWasSession")}</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">{t("letUsKnow")}</p>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)} onClick={() => setRating(star)}
              className="transition-transform hover:scale-110 active:scale-95">
              <Star size={40} className={`transition-colors ${star <= (hoveredStar || rating) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
            </button>
          ))}
        </div>

        <textarea value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder={t("tellUsMore")}
          className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm resize-none h-28 focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50" />

        <div className="flex gap-3 mt-5">
          <button onClick={() => navigate("/account")}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors">
            {t("skip")}
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting || rating === 0}
            className="flex-1 rounded-xl gradient-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-glow">
            {isSubmitting ? <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />{t("sending")}</span> : t("send")}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FeedbackPage;
