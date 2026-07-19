import { useState } from "react";
import { AlertTriangle, Camera, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/lib/i18n";

const CATEGORIES = [
  { id: "equipment", nl: "Apparatuur kapot", en: "Broken equipment" },
  { id: "access", nl: "Toegangsprobleem", en: "Access problem" },
  { id: "cleanliness", nl: "Ruimte niet schoon", en: "Room not clean" },
  { id: "sound", nl: "Geluidsprobleem", en: "Sound issue" },
  { id: "other", nl: "Anders", en: "Other" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  onReported: (result: { room_blocked?: boolean; compensated?: number }) => void;
}

const FaultReportDialog = ({ open, onOpenChange, booking, onReported }: Props) => {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [category, setCategory] = useState<string>("equipment");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open || !booking) return null;

  const submit = async () => {
    if (!description.trim()) {
      setError(lang === "nl" ? "Beschrijf kort wat er mis is." : "Briefly describe what's wrong.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let photoPath: string | undefined;
      if (photo && user) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${user.id}/faults/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, photo);
        if (!upErr) photoPath = path;
      }

      const { data, error: fnErr } = await supabase.functions.invoke("report-fault", {
        body: {
          studio_id: booking.studio_id,
          booking_id: booking.id,
          category,
          description: description.trim(),
          photo_path: photoPath,
        },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message || "Er ging iets mis");

      onReported(data);
      onOpenChange(false);
      setDescription("");
      setPhoto(null);
      setCategory("equipment");
    } catch (err: any) {
      setError(err.message || (lang === "nl" ? "Er ging iets mis" : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="rounded-2xl bg-card border border-border p-6 max-w-sm w-full space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-warning" />
          <h3 className="font-display font-semibold text-base">
            {lang === "nl" ? "Storing melden" : "Report a fault"}
          </h3>
        </div>

        <p className="text-xs text-muted-foreground">
          {lang === "nl"
            ? "Het team wordt direct op de hoogte gebracht. Bij een kapotte ruimte word je automatisch gecompenseerd."
            : "The team is alerted immediately. If the room is unusable you are compensated automatically."}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-lg py-2 px-2 text-xs font-semibold transition-all ${category === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {lang === "nl" ? c.nl : c.en}
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={lang === "nl" ? "Wat is er precies aan de hand?" : "What exactly is wrong?"}
          rows={3}
          className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm resize-none"
        />

        {photo ? (
          <div className="flex items-center justify-between rounded-lg bg-secondary/60 border border-border px-3 py-2">
            <span className="truncate text-xs text-muted-foreground">{photo.name}</span>
            <button onClick={() => setPhoto(null)} className="shrink-0 text-muted-foreground">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 rounded-lg bg-secondary border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground cursor-pointer">
            <Camera size={14} />
            {lang === "nl" ? "Foto toevoegen (optioneel)" : "Add photo (optional)"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
          </label>
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
            {lang === "nl" ? "Terug" : "Back"}
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 rounded-xl bg-warning px-4 py-2.5 text-sm font-semibold text-warning-foreground flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            {lang === "nl" ? "Melden" : "Report"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaultReportDialog;
