import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DoorOpen, Loader2, RefreshCw, Search, Shield, Clock, Unlock, Lock, XCircle, Plus, CheckCircle } from "lucide-react";
import { inlineToast as toast } from "@/components/InlineToast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const STUDIO_NAMES: Record<string, string> = {
  "studio-1": "Studio 1 (A)",
  "studio-2": "Studio 2 (C)",
  "content-room": "Content Room",
  "all-studios": "Alle Studio's",
  "admin": "Admin",
};

interface AccessRecord {
  id: string;
  booking_id: string;
  user_id: string;
  studio_id: string;
  smartlock_id: string;
  access_start: string;
  access_end: string;
  access_status: string;
  last_unlock_attempt: string | null;
  last_unlock_result: string | null;
  created_at: string;
  updated_at: string;
  profile_name?: string;
  profile_email?: string;
}

interface UnlockLog {
  id: string;
  action: string;
  studio_id: string;
  smartlock_id: string;
  user_id: string;
  result: string;
  error_message: string | null;
  technical_error?: string | null;
  debug_status?: string;
  debug?: any;
  booking_access_id: string | null;
  created_at: string;
  profile_name?: string;
  profile_email?: string;
}

interface BookingForAccess {
  id: string;
  booking_date: string;
  start_time: string;
  duration_hours: number;
  studio_id: string;
  status: string;
  user_id: string;
  profile_name?: string;
  profile_email?: string;
  has_access: boolean;
}

const DEBUG_STATUS_LABELS: Record<string, string> = {
  success: "Success",
  nuki_device_offline: "Nuki device offline",
  invalid_token: "Invalid token",
  forbidden_scope: "Forbidden scope",
  invalid_smartlock_id: "Invalid smartlock id",
  duplicate_unlock_request: "Duplicate unlock request",
  access_window_invalid: "Access window invalid",
  booking_invalid: "Booking invalid",
  payment_status_invalid: "Payment status invalid",
  timeout: "Timeout",
  network_error: "Network error",
  nuki_busy_state: "Nuki busy state",
  unknown_nuki_error: "Unknown Nuki error",
};

const AdminAccessTab = () => {
  const [accessRecords, setAccessRecords] = useState<AccessRecord[]>([]);
  const [unlockLogs, setUnlockLogs] = useState<UnlockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [grantingId, setGrantingId] = useState<string | null>(null);

  // Bookings without access (for granting)
  const [bookingsWithoutAccess, setBookingsWithoutAccess] = useState<BookingForAccess[]>([]);

  // Access type per booking for granting
  const [accessTypeMap, setAccessTypeMap] = useState<Record<string, "booking" | "unlimited">>({});

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStudio, setFilterStudio] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [activeView, setActiveView] = useState<"grant" | "access" | "logs">("grant");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadAccessRecords(), loadUnlockLogs(), loadBookingsForGrant()]);
    setLoading(false);
  };

  const loadBookingsForGrant = async () => {
    try {
      // Get upcoming confirmed bookings
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, booking_date, start_time, duration_hours, studio_id, status, user_id")
        .eq("status", "confirmed")
        .gte("booking_date", todayStr)
        .order("booking_date", { ascending: true });

      if (!bookings || bookings.length === 0) {
        setBookingsWithoutAccess([]);
        return;
      }

      // Get existing access records for these bookings
      const bookingIds = bookings.map(b => b.id);
      const { data: existingAccess } = await (supabase.from as any)("booking_access")
        .select("booking_id")
        .in("booking_id", bookingIds)
        .neq("access_status", "revoked");

      const accessSet = new Set((existingAccess || []).map((a: any) => a.booking_id));

      // Get profile names
      const userIds = [...new Set(bookings.map(b => b.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched: BookingForAccess[] = bookings.map(b => {
        const p = profileMap.get(b.user_id);
        return {
          ...b,
          profile_name: p?.full_name || undefined,
          profile_email: p?.email || undefined,
          has_access: accessSet.has(b.id),
        };
      });

      setBookingsWithoutAccess(enriched);
    } catch {
      setBookingsWithoutAccess([]);
    }
  };

  const loadAccessRecords = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=admin-access-list`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const result = await res.json();
      setAccessRecords(result.records || []);
    } catch { setAccessRecords([]); }
  };

  const loadUnlockLogs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=unlock-logs&limit=100`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const result = await res.json();
      setUnlockLogs(result.logs || []);
    } catch { setUnlockLogs([]); }
  };

  const handleGrantAccess = async (bookingId: string) => {
    setGrantingId(bookingId);
    const accessType = accessTypeMap[bookingId] || "booking";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=create-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ booking_id: bookingId, access_type: accessType }),
        }
      );
      if (res.ok) {
        toast.success("Toegang toegewezen");
        loadAll();
      } else {
        const data = await res.json();
        toast.error(data.error || "Kon toegang niet toewijzen");
      }
    } catch {
      toast.error("Verbindingsfout");
    } finally {
      setGrantingId(null);
    }
  };

  const handleRevoke = async (accessId: string) => {
    setRevokingId(accessId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=revoke-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ booking_access_id: accessId }),
        }
      );
      if (res.ok) {
        toast.success("Toegang ingetrokken");
        loadAll();
      } else {
        toast.error("Kon toegang niet intrekken");
      }
    } catch {
      toast.error("Verbindingsfout");
    } finally {
      setRevokingId(null);
    }
  };

  const filteredBookings = bookingsWithoutAccess.filter(b => {
    if (filterStudio !== "all" && b.studio_id !== filterStudio) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const name = (b.profile_name || "").toLowerCase();
      const email = (b.profile_email || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const filteredAccess = accessRecords.filter(a => {
    if (filterStatus !== "all" && a.access_status !== filterStatus) return false;
    if (filterStudio !== "all" && a.studio_id !== filterStudio) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const name = (a.profile_name || "").toLowerCase();
      const email = (a.profile_email || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !a.booking_id.includes(q)) return false;
    }
    return true;
  });

  const filteredLogs = unlockLogs.filter(l => {
    if (filterStudio !== "all" && l.studio_id !== filterStudio) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const name = (l.profile_name || "").toLowerCase();
      const email = (l.profile_email || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DoorOpen size={16} className="text-primary" />
          <h3 className="font-semibold font-display text-sm">Toegang</h3>
        </div>
        <button onClick={loadAll} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Toggle tabs */}
      <div className="flex rounded-xl bg-secondary p-1 gap-0.5">
        <button
          onClick={() => setActiveView("grant")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeView === "grant" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <Plus size={12} className="inline mr-1" />
          Toewijzen
        </button>
        <button
          onClick={() => setActiveView("access")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeView === "access" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <Shield size={12} className="inline mr-1" />
          Records ({accessRecords.length})
        </button>
        <button
          onClick={() => setActiveView("logs")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeView === "logs" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <Clock size={12} className="inline mr-1" />
          Log ({unlockLogs.length})
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Zoek op naam of e-mail..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="w-full rounded-lg bg-card border border-border pl-9 pr-3 py-2 text-xs"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={filterStudio}
            onChange={e => setFilterStudio(e.target.value)}
            className="rounded-lg bg-card border border-border px-2 py-1.5 text-xs flex-1"
          >
            <option value="all">Alle ruimtes</option>
            <option value="studio-1">Studio 1</option>
            <option value="studio-2">Studio 2</option>
            <option value="content-room">Content Room</option>
          </select>
          {activeView === "access" && (
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-lg bg-card border border-border px-2 py-1.5 text-xs flex-1"
            >
              <option value="all">Alle statussen</option>
              <option value="scheduled">Ingepland</option>
              <option value="active">Actief</option>
              <option value="revoked">Ingetrokken</option>
            </select>
          )}
        </div>
      </div>

      {/* Grant Access View */}
      {activeView === "grant" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Wijs deurtoegang toe aan gebruikers met bevestigde boekingen. Alleen boekingen met toegang kunnen de voordeur bedienen.
          </p>
          {filteredBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Geen aankomende boekingen gevonden.</p>
          ) : (
            filteredBookings.map(b => (
              <div key={b.id} className={`rounded-xl border p-4 ${
                b.has_access ? "bg-success/5 border-success/20" : "bg-card border-border"
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{b.profile_name || "Onbekend"}</p>
                    <p className="text-[10px] text-muted-foreground">{b.profile_email || ""}</p>
                  </div>
                  {b.has_access ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-success/20 text-success flex items-center gap-1">
                      <CheckCircle size={10} />
                      Toegang
                    </span>
                  ) : (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
                      Geen toegang
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-2">
                  <div>Ruimte: <span className="text-foreground font-medium">{STUDIO_NAMES[b.studio_id] || b.studio_id}</span></div>
                  <div>Datum: <span className="text-foreground font-medium">{format(new Date(b.booking_date), "d MMM", { locale: nl })}</span></div>
                  <div>Tijd: <span className="text-foreground font-medium">{b.start_time}</span></div>
                  <div>Duur: <span className="text-foreground font-medium">{b.duration_hours}h</span></div>
                </div>

                {!b.has_access ? (
                  <>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground whitespace-nowrap">Type:</label>
                      <select
                        value={accessTypeMap[b.id] || "booking"}
                        onChange={e => setAccessTypeMap(prev => ({ ...prev, [b.id]: e.target.value as "booking" | "unlimited" }))}
                        className="flex-1 rounded-lg bg-secondary border border-border px-2 py-1.5 text-xs"
                      >
                        <option value="booking">15 min voor – eindtijd</option>
                        <option value="unlimited">Onbeperkt (vaste gebruiker)</option>
                      </select>
                    </div>
                    <button
                      onClick={() => handleGrantAccess(b.id)}
                      disabled={grantingId === b.id}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg gradient-primary py-2 text-xs font-semibold text-primary-foreground"
                    >
                      {grantingId === b.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      {grantingId === b.id ? "Toewijzen..." : "Toegang toewijzen"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      const record = accessRecords.find(a => a.booking_id === b.id && a.access_status !== "revoked");
                      if (record) handleRevoke(record.id);
                    }}
                    disabled={revokingId !== null}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 py-2 text-xs font-semibold text-destructive"
                  >
                    {revokingId ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                    Toegang intrekken
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Access Records View */}
      {activeView === "access" && (
        <div className="space-y-2">
          {filteredAccess.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Geen toegangsrecords gevonden.</p>
          ) : (
            filteredAccess.map(a => {
              const now = new Date();
              const start = new Date(a.access_start);
              const end = new Date(a.access_end);
              const isActive = now >= start && now <= end && a.access_status !== "revoked";
              const isExpired = now > end && a.access_status !== "revoked";

              return (
                <div key={a.id} className={`rounded-xl border p-4 ${
                  a.access_status === "revoked" ? "bg-destructive/5 border-destructive/20" :
                  a.access_status === "unlimited" ? "bg-primary/5 border-primary/20" :
                  isActive ? "bg-success/5 border-success/20" :
                  isExpired ? "bg-muted/50 border-border" :
                  "bg-card border-primary/20"
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{a.profile_name || "Onbekend"}</p>
                      <p className="text-[10px] text-muted-foreground">{a.profile_email || ""}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      a.access_status === "revoked" ? "bg-destructive/20 text-destructive" :
                      a.access_status === "unlimited" ? "bg-primary/20 text-primary" :
                      isActive ? "bg-success/20 text-success" :
                      isExpired ? "bg-muted text-muted-foreground" :
                      "bg-warning/20 text-warning"
                    }`}>
                      {a.access_status === "revoked" ? "Ingetrokken" :
                       a.access_status === "unlimited" ? "Onbeperkt" :
                       isActive ? "Actief" :
                       isExpired ? "Verlopen" : "Ingepland"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-2">
                    <div>Ruimte: <span className="text-foreground font-medium">{STUDIO_NAMES[a.studio_id] || a.studio_id}</span></div>
                    <div>Booking: <span className="text-foreground font-medium font-mono text-[9px]">{a.booking_id.slice(0, 8)}…</span></div>
                    <div>Start: <span className="text-foreground font-medium">{format(start, "d MMM HH:mm", { locale: nl })}</span></div>
                    <div>Einde: <span className="text-foreground font-medium">{format(end, "HH:mm", { locale: nl })}</span></div>
                    {a.last_unlock_attempt && (
                      <div className="col-span-2">
                        Laatste unlock: <span className="text-foreground font-medium">
                          {format(new Date(a.last_unlock_attempt), "d MMM HH:mm:ss", { locale: nl })}
                        </span>
                        {a.last_unlock_result && (
                          <span className={`ml-1 ${a.last_unlock_result === "success" ? "text-success" : "text-destructive"}`}>
                            ({a.last_unlock_result})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {a.access_status !== "revoked" && !isExpired && (
                    <button
                      onClick={() => handleRevoke(a.id)}
                      disabled={revokingId === a.id}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 py-2 text-xs font-semibold text-destructive"
                    >
                      {revokingId === a.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                      {revokingId === a.id ? "..." : "Toegang intrekken"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Unlock Logs View */}
      {activeView === "logs" && (
        <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Geen logs gevonden.</p>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="rounded-xl bg-card border border-border p-3">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {log.result === "success" ? (
                      <Unlock size={12} className="text-success shrink-0" />
                    ) : (
                      <Lock size={12} className="text-destructive shrink-0" />
                    )}
                    <span className="text-xs font-semibold truncate">{log.action}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    log.result === "success" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                  }`}>
                    {log.result}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-1">
                  <p>{log.profile_name || "Onbekend"} • {log.profile_email || ""}</p>
                  <p>{STUDIO_NAMES[log.studio_id] || log.studio_id} • {format(new Date(log.created_at), "d MMM HH:mm:ss", { locale: nl })}</p>
                  {log.debug_status && (
                    <p className="text-warning">Debug: {DEBUG_STATUS_LABELS[log.debug_status] || log.debug_status}</p>
                  )}
                  {(log.technical_error || log.error_message) && (
                    <p className="text-destructive break-all">{log.technical_error || log.error_message}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAccessTab;
