import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inlineToast as toast } from "@/components/InlineToast";
import { format, addYears } from "date-fns";
import { nl } from "date-fns/locale";
import { Lock, Unlock, Loader2, Calendar, Clock, Shield, Trash2, Plus, Check, DoorOpen, AlertTriangle, LockKeyhole } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface AdminUserAccessProps {
  userId: string;
  userName: string;
}

const SMARTLOCK_ID = "22742231871";
const STUDIO_ID = "studio-1";

type AccessType = "session" | "unlimited";

const AdminUserAccess = ({ userId, userName }: AdminUserAccessProps) => {
  const [existingAccess, setExistingAccess] = useState<any[]>([]);
  const [futureBookings, setFutureBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [accessType, setAccessType] = useState<AccessType>("session");
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [doorAction, setDoorAction] = useState<{ accessId: string; action: "unlock" | "open" | "lock" } | null>(null);
  const [doorLoading, setDoorLoading] = useState(false);
  const [confirmOpenDialog, setConfirmOpenDialog] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load existing access for this user
      const { data: access } = await supabase
        .from("booking_access")
        .select("*")
        .eq("user_id", userId)
        .order("access_start", { ascending: false });
      setExistingAccess(access || []);

      // Load future confirmed bookings without access yet
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "confirmed")
        .gte("booking_date", todayStr)
        .order("booking_date", { ascending: true });

      // Filter out bookings that already have access
      const accessBookingIds = new Set((access || []).map((a: any) => a.booking_id));
      setFutureBookings((bookings || []).filter((b: any) => !accessBookingIds.has(b.id)));
    } catch (err) {
      console.error("Failed to load access data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const grantSessionAccess = async (bookingId: string) => {
    const booking = futureBookings.find((b) => b.id === bookingId);
    if (!booking) return;

    setGranting(true);
    try {
      const startHour = parseInt(booking.start_time.split(":")[0]);
      const accessStart = new Date(`${booking.booking_date}T${String(startHour).padStart(2, "0")}:00:00`);
      accessStart.setMinutes(accessStart.getMinutes() - 15); // 15 min early
      const accessEnd = new Date(`${booking.booking_date}T${String(startHour + booking.duration_hours).padStart(2, "0")}:00:00`);

      const { error } = await supabase.from("booking_access").insert({
        booking_id: bookingId,
        user_id: userId,
        smartlock_id: SMARTLOCK_ID,
        studio_id: booking.studio_id,
        access_start: accessStart.toISOString(),
        access_end: accessEnd.toISOString(),
        access_status: "active",
      });

      if (error) throw error;
      toast.success(`Sessie-toegang verleend aan ${userName}`);
      await loadData();
      setShowGrant(false);
      setSelectedBooking(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Toegang verlenen mislukt");
    } finally {
      setGranting(false);
    }
  };

  const grantUnlimitedAccess = async () => {
    setGranting(true);
    try {
      const now = new Date();
      const farFuture = addYears(now, 10);

      // Create standalone unlimited access — no fake booking needed
      const { error } = await supabase.from("booking_access").insert({
        user_id: userId,
        smartlock_id: SMARTLOCK_ID,
        studio_id: STUDIO_ID,
        access_start: now.toISOString(),
        access_end: farFuture.toISOString(),
        access_status: "active",
      });

      if (error) throw error;
      toast.success(`24/7 toegang verleend aan ${userName}`);
      await loadData();
      setShowGrant(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Toegang verlenen mislukt");
    } finally {
      setGranting(false);
    }
  };

  const revokeAccess = async (accessId: string) => {
    setRevoking(accessId);
    try {
      const { error } = await supabase
        .from("booking_access")
        .update({ access_status: "revoked" })
        .eq("id", accessId);
      if (error) throw error;
      toast.success("Toegang ingetrokken");
      await loadData();
    } catch {
      toast.error("Intrekken mislukt");
    } finally {
      setRevoking(null);
    }
  };

  const handleDoorAction = async (accessId: string, action: "unlock" | "open" | "lock") => {
    setDoorLoading(true);
    setDoorAction({ accessId, action });
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
          body: JSON.stringify({ booking_access_id: accessId, door_action: action }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Fout bij deur actie");
      } else {
        const msg = action === "open" ? "Deur geopend!" : action === "lock" ? "Deur vergrendeld!" : "Deur ontgrendeld!";
        toast.success(msg);
      }
    } catch {
      toast.error("Verbindingsfout");
    } finally {
      setDoorLoading(false);
      setDoorAction(null);
    }
  };

  const getStudioName = (sid: string) => {
    if (sid === "studio-1") return "Studio 1";
    if (sid === "studio-2") return "Studio 2";
    if (sid === "content-room") return "Content Room";
    return sid;
  };

  const getAccessLabel = (a: any) => {
    const isUnlimited = a.access_end && new Date(a.access_end).getFullYear() > new Date().getFullYear() + 5;
    if (isUnlimited) return "24/7 Unlimited";
    return `${format(new Date(a.access_start), "d MMM HH:mm", { locale: nl })} – ${format(new Date(a.access_end), "HH:mm", { locale: nl })}`;
  };

  const isActive = (a: any) => {
    const now = new Date();
    return a.access_status === "active" && new Date(a.access_start) <= now && new Date(a.access_end) >= now;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 size={16} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-3 mt-1" data-toast-section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Lock size={13} className="text-primary" />
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Toegang</p>
        </div>
        <button
          onClick={() => setShowGrant(!showGrant)}
          className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary"
        >
          <Plus size={12} /> Toewijzen
        </button>
      </div>

      {/* Grant access form */}
      {showGrant && (
        <div className="rounded-xl bg-secondary/60 p-3 mb-3 space-y-3">
          {/* Access type selector */}
          <div className="flex gap-2">
            <button
              onClick={() => { setAccessType("session"); setSelectedBooking(null); }}
              className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition-all ${
                accessType === "session"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              <Calendar size={12} className="inline mr-1" />
              Sessie
            </button>
            <button
              onClick={() => setAccessType("unlimited")}
              className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition-all ${
                accessType === "unlimited"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              <Shield size={12} className="inline mr-1" />
              24/7 Unlimited
            </button>
          </div>

          {accessType === "session" ? (
            <>
              {futureBookings.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-2">
                  Geen toekomstige boekingen zonder toegang
                </p>
              ) : (
                <div className="space-y-1.5">
                  {futureBookings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBooking(b.id)}
                      className={`w-full text-left rounded-lg p-2.5 text-xs transition-all border ${
                        selectedBooking === b.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{getStudioName(b.studio_id)}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(b.booking_date), "d MMM", { locale: nl })}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {b.start_time} • {b.duration_hours}h
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {selectedBooking && (
                <button
                  onClick={() => grantSessionAccess(selectedBooking)}
                  disabled={granting}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-success/20 py-2.5 text-xs font-semibold text-success disabled:opacity-50"
                >
                  {granting ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                  Sessie-toegang verlenen
                </button>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Verleen 24/7 toegang tot de studio. Geldig voor 10 jaar of totdat het wordt ingetrokken.
              </p>
              <button
                onClick={grantUnlimitedAccess}
                disabled={granting}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-success/20 py-2.5 text-xs font-semibold text-success disabled:opacity-50"
              >
                {granting ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                24/7 Toegang verlenen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Existing access list */}
      {existingAccess.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Geen toegang toegewezen</p>
      ) : (
        <div className="space-y-1.5">
          {existingAccess.map((a) => {
            const active = isActive(a);
            const isUnlimited = a.access_end && new Date(a.access_end).getFullYear() > new Date().getFullYear() + 5;
            const revoked = a.access_status === "revoked";
            const expired = !revoked && new Date(a.access_end) < new Date();

            return (
              <div
                key={a.id}
                className={`rounded-lg border p-2.5 space-y-2 ${
                  revoked
                    ? "border-border bg-secondary/30 opacity-50"
                    : active
                    ? "border-success/30 bg-success/5"
                    : expired
                    ? "border-border bg-secondary/30 opacity-60"
                    : "border-primary/20 bg-primary/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {isUnlimited ? (
                      <Shield size={13} className={active ? "text-success" : "text-muted-foreground"} />
                    ) : (
                      <Clock size={13} className={active ? "text-success" : "text-muted-foreground"} />
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold truncate">
                        {isUnlimited ? "24/7 Unlimited" : getStudioName(a.studio_id)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {getAccessLabel(a)}
                        {revoked && " • Ingetrokken"}
                        {expired && !revoked && " • Verlopen"}
                        {active && " • Actief"}
                      </p>
                    </div>
                  </div>
                  {a.access_status === "active" && !expired && (
                    <button
                      onClick={() => revokeAccess(a.id)}
                      disabled={revoking === a.id}
                      className="shrink-0 flex items-center gap-1 rounded-lg bg-destructive/20 px-2 py-1 text-[10px] font-semibold text-destructive"
                    >
                      {revoking === a.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      Intrekken
                    </button>
                  )}
                </div>

                {/* Door action buttons for active access */}
                {active && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDoorAction(a.id, "unlock")}
                      disabled={doorLoading && doorAction?.accessId === a.id}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-primary/20 py-1.5 text-[10px] font-semibold text-primary disabled:opacity-50"
                    >
                      {doorLoading && doorAction?.accessId === a.id && doorAction?.action === "unlock"
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Unlock size={10} />}
                      Ontgrendelen
                    </button>
                    <button
                      onClick={() => handleDoorAction(a.id, "lock")}
                      disabled={doorLoading && doorAction?.accessId === a.id}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-muted py-1.5 text-[10px] font-semibold text-muted-foreground disabled:opacity-50"
                    >
                      {doorLoading && doorAction?.accessId === a.id && doorAction?.action === "lock"
                        ? <Loader2 size={10} className="animate-spin" />
                        : <LockKeyhole size={10} />}
                      Vergrendelen
                    </button>
                    <button
                      onClick={() => setConfirmOpenDialog(a.id)}
                      disabled={doorLoading && doorAction?.accessId === a.id}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-warning/20 py-1.5 text-[10px] font-semibold text-warning disabled:opacity-50"
                    >
                      <DoorOpen size={10} />
                      Openen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm open door dialog */}
      <Dialog open={!!confirmOpenDialog} onOpenChange={() => setConfirmOpenDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" />
              Deur openen?
            </DialogTitle>
            <DialogDescription>
              De deur wordt direct geopend (unlatch). Dit is anders dan ontgrendelen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <DialogClose asChild>
              <button className="flex-1 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-foreground">
                Annuleren
              </button>
            </DialogClose>
            <button
              onClick={() => {
                if (confirmOpenDialog) handleDoorAction(confirmOpenDialog, "open");
                setConfirmOpenDialog(null);
              }}
              className="flex-1 rounded-lg bg-warning text-warning-foreground py-2.5 text-sm font-semibold"
            >
              Ja, open deur
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserAccess;
