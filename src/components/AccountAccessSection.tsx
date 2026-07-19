import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/lib/i18n";
import { Lock, Unlock, LockKeyhole, Loader2, CheckCircle, Clock, DoorOpen, AlertTriangle } from "lucide-react";
import { inlineToast as toast } from "@/components/InlineToast";
import { format } from "date-fns";
import { nl as nlLocale, enUS } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const UNLOCK_LOCKOUT_MS = 4000;

const getFriendlyUnlockError = (status: number, fallback: string | undefined, lang: string, t: (key: any) => string) => {
  if (status === 403 && fallback?.toLowerCase().includes("nog niet actief")) {
    return t("accessNotActiveYet");
  }
  if (status === 403 && fallback?.toLowerCase().includes("verlopen")) {
    return t("accessExpired");
  }
  if (status === 503) {
    return t("noConnectionLock");
  }
  if (status === 409 || status === 429) {
    return t("requestStillProcessing");
  }
  return fallback || (t("doorCouldNotOpen"));
};

const studioNameMap: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
};

interface AccessRecord {
  id: string;
  booking_id: string | null;
  access_start: string;
  access_end: string;
  access_status: string;
  smartlock_id: string;
  studio_id: string;
}

interface BookingWithAccess {
  id: string;
  studio_id: string;
  booking_date: string;
  start_time: string;
  duration_hours: number;
  status: string;
  access?: AccessRecord;
}

const AccountAccessSection = () => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === "nl" ? nlLocale : enUS;
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState<string | null>(null);
  const [lockoutActive, setLockoutActive] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [bookingsWithAccess, setBookingsWithAccess] = useState<BookingWithAccess[]>([]);
  const [unlimitedAccess, setUnlimitedAccess] = useState<AccessRecord | null>(null);
  const unlockInFlightRef = useRef(false);
  const lockoutTimerRef = useRef<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (lockoutTimerRef.current) {
        window.clearTimeout(lockoutTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const unlimitedThreshold = new Date(nowDate);
    unlimitedThreshold.setFullYear(unlimitedThreshold.getFullYear() + 5);

    // Find active access first and classify legacy 24/7 access (old records had booking_id)
    const { data: activeAccesses } = await supabase
      .from("booking_access")
      .select("*")
      .eq("user_id", user.id)
      .eq("access_status", "active")
      .lte("access_start", nowIso)
      .gte("access_end", nowIso)
      .order("access_end", { ascending: false });

    const unlimitedCandidate = (activeAccesses || []).find((a: any) =>
      a.booking_id === null || new Date(a.access_end) > unlimitedThreshold
    );

    if (unlimitedCandidate) {
      setUnlimitedAccess(unlimitedCandidate as AccessRecord);
      setBookingsWithAccess([]);
      setLoading(false);
      return;
    }

    setUnlimitedAccess(null);

    const todayStr = new Date().toISOString().split("T")[0];

    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, studio_id, booking_date, start_time, duration_hours, status")
      .eq("status", "confirmed")
      .gte("booking_date", todayStr)
      .order("booking_date", { ascending: true });

    if (!bookings || bookings.length === 0) {
      setBookingsWithAccess([]);
      setLoading(false);
      return;
    }

    const bookingIds = bookings.map(b => b.id);
    const { data: accessRecords } = await (supabase.from as any)("booking_access")
      .select("*")
      .in("booking_id", bookingIds);

    const accessMap = new Map<string, AccessRecord>();
    if (accessRecords) {
      for (const a of accessRecords) {
        if (a.booking_id) accessMap.set(a.booking_id, a);
      }
    }

    const merged = bookings.map(b => ({
      ...b,
      access: accessMap.get(b.id),
    }));

    setBookingsWithAccess(merged);
    setLoading(false);
  };

  // For session-based access
  const relevantBooking = useMemo(() => {
    if (unlimitedAccess) return null; // handled separately
    if (bookingsWithAccess.length === 0) return null;

    for (const b of bookingsWithAccess) {
      if (!b.access) continue;
      const start = new Date(b.access.access_start);
      const end = new Date(b.access.access_end);
      if (now >= start && now <= end && b.access.access_status !== "revoked") {
        return { booking: b, state: "active" as const };
      }
    }

    for (const b of bookingsWithAccess) {
      if (!b.access) continue;
      const start = new Date(b.access.access_start);
      if (now < start && b.access.access_status !== "revoked") {
        return { booking: b, state: "upcoming" as const };
      }
    }

    return null;
  }, [bookingsWithAccess, now, unlimitedAccess]);

  // Active access record (unlimited or session-based)
  const activeAccessRecord = unlimitedAccess || relevantBooking?.booking.access || null;

  const handleDoorAction = async (doorAction: "unlock" | "open" | "lock") => {
    const access = activeAccessRecord;
    if (!access) return;

    if (unlockInFlightRef.current || unlocking || lockoutActive) {
      return;
    }

    unlockInFlightRef.current = true;
    setUnlocking(true);
    setUnlockSuccess(null);
    setLastError(null);
    setLockoutActive(true);

    if (lockoutTimerRef.current) {
      window.clearTimeout(lockoutTimerRef.current);
    }
    lockoutTimerRef.current = window.setTimeout(() => {
      setLockoutActive(false);
    }, UNLOCK_LOCKOUT_MS);

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

      let result: any = null;
      try {
        result = await res.json();
      } catch {
        result = null;
      }

      if (!res.ok) {
        setLastError(getFriendlyUnlockError(res.status, result?.error, lang, t));
      } else {
        setUnlockSuccess(doorAction);
        setLastError(null);
        setTimeout(() => setUnlockSuccess(null), 5000);
        loadData();
      }
    } catch {
      setLastError(
        lang === "nl"
          ? "Er is tijdelijk geen verbinding met het slot."
          : "There is temporarily no connection to the lock."
      );
    } finally {
      setUnlocking(false);
      unlockInFlightRef.current = false;
    }
  };

  if (loading) {
    return (
      <motion.div variants={item} className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <DoorOpen size={16} className="text-primary" />
          <h3 className="font-semibold font-display text-sm">
            {t("access")}
          </h3>
        </div>
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      </motion.div>
    );
  }

  const renderDoorControls = () => (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleDoorAction("lock")}
          disabled={unlocking || lockoutActive}
          className="flex items-center justify-center gap-2 rounded-xl bg-muted border border-border py-3 text-sm font-semibold text-foreground active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {unlocking ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <LockKeyhole size={16} />
          )}
          {t("lockBtn")}
        </button>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={unlocking || lockoutActive}
          className="flex items-center justify-center gap-2 rounded-xl bg-warning/10 border border-warning/30 py-3 text-sm font-semibold text-warning active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <DoorOpen size={16} />
          {t("openBtn")}
        </button>
      </div>

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

      {lastError && (
        <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
          <p className="text-xs text-destructive font-medium">{lastError}</p>
        </div>
      )}

      {unlockSuccess && (
        <div className="mt-3 rounded-lg bg-success/10 border border-success/20 px-3 py-2.5">
          <p className="text-xs text-success font-medium">
            {unlockSuccess === "open"
              ? (t("doorOpened"))
              : (t("doorUnlocked"))}
          </p>
        </div>
      )}
    </>
  );

  // ===== UNLIMITED 24/7 ACCESS — just door buttons, no session info =====
  if (unlimitedAccess) {
    return (
      <motion.div variants={item} className="rounded-xl bg-card border border-success/30 p-5" data-toast-section>
        <div className="flex items-center gap-2 mb-3">
          <DoorOpen size={16} className="text-success" />
          <h3 className="font-semibold font-display text-sm">
            {t("access")}
          </h3>
        </div>

        <div className="rounded-xl bg-success/5 border border-success/20 p-4 mb-3">
          <div className="flex items-center gap-2">
            <LockKeyhole size={14} className="text-success" />
            <span className="text-xs font-semibold text-success">
              {t("unlimitedAccess")}
            </span>
          </div>
        </div>

        {renderDoorControls()}
      </motion.div>
    );
  }

  // ===== NO ACCESS =====
  if (!relevantBooking) {
    return (
      <motion.div variants={item} className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <DoorOpen size={16} className="text-primary" />
          <h3 className="font-semibold font-display text-sm">
            {t("access")}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold font-display text-muted-foreground">—</span>
          <p className="text-xs text-muted-foreground">
            {lang === "nl"
              ? "Je hebt momenteel geen actieve deurtoegang. De admin kan toegang voor je activeren."
              : "You currently have no active door access. The admin can activate access for you."}
          </p>
        </div>
      </motion.div>
    );
  }

  // ===== SESSION-BASED ACCESS =====
  const { booking, state } = relevantBooking;
  const studioName = studioNameMap[booking.studio_id] || booking.studio_id;
  const sessionEnd = (() => {
    const [h, m] = booking.start_time.split(":").map(Number);
    const d = new Date(`${booking.booking_date}T00:00:00`);
    d.setHours(h + booking.duration_hours, m, 0, 0);
    return d;
  })();

  if (state === "upcoming") {
    const accessStart = new Date(booking.access!.access_start);

    return (
      <motion.div variants={item} className="rounded-xl bg-card border border-primary/20 p-5" data-toast-section>
        <div className="flex items-center gap-2 mb-3">
          <DoorOpen size={16} className="text-primary" />
          <h3 className="font-semibold font-display text-sm">
            {t("access")}
          </h3>
        </div>
        <div className="rounded-xl bg-warning/5 border border-warning/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-warning" />
            <span className="text-xs font-semibold text-warning">
              {t("activatingSoon")}
            </span>
          </div>
          <p className="text-sm font-semibold">{studioName}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(booking.booking_date), "d MMMM", { locale })} • {booking.start_time} • {booking.duration_hours}h
          </p>
          <p className="text-[11px] text-muted-foreground mt-2">
            {lang === "nl"
              ? `Je toegang wordt ${format(accessStart, "d MMMM 'om' HH:mm", { locale: nlLocale })} geactiveerd.`
              : `Your access will be activated on ${format(accessStart, "MMMM d 'at' HH:mm", { locale: enUS })}.`}
          </p>
        </div>
      </motion.div>
    );
  }

  // Active session-based access
  return (
    <motion.div variants={item} className="rounded-xl bg-card border border-success/30 p-5" data-toast-section>
      <div className="flex items-center gap-2 mb-3">
        <DoorOpen size={16} className="text-success" />
        <h3 className="font-semibold font-display text-sm">
          {t("access")}
        </h3>
      </div>

      <div className="rounded-xl bg-success/5 border border-success/20 p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Unlock size={14} className="text-success" />
          <span className="text-xs font-semibold text-success">
            {t("accessActive")}
          </span>
        </div>
        <p className="text-sm font-semibold">{studioName}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(booking.booking_date), "d MMMM", { locale })} • {booking.start_time} • {booking.duration_hours}h
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {lang === "nl"
            ? `Actief tot ${format(sessionEnd, "HH:mm", { locale: nlLocale })}`
            : `Active until ${format(sessionEnd, "HH:mm", { locale: enUS })}`}
        </p>
      </div>

      {renderDoorControls()}
    </motion.div>
  );
};

export default AccountAccessSection;
