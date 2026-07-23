import { useState } from "react";
import { Loader2, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/lib/i18n";
import { StarInput } from "@/components/StarRating";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  studioName: string;
  onSubmitted: () => void;
}

const ReviewDialog = ({ open, onOpenChange, booking, studioName, onSubmitted }: Props) => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open || !booking) return null;

  const submit = async () => {
    if (rating < 1) {
      setError(lang === "nl" ? "Kies eerst een aantal sterren." : "Pick a star rating first.");
      return;
    }
    if (loading || !user) return;
    setLoading(true);
    setError("");
    try {
      // Insert directly into booking_feedback — RLS scopes it to the user and a
      // DB trigger awards the points; UNIQUE(booking_id) prevents double reviews.
      const { error: insErr } = await (supabase as any).from("booking_feedback").insert({
        booking_id: booking.id,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      });
      if (insErr) {
        if (/unique|duplicate/i.test(insErr.message || "")) {
          setError(lang === "nl" ? "Je hebt deze sessie al beoordeeld." : "You already reviewed this session.");
        } else {
          setError(lang === "nl" ? "Insturen mislukt — probeer opnieuw." : "Submit failed — try again.");
        }
        return;
      }
      onSubmitted();
      onOpenChange(false);
      setRating(0);
      setComment("");
    } catch (err: any) {
      setError(err.message || (lang === "nl" ? "Insturen mislukt" : "Submit failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-6" onClick={() => !loading && onOpenChange(false)}>
      <div className="animate-fade-in rounded-2xl card-premium border border-border p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Star size={18} className="text-primary" />
          <h3 className="font-display font-semibold text-base">
            {lang === "nl" ? "Beoordeel je sessie" : "Rate your session"}
          </h3>
          <button onClick={() => onOpenChange(false)} disabled={loading} aria-label={lang === "nl" ? "Sluiten" : "Close"} className="ml-auto text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {studioName} — {lang === "nl" ? "je feedback helpt ons de studio te verbeteren. Je verdient 10 punten." : "your feedback helps us improve the studio. You earn 10 points."}
        </p>

        <div className="flex justify-center py-2">
          <StarInput value={rating} onChange={setRating} disabled={loading} />
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={lang === "nl" ? "Wat ging goed? Wat kan beter? (optioneel)" : "What went well? What could be better? (optional)"}
          className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => onOpenChange(false)} disabled={loading} className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">
            {lang === "nl" ? "Terug" : "Back"}
          </button>
          <button onClick={submit} disabled={loading || rating < 1} className="flex-1 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
            {lang === "nl" ? "Insturen" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewDialog;
