import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  onCancelled: () => void;
}

const BookingCancelDialog = ({ open, onOpenChange, booking, onCancelled }: Props) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  if (!open || !booking) return null;

  const handleCancel = async () => {
    setLoading(true);
    try {
      // Delete the booking (members can delete their own pending/confirmed bookings)
      const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
      if (error) throw new Error(error.message);
      onCancelled();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Cancel booking error:", err);
      alert(err.message || "Er ging iets mis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="rounded-2xl bg-card border border-border p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 size={18} className="text-destructive" />
          <h3 className="font-display font-semibold text-base">Boeking annuleren</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Weet je het zeker? Deze boeking wordt permanent verwijderd en het tijdslot wordt vrijgegeven.
        </p>
        <div className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{booking.studio_id === "studio-1" ? "Studio 1" : booking.studio_id === "studio-2" ? "Studio 2" : "Content Room"}</p>
          <p>{booking.booking_date} • {booking.start_time} • {booking.duration_hours}h</p>
        </div>
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
            disabled={loading}
            className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground flex items-center justify-center gap-2"
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
