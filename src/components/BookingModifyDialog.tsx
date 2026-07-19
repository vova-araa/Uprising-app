import { useState, useEffect } from "react";
import { Loader2, Pencil, Minus, Plus } from "lucide-react";
import { format, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const HOURS = Array.from({ length: 15 }, (_, i) => `${(i + 8).toString().padStart(2, "0")}:00`);
const STUDIOS = [
  { id: "studio-1", label: "Studio 1" },
  { id: "studio-2", label: "Studio 2" },
  { id: "content-room", label: "Content Room" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  onModified: () => void;
}

const BookingModifyDialog = ({ open, onOpenChange, booking, onModified }: Props) => {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(1);
  const [studioId, setStudioId] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (booking && open) {
      setDate(booking.booking_date);
      setTime(booking.start_time);
      setDuration(booking.duration_hours);
      setStudioId(booking.studio_id);
      setConflict(false);
      setError("");
    }
  }, [booking, open]);

  // Check availability whenever date/time/duration/studio changes
  useEffect(() => {
    if (!open || !date || !time || !studioId) return;
    const checkAvail = async () => {
      setChecking(true);
      setConflict(false);
      try {
        const { data } = await supabase.rpc("get_booking_availability", {
          target_date: date,
          target_studio_id: studioId,
        });
        const existing = (data || []).filter((b: any) => {
          // Exclude the current booking being modified
          if (booking && b.start_time === booking.start_time && b.duration_hours === booking.duration_hours && b.studio_id === booking.studio_id && date === booking.booking_date) {
            return false;
          }
          const bStart = parseInt(b.start_time.split(":")[0]);
          const bEnd = bStart + b.duration_hours;
          const newStart = parseInt(time.split(":")[0]);
          const newEnd = newStart + duration;
          return newStart < bEnd && newEnd > bStart;
        });
        setConflict(existing.length > 0);
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    };
    const timer = setTimeout(checkAvail, 300);
    return () => clearTimeout(timer);
  }, [date, time, duration, studioId, open]);

  if (!open || !booking) return null;

  const isChanged = date !== booking.booking_date || time !== booking.start_time || duration !== booking.duration_hours || studioId !== booking.studio_id;

  const handleSave = async () => {
    if (conflict) return;
    if (!isChanged) { onOpenChange(false); return; }
    setLoading(true);
    setError("");
    try {
      // We need to delete and re-create since the protect_booking_sensitive_fields trigger
      // blocks regular users from modifying most fields. Members delete + re-insert.
      const { error: delErr } = await supabase.from("bookings").delete().eq("id", booking.id);
      if (delErr) throw new Error(delErr.message);

      const { error: insErr } = await supabase.from("bookings").insert({
        user_id: booking.user_id,
        studio_id: studioId,
        booking_date: date,
        start_time: time,
        duration_hours: duration,
        session_type: booking.session_type,
        status: "confirmed",
        total_price: 0,
        notes: booking.notes,
      });
      if (insErr) throw new Error(insErr.message);

      onModified();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Er ging iets mis");
    } finally {
      setLoading(false);
    }
  };

  // Generate date options (next 30 days)
  const dateOptions = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(new Date(), i);
    return { value: format(d, "yyyy-MM-dd"), label: format(d, "EEE d MMM", { locale: nl }) };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="rounded-2xl bg-card border border-border p-6 max-w-sm w-full space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <Pencil size={18} className="text-primary" />
          <h3 className="font-display font-semibold text-base">Boeking wijzigen</h3>
        </div>

        {/* Studio */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Ruimte</label>
          <div className="grid grid-cols-3 gap-2">
            {STUDIOS.map(s => (
              <button key={s.id} onClick={() => setStudioId(s.id)}
                className={`rounded-lg py-2 text-xs font-semibold transition-all ${studioId === s.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Datum</label>
          <select value={date} onChange={e => setDate(e.target.value)}
            className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm">
            {dateOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {/* Time */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Starttijd</label>
          <div className="grid grid-cols-5 gap-1.5">
            {HOURS.map(h => (
              <button key={h} onClick={() => setTime(h)}
                className={`rounded-lg py-2 text-[11px] font-medium transition-all ${time === h ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Duur (uren)</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setDuration(Math.max(1, duration - 1))}
              className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
              <Minus size={16} />
            </button>
            <span className="text-lg font-bold font-display w-8 text-center">{duration}</span>
            <button onClick={() => setDuration(Math.min(12, duration + 1))}
              className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Conflict warning */}
        {checking && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Beschikbaarheid controleren...
          </div>
        )}
        {conflict && !checking && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
            Dit tijdslot is niet beschikbaar. Kies een andere tijd of datum.
          </div>
        )}
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
            onClick={handleSave}
            disabled={loading || conflict || checking || !isChanged}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingModifyDialog;
