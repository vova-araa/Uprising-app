import { useEffect, useState } from "react";
import { Loader2, Trash2, Wallet, Banknote, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RefundPlan {
  kind: "none" | "cash" | "wallet" | "hours" | "mixed";
  cashAmount: number;
  walletAmount: number;
  restoreHours: number;
  reason: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  onCancelled: () => void;
}

const BookingCancelDialog = ({ open, onOpenChange, booking, onCancelled }: Props) => {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [plan, setPlan] = useState<RefundPlan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !booking) return;
    setPlan(null);
    setError("");
    setPreviewLoading(true);
    supabase.functions
      .invoke("cancel-booking", { body: { booking_id: booking.id, preview: true } })
      .then(({ data, error: fnErr }) => {
        if (fnErr || data?.error) setError(data?.error || "Kon annuleringsvoorwaarden niet ophalen");
        else setPlan(data.policy as RefundPlan);
      })
      .finally(() => setPreviewLoading(false));
  }, [open, booking]);

  if (!open || !booking) return null;

  const handleCancel = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("cancel-booking", {
        body: { booking_id: booking.id },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message || "Er ging iets mis");
      onCancelled();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Er ging iets mis");
    } finally {
      setLoading(false);
    }
  };

  const refundSummary = plan && (
    plan.kind === "none" ? (
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Clock size={14} className="mt-0.5 shrink-0" />
        <span>
          {plan.reason === "late"
            ? "Je annuleert binnen 4 uur voor de start — er is geen terugbetaling meer mogelijk."
            : "Er is niets betaald voor deze boeking; er valt niets terug te betalen."}
        </span>
      </div>
    ) : (
      <div className="space-y-1.5 text-xs">
        {plan.cashAmount > 0 && (
          <div className="flex items-center gap-2 text-success">
            <Banknote size={14} className="shrink-0" />
            <span>€{plan.cashAmount} wordt teruggestort op je rekening</span>
          </div>
        )}
        {plan.walletAmount > 0 && (
          <div className="flex items-center gap-2 text-success">
            <Wallet size={14} className="shrink-0" />
            <span>€{plan.walletAmount} tegoed in je account (90 dagen geldig)</span>
          </div>
        )}
        {plan.restoreHours > 0 && (
          <div className="flex items-center gap-2 text-success">
            <Clock size={14} className="shrink-0" />
            <span>{plan.restoreHours} credituren worden teruggezet</span>
          </div>
        )}
      </div>
    )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-6">
      <div className="animate-fade-in rounded-2xl card-premium border border-border p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 size={18} className="text-destructive" />
          <h3 className="font-display font-semibold text-base">Boeking annuleren</h3>
        </div>
        <div className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{booking.studio_id === "studio-1" ? "Studio 1" : booking.studio_id === "studio-2" ? "Studio 2" : "Content Room"}</p>
          <p>{booking.booking_date} • {booking.start_time} • {booking.duration_hours}h</p>
        </div>

        {previewLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Voorwaarden controleren...
          </div>
        ) : refundSummary}

        <p className="text-[11px] text-muted-foreground">
          Gratis annuleren tot 48 uur vooraf (terugbetaling), tot 4 uur vooraf als tegoed.
        </p>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium"
          >
            Terug
          </button>
          <button
            onClick={handleCancel}
            disabled={loading || previewLoading}
            className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingCancelDialog;
