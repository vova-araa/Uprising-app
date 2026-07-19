import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Unlock, RefreshCw, Loader2, Settings, Shield, Clock, Trash2, Plus } from "lucide-react";
import { inlineToast as toast } from "@/components/InlineToast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const STUDIO_NAMES: Record<string, string> = {
  "studio-1": "Studio 1 (A)",
  "studio-2": "Studio 2 (C)",
  "content-room": "Content Room",
  "all-studios": "Alle Studio's (één slot)",
};

const AdminNukiTab = () => {
  const [smartlocks, setSmartlocks] = useState<any[]>([]);
  const [activeAccess, setActiveAccess] = useState<any[]>([]);
  const [unlockLogs, setUnlockLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // New smartlock form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudioId, setNewStudioId] = useState("");
  const [newSmartlockId, setNewSmartlockId] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<any>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadSmartlocks(), loadActiveAccess(), loadUnlockLogs()]);
    setLoading(false);
  };

  const loadSmartlocks = async () => {
    const { data } = await (supabase.from as any)("nuki_smartlocks").select("*").order("studio_id");
    setSmartlocks(data || []);
  };

  const loadActiveAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=active-access`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const result = await res.json();
      setActiveAccess(result.access_records || []);
    } catch { setActiveAccess([]); }
  };

  const loadUnlockLogs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=unlock-logs&limit=30`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const result = await res.json();
      setUnlockLogs(result.logs || []);
    } catch { setUnlockLogs([]); }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const performUnlock = window.confirm("Ook een test-ontgrendeling uitvoeren?");
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=test-connection`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ perform_unlock: performUnlock }),
        }
      );
      const result = await res.json();
      setTestConnectionResult(result);
      if (res.ok) {
        toast.success("Nuki verbinding succesvol getest");
      } else {
        toast.error("Nuki test mislukt");
      }
    } catch {
      toast.error("Verbindingsfout tijdens Nuki test");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAdminUnlock = async (smartlockId: string, action: "unlock" | "lock") => {
    setUnlockingId(smartlockId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuki-integration?action=admin-unlock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ smartlock_id: smartlockId, action }),
        }
      );
      if (res.ok) {
        toast.success(action === "unlock" ? "Deur geopend" : "Deur vergrendeld");
        loadUnlockLogs();
      } else {
        toast.error("Actie mislukt");
      }
    } catch {
      toast.error("Verbindingsfout");
    } finally {
      setUnlockingId(null);
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ booking_access_id: accessId }),
        }
      );
      if (res.ok) {
        toast.success("Toegang ingetrokken");
        loadActiveAccess();
      } else {
        toast.error("Kon toegang niet intrekken");
      }
    } catch {
      toast.error("Verbindingsfout");
    } finally {
      setRevokingId(null);
    }
  };

  const handleAddSmartlock = async () => {
    if (!newStudioId || !newSmartlockId || !newName) {
      toast.error("Vul alle velden in");
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from as any)("nuki_smartlocks").insert({
      studio_id: newStudioId,
      smartlock_id: newSmartlockId,
      name: newName,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Deze ruimte heeft al een slot" : "Opslaan mislukt");
    } else {
      toast.success("Slot toegevoegd");
      setShowAddForm(false);
      setNewStudioId("");
      setNewSmartlockId("");
      setNewName("");
      loadSmartlocks();
    }
    setSaving(false);
  };

  const handleDeleteSmartlock = async (id: string) => {
    const { error } = await (supabase.from as any)("nuki_smartlocks").delete().eq("id", id);
    if (error) {
      toast.error("Verwijderen mislukt");
    } else {
      toast.success("Slot verwijderd");
      loadSmartlocks();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Smartlock configuratie */}
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-primary" />
            <h3 className="font-semibold font-display text-sm">Nuki Sloten</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={loadAll} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-semibold disabled:opacity-60"
            >
              {testingConnection ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />} Test Nuki verbinding
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-semibold"
            >
              <Plus size={12} /> Toevoegen
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="rounded-lg bg-secondary/60 p-4 mb-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dit slot opent alle 3 de ruimtes (Studio 1, Studio 2 & Content Room)
            </p>
            <input
              placeholder="Nuki Smartlock ID (bijv. 4B8AEB3F)"
              value={newSmartlockId}
              onChange={(e) => {
                setNewSmartlockId(e.target.value);
                setNewStudioId("all-studios");
              }}
              className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm"
            />
            <input
              placeholder="Naam (bijv. Hoofdingang Uprising)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm"
            />
            <button
              onClick={handleAddSmartlock}
              disabled={saving || !newSmartlockId || !newName}
              className="w-full rounded-lg gradient-primary py-2 text-sm font-semibold text-primary-foreground"
            >
              {saving ? "Opslaan..." : "Slot opslaan"}
            </button>
          </div>
        )}

        {testConnectionResult && (
          <div className="rounded-lg bg-secondary/60 p-3 mb-4 text-xs space-y-1">
            <p className="font-semibold">Debug status: {testConnectionResult.debug_status || "unknown"}</p>
            <p>Smartlocks gevonden: {testConnectionResult?.checks?.smartlocks_found ?? 0}</p>
            <p>Device online: {String(testConnectionResult?.checks?.device_online)}</p>
            <p>Server state: {String(testConnectionResult?.checks?.server_state ?? "n/a")}</p>
            <p>Lock state: {String(testConnectionResult?.checks?.lock_state ?? "n/a")}</p>
            <p>Unlock test: {testConnectionResult?.checks?.unlock_test?.attempted ? (testConnectionResult?.checks?.unlock_test?.success ? "success" : "failed") : "not attempted"}</p>
          </div>
        )}

        {smartlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen Nuki sloten geconfigureerd.</p>
        ) : (
          <div className="space-y-2">
            {smartlocks.map((sl) => (
              <div key={sl.id} className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                <div>
                  <p className="text-sm font-semibold">{sl.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {STUDIO_NAMES[sl.studio_id] || sl.studio_id} • ID: {sl.smartlock_id}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleAdminUnlock(sl.smartlock_id, "unlock")}
                    disabled={unlockingId === sl.smartlock_id}
                    className="p-2 rounded-lg bg-success/20 text-success hover:bg-success/30"
                    title="Open deur"
                  >
                    {unlockingId === sl.smartlock_id ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                  </button>
                  <button
                    onClick={() => handleAdminUnlock(sl.smartlock_id, "lock")}
                    disabled={unlockingId === sl.smartlock_id}
                    className="p-2 rounded-lg bg-warning/20 text-warning hover:bg-warning/30"
                    title="Vergrendel deur"
                  >
                    <Lock size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteSmartlock(sl.id)}
                    className="p-2 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30"
                    title="Verwijder"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actieve toegangen */}
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-primary" />
          <h3 className="font-semibold font-display text-sm">Actieve toegangen</h3>
        </div>
        {activeAccess.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen actieve toegangen.</p>
        ) : (
          <div className="space-y-2">
            {activeAccess.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                <div>
                  <p className="text-sm font-semibold">{STUDIO_NAMES[a.studio_id] || a.studio_id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(a.access_start), "d MMM HH:mm", { locale: nl })} – {format(new Date(a.access_end), "HH:mm", { locale: nl })}
                    {" "}• {a.access_status}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(a.id)}
                  disabled={revokingId === a.id}
                  className="px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive text-xs font-semibold"
                >
                  {revokingId === a.id ? "..." : "Intrekken"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unlock logs */}
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-primary" />
          <h3 className="font-semibold font-display text-sm">Unlock log</h3>
        </div>
        {unlockLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen logs beschikbaar.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {unlockLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <div>
                  <p className="text-xs font-medium">
                    {log.action} • {STUDIO_NAMES[log.studio_id] || log.studio_id}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(log.created_at), "d MMM HH:mm:ss", { locale: nl })}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  log.result === "success" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                }`}>
                  {log.result}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNukiTab;
