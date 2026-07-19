import { useState } from "react";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { inlineToast as toast } from "@/components/InlineToast";

interface FeedbackDialogProps {
  bookingId: string;
  open: boolean;
  onClose: () => void;
}

const FeedbackDialog = ({ bookingId, open, onClose }: FeedbackDialogProps) => {
  const { t, lang } = useI18n();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error(t("selectRating"));
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await (supabase as any)
        .from("booking_feedback")
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          rating,
          comment: comment.trim() || null,
        });

      if (error) throw error;
      toast.success(t("thanksFeedback"));
      onClose();
    } catch (err: any) {
      console.error("Feedback error:", err);
      if (err.message?.includes("unique")) {
        toast.error(t("alreadySubmittedFeedback2"));
      } else {
        toast.error(t("somethingWentWrong"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-5 top-1/2 -translate-y-1/2 z-50 rounded-2xl bg-card border border-border p-6 shadow-card max-w-md mx-auto" data-toast-section
          >
            <h2 className="text-xl font-bold font-display text-center mb-1">
              {t("howWasSession")}
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-5">
              {t("letUsKnow")}
            </p>

            {/* Star rating */}
            <div className="flex justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    size={36}
                    className={`transition-colors ${
                      star <= (hoveredStar || rating)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Optional comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("tellUsMore")}
              className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm resize-none h-24 focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
            />

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                {t("skip")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || rating === 0}
                className="flex-1 rounded-xl gradient-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-glow"
              >
                {isSubmitting
                  ? "..."
                  : t("send")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FeedbackDialog;
