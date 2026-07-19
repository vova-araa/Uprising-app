import { useState } from "react";
import { Video, Sparkles, Loader2, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  kind: "session_video" | "clean_room_photo";
  onSubmitted: () => void;
}

const KIND_META = {
  session_video: {
    icon: Video,
    points: 50,
    titleNl: "Sessievideo uploaden",
    titleEn: "Upload session video",
    descNl: "Deel een video uit je sessie. Na goedkeuring krijg je 50 punten en gebruiken wij 'm voor onze socials (met tag!).",
    descEn: "Share a video from your session. After approval you get 50 points and we'll use it on our socials (with a tag!).",
    accept: "video/*",
  },
  clean_room_photo: {
    icon: Sparkles,
    points: 20,
    titleNl: "Schone ruimte foto",
    titleEn: "Clean room photo",
    descNl: "Ruimte netjes achtergelaten? Maak een foto en verdien 20 punten na goedkeuring.",
    descEn: "Left the room clean? Snap a photo and earn 20 points after approval.",
    accept: "image/*",
  },
} as const;

const SubmissionUploadDialog = ({ open, onOpenChange, booking, kind, onSubmitted }: Props) => {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open || !booking || !user) return null;

  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const needsConsent = kind === "session_video";

  const submit = async () => {
    if (!file) {
      setError(lang === "nl" ? "Kies eerst een bestand." : "Pick a file first.");
      return;
    }
    if (needsConsent && !consent) {
      setError(lang === "nl" ? "Vink de toestemming aan zodat we je video mogen gebruiken." : "Please give permission to use your video.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const ext = file.name.split(".").pop() || (kind === "session_video" ? "mp4" : "jpg");
      const path = `${user.id}/submissions/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("uploads").upload(path, file);
      if (upErr) throw new Error(upErr.message);

      const { error: insErr } = await supabase.from("media_submissions").insert({
        user_id: user.id,
        booking_id: booking.id,
        kind,
        storage_path: path,
        consent: needsConsent ? consent : true,
      });
      if (insErr) throw new Error(insErr.message);

      onSubmitted();
      onOpenChange(false);
      setFile(null);
      setConsent(false);
    } catch (err: any) {
      setError(err.message || (lang === "nl" ? "Upload mislukt" : "Upload failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="rounded-2xl bg-card border border-border p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-primary" />
          <h3 className="font-display font-semibold text-base">
            {lang === "nl" ? meta.titleNl : meta.titleEn}
          </h3>
          <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
            +{meta.points} pt
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {lang === "nl" ? meta.descNl : meta.descEn}
        </p>

        {file ? (
          <div className="flex items-center justify-between rounded-lg bg-secondary/60 border border-border px-3 py-2">
            <span className="truncate text-xs text-muted-foreground">{file.name}</span>
            <button onClick={() => setFile(null)} className="shrink-0 text-muted-foreground">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 rounded-lg bg-secondary border border-dashed border-border py-6 text-xs font-medium text-muted-foreground cursor-pointer">
            <Upload size={16} />
            {lang === "nl" ? "Kies bestand of neem op" : "Choose file or record"}
            <input
              type="file"
              accept={meta.accept}
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        )}

        {needsConsent && (
          <button onClick={() => setConsent(!consent)} className="flex items-start gap-2 text-left">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${consent ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"}`}>
              {consent && <span className="text-[10px] font-bold">✓</span>}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {lang === "nl"
                ? "Ik geef Uprising Studio toestemming om deze video te gebruiken voor social media en promotie."
                : "I give Uprising Studio permission to use this video for social media and promotion."}
            </span>
          </button>
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
            disabled={loading || !file}
            className="flex-1 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {lang === "nl" ? "Insturen" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionUploadDialog;
