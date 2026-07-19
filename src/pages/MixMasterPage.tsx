import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { redirectToExternal } from "@/lib/redirect";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { motion } from "framer-motion";
import { Upload, ChevronLeft, Loader2, Music, Plus, Minus, Crown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { inlineToast as toast } from "@/components/InlineToast";
import AuthGateDialog from "@/components/AuthGateDialog";
import SEO from "@/components/SEO";

const MixMasterPage = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { mixMasterPricing, membershipTiers } = useAppConfig();
  const BASE_PRICE = mixMasterPricing.basePrice;

  const [trackCount, setTrackCount] = useState(1);
  const [turnaround, setTurnaround] = useState<"standard" | "fast">("standard");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [reference, setReference] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memberTier, setMemberTier] = useState<string | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const checkMembership = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data?.subscribed) {
          setMemberTier(data.plan || "basic");
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("membership").eq("id", user.id).single();
        if (profile?.membership) setMemberTier(profile.membership);
      } catch {}
    };
    checkMembership();
  }, [user]);


  const tierConfig = membershipTiers.find(t => t.id === memberTier?.toLowerCase());
  const discount = tierConfig?.discount || 0;
  // Fast-track (48h) carries a 50% surcharge — mirrored server-side
  const pricePerTrack = Math.round(BASE_PRICE * (1 - discount) * (turnaround === "fast" ? 1.5 : 1));
  const totalPrice = trackCount * pricePerTrack;

  const handleSubmit = async () => {
    if (!user) {
      setShowAuthGate(true);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          booking_data: {
            type: "mix-master",
            track_count: trackCount,
            turnaround,
            description,
            style,
            reference: reference || null,
          },
        },
      });

      if (error) throw error;
      if (data?.url) {
        redirectToExternal(data.url);
      } else {
        throw new Error("No checkout URL");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t("paymentCreateError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <SEO title="Mix & Master — Uprising Studio" description="Professionele mix- en masteringservice voor je tracks. Upload, betaal en ontvang radio-ready audio." path="/mix-master" />
      <AuthGateDialog
        open={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        onAuthenticated={() => { setShowAuthGate(false); }}
        context="service"
      />
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-xl" style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-lg font-bold font-display">{t("mixMasterService")}</h1>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5 pb-28" data-toast-section>
        <div>
          <label className="text-sm font-medium mb-3 block">{t("howManyTracks")}</label>
          <div className="flex items-center justify-center gap-5">
            <button onClick={() => setTrackCount(Math.max(1, trackCount - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-card border border-border hover:border-primary/30 transition-all active:scale-95">
              <Minus size={20} />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold font-display text-primary">{trackCount}</span>
              <span className="text-xs text-muted-foreground">{trackCount === 1 ? "track" : "tracks"}</span>
            </div>
            <button onClick={() => setTrackCount(trackCount + 1)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-card border border-border hover:border-primary/30 transition-all active:scale-95">
              <Plus size={20} />
            </button>
          </div>
          <div className="mt-3 rounded-xl card-premium border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {trackCount} × €{pricePerTrack} = <span className="font-bold text-primary text-lg">€{totalPrice}</span>
            </p>
            {discount > 0 && (
              <p className="text-[10px] text-success font-semibold mt-1 flex items-center justify-center gap-1">
                <Crown size={10} /> {lang === "nl" ? `${discount * 100}% member korting` : `${discount * 100}% member discount`}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">{t("includingMixMaster")}</p>
          </div>

          {/* Turnaround: standard vs 48h fast-track */}
          <div className="mt-3">
            <label className="text-sm font-medium mb-2 block">{lang === "nl" ? "Levertijd" : "Turnaround"}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTurnaround("standard")}
                className={`rounded-xl border p-3 text-left transition-all ${turnaround === "standard" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <p className="text-sm font-semibold">{lang === "nl" ? "Standaard" : "Standard"}</p>
                <p className="text-[11px] text-muted-foreground">{lang === "nl" ? "±7 dagen" : "±7 days"}</p>
              </button>
              <button
                onClick={() => setTurnaround("fast")}
                className={`rounded-xl border p-3 text-left transition-all ${turnaround === "fast" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <p className="text-sm font-semibold">⚡ Fast-track</p>
                <p className="text-[11px] text-muted-foreground">{lang === "nl" ? "48 uur (+50%)" : "48 hours (+50%)"}</p>
              </button>
            </div>
          </div>

          {/* What's included — human premium positioning vs. AI mastering */}
          <div className="mt-3 rounded-xl bg-card border border-border p-4 space-y-1.5">
            <p className="text-xs font-semibold">{lang === "nl" ? "Inbegrepen" : "Included"}</p>
            {[
              lang === "nl" ? "Gemixt & gemasterd door een engineer, geen AI-preset" : "Mixed & mastered by an engineer, not an AI preset",
              lang === "nl" ? "2 revisierondes inbegrepen" : "2 revision rounds included",
              lang === "nl" ? "Levering in alle formaten (streaming, club, social)" : "Delivery in all formats (streaming, club, social)",
            ].map((line) => (
              <p key={line} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="text-success mt-px">✓</span> {line}
              </p>
            ))}
          </div>

          {/* Member pricing tiers */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5">
              <Crown size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Pro Member</span>
              <span className="ml-auto text-xs text-muted-foreground line-through">€{BASE_PRICE}</span>
              <span className="text-sm font-bold text-primary">€{Math.round(BASE_PRICE * (1 - mixMasterPricing.proDiscount))}</span>
              <span className="text-[10px] font-semibold text-success bg-success/20 px-1.5 py-0.5 rounded-full">-{mixMasterPricing.proDiscount * 100}%</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5">
              <Crown size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Unlimited Member</span>
              <span className="ml-auto text-xs text-muted-foreground line-through">€{BASE_PRICE}</span>
              <span className="text-sm font-bold text-primary">€{Math.round(BASE_PRICE * (1 - mixMasterPricing.unlimitedDiscount))}</span>
              <span className="text-[10px] font-semibold text-success bg-success/20 px-1.5 py-0.5 rounded-full">-{mixMasterPricing.unlimitedDiscount * 100}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">{t("perTrack")}</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("trackUpload")}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.flac,audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/50 py-8 transition-colors hover:border-primary/40 active:scale-[0.99]"
          >
            <Upload size={28} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("dragDropUpload")}</span>
            <span className="text-xs text-muted-foreground">.wav, .mp3, .flac</span>
          </button>
          {uploadedFiles.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {uploadedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2">
                  <Music size={14} className="text-primary shrink-0" />
                  <span className="text-xs truncate flex-1">{file.name}</span>
                  <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 hover:text-destructive">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("projectDescription")}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={t("describeYourProject")}
            className="w-full rounded-xl bg-card border border-border p-4 text-sm resize-none h-28 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("preferredStyle")}</label>
          <input value={style} onChange={(e) => setStyle(e.target.value)}
            placeholder="Hip-hop, R&B, Pop..."
            className="w-full rounded-xl bg-card border border-border p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("referenceTracks")}</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="Spotify / YouTube link"
            className="w-full rounded-xl bg-card border border-border p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
        </div>

        {description.trim() && style.trim() && (
          <button onClick={handleSubmit} disabled={isLoading}
            className="w-full rounded-xl gradient-primary text-primary-foreground shadow-glow p-4 text-left transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50">
            {isLoading ? (
              <div className="flex items-center justify-center py-2"><Loader2 size={20} className="animate-spin text-primary-foreground" /></div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary-foreground/80">Mix & Master</p>
                  <p className="font-semibold">{trackCount} {trackCount === 1 ? "track" : "tracks"}</p>
                  <p className="text-xs text-primary-foreground/80">€{pricePerTrack} {t("perTrack")}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">€{totalPrice}</p>
                  <p className="text-xs font-medium mt-1">{t("continueBtn")} →</p>
                </div>
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default MixMasterPage;
