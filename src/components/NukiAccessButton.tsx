import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/lib/i18n";
import { Lock, Unlock, LockKeyhole, Clock, AlertTriangle, Loader2, CheckCircle, DoorOpen, LifeBuoy } from "lucide-react";
import { inlineToast as toast } from "@/components/InlineToast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface NukiAccessButtonProps {
  bookingId: string;
  bookingDate: string;
  startTime: string;
  durationHours: number;
  status: string;
}

type AccessState = "no_access" | "upcoming" | "active" | "expired" | "revoked";

const NukiAccessButton = ({ bookingId, bookingDate, startTime, durationHours, status }: NukiAccessButtonProps) => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpMessage, setHelpMessage] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user || status !== "confirmed") {
      setLoading(false);
      return;
    }
    loadAccess();
  }, [user, bookingId, status]);

  const loadAccess = async () => {
    const { data } = await (supabase.from as any)("booking_access")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();
    setAccess(data);
    setLoading(false);
  };

  const accessState = useMemo((): AccessState => {
    if (!access) return "no_access";
    if (access.access_status === "revoked") return "revoked";
    const start = new Date(access.access_start);
    const end = new Date(access.access_end);
    if (now < start) return "upcoming";
    if (now > end) return "expired";
    return "active";
  }, [access, now]);

  const handleDoorAction = async (doorAction: "unlock" | "open" | "lock") => {
    if (!access) return;
    setUnlocking(true);
    setUnlockSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=unlock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ booking_access_id: access.id, door_action: doorAction }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Fout bij openen");
      } else {
        setUnlockSuccess(doorAction);
        toast.success(
          doorAction === "open"
            ? (t("doorOpenedShort"))
            : (t("doorUnlockedShort"))
        );
        setTimeout(() => setUnlockSuccess(null), 5000);
        loadAccess();
      }
    } catch {
      toast.error(t("connectionError"));
    } finally {
      setUnlocking(false);
    }
  };

  const handleAccessHelp = async () => {
    if (!access) return;
    setHelpLoading(true);
    setHelpMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=access-help`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ booking_access_id: access.id }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || t("connectionError"));
      } else {
        setHelpMessage(result.message);
        if (result.remote_unlock) toast.success(t("doorOpenedShort"));
      }
    } catch {
      toast.error(t("connectionError"));
    } finally {
      setHelpLoading(false);
    }
  };

  if (loading) return null;
  if (status !== "confirmed") return null;
  if (accessState === "no_access") return null;

  const labels: Record<AccessState, { nl: string; en: string }> = {
    no_access: { nl: "", en: "" },
    upcoming: { nl: "Toegang binnenkort actief", en: "Access activating soon" },
    active: { nl: "Toegang actief", en: "Access active" },
    expired: { nl: "Toegang verlopen", en: "Access expired" },
    revoked: { nl: "Toegang ingetrokken", en: "Access revoked" },
  };

  const statusColors: Record<AccessState, string> = {
    no_access: "",
    upcoming: "bg-warning/10 border-warning/30 text-warning",
    active: "bg-success/10 border-success/30 text-success",
    expired: "bg-muted border-border text-muted-foreground",
    revoked: "bg-destructive/10 border-destructive/30 text-destructive",
  };

  const StatusIcon = accessState === "active" ? Unlock :
    accessState === "upcoming" ? Clock :
    accessState === "expired" ? Lock :
    AlertTriangle;

  return (
    <div className={`mt-3 rounded-xl border p-3 ${statusColors[accessState]}`} data-toast-section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon size={14} />
          <span className="text-xs font-semibold">
            {labels[accessState][lang === "nl" ? "nl" : "en"]}
          </span>
        </div>
        {unlockSuccess && (
          <div className="flex items-center gap-1 text-success">
            <CheckCircle size={12} />
            <span className="text-[10px] font-semibold">
              {unlockSuccess === "open"
                ? (t("opened"))
                : (t("unlocked"))}
            </span>
          </div>
        )}
      </div>

      {accessState === "active" && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={() => handleDoorAction("lock")}
            disabled={unlocking}
            className="flex items-center justify-center gap-2 rounded-lg bg-muted border border-border py-2.5 text-sm font-semibold text-foreground active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {unlocking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LockKeyhole size={14} />
            )}
            {t("lockBtn")}
          </button>

          <button
            onClick={() => setConfirmOpen(true)}
            disabled={unlocking}
            className="flex items-center justify-center gap-2 rounded-lg bg-warning/10 border border-warning/30 py-2.5 text-sm font-semibold text-warning active:scale-[0.98] transition-all disabled:opacity-60"
          >
            <DoorOpen size={14} />
            {t("openBtn")}
          </button>
        </div>
      )}

      {/* Confirmation dialog for Open */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" />
              {t("areYouSure")}
            </DialogTitle>
            <DialogDescription>
              {lang === "nl"
                ? "Je gaat nu de deur openen. Dit is anders dan ontgrendelen — de deur wordt direct geopend."
                : "You are about to open the door. This is different from unlocking — the door will open immediately."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <DialogClose asChild>
              <button className="flex-1 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-foreground">
                {t("cancel")}
              </button>
            </DialogClose>
            <button
              onClick={() => {
                setConfirmOpen(false);
                handleDoorAction("open");
              }}
              className="flex-1 rounded-lg bg-warning text-warning-foreground py-2.5 text-sm font-semibold"
            >
              {t("yesOpenDoor")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Panic button: "I can't get in" — remote-unlock fallback + team alert */}
      {accessState === "active" && (
        <button
          onClick={handleAccessHelp}
          disabled={helpLoading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 py-2 text-xs font-semibold text-destructive active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {helpLoading ? <Loader2 size={12} className="animate-spin" /> : <LifeBuoy size={12} />}
          {lang === "nl" ? "Ik kom er niet in" : "I can't get in"}
        </button>
      )}

      {helpMessage && (
        <p className="mt-2 rounded-lg bg-card/60 border border-border p-2.5 text-[11px] leading-relaxed text-foreground">
          {helpMessage}
        </p>
      )}

      {accessState === "upcoming" && access && (
        <p className="text-[10px] mt-1 opacity-70">
          {lang === "nl"
            ? `Actief vanaf ${new Date(access.access_start).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`
            : `Active from ${new Date(access.access_start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
        </p>
      )}
    </div>
  );
};

export default NukiAccessButton;
