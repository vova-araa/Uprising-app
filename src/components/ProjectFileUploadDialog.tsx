import { useState } from "react";
import { Upload, Loader2, X, FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onUploaded: () => void;
}

const ProjectFileUploadDialog = ({ open, onOpenChange, project, onUploaded }: Props) => {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open || !project || !user) return null;

  const submit = async () => {
    if (files.length === 0) {
      setError(lang === "nl" ? "Kies eerst één of meer bestanden." : "Pick one or more files first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "bin";
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
        const path = `${user.id}/projects/${project.id}-${Date.now()}-${safe}.${ext}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, file);
        if (upErr) throw new Error(upErr.message);
        uploaded.push(path);
      }

      const nextLinks = [...(project.reference_links || []), ...uploaded];
      // Attaching the files also clears the block flag so the "gepauzeerd"
      // banner disappears and staff sees the new files on the project.
      const { error: updErr } = await supabase
        .from("projects")
        .update({ reference_links: nextLinks, staff_notes: null, updated_at: new Date().toISOString() } as any)
        .eq("id", project.id);
      if (updErr) throw new Error(updErr.message);

      // Best-effort: let the team know files arrived (non-blocking).
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: lang === "nl" ? "Bestanden geüpload" : "Files uploaded",
        message: lang === "nl"
          ? `Je uploadde ${uploaded.length} bestand(en) voor '${project.title}'. Het team gaat ermee aan de slag.`
          : `You uploaded ${uploaded.length} file(s) for '${project.title}'. The team will pick it up.`,
        type: "success",
        link: "/account?tab=projects",
      });

      onUploaded();
      onOpenChange(false);
      setFiles([]);
    } catch (err: any) {
      setError(err.message || (lang === "nl" ? "Upload mislukt" : "Upload failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-6" onClick={() => !loading && onOpenChange(false)}>
      <div className="animate-fade-in rounded-2xl card-premium border border-border p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <FileUp size={18} className="text-primary" />
          <h3 className="font-display font-semibold text-base">
            {lang === "nl" ? "Bestanden uploaden" : "Upload files"}
          </h3>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            aria-label={lang === "nl" ? "Sluiten" : "Close"}
            className="ml-auto text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {lang === "nl"
            ? `Upload de gevraagde bestanden voor '${project.title}'. Zodra ze binnen zijn gaat het team verder.`
            : `Upload the requested files for '${project.title}'. Once they arrive the team continues.`}
        </p>

        {files.length > 0 ? (
          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-none">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/60 border border-border px-3 py-2">
                <span className="truncate text-xs text-muted-foreground">{f.name}</span>
                <button
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  aria-label={lang === "nl" ? "Verwijderen" : "Remove"}
                  className="shrink-0 text-muted-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <label className="flex items-center justify-center gap-2 rounded-lg bg-secondary border border-dashed border-border py-6 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:border-primary/40">
          <Upload size={16} />
          {lang === "nl" ? "Kies bestand(en)" : "Choose file(s)"}
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
          />
        </label>

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
            disabled={loading || files.length === 0}
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

export default ProjectFileUploadDialog;
