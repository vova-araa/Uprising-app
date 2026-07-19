import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { inlineToast as toast } from "@/components/InlineToast";
import {
  SprayCan, Package, ShoppingCart, AlertTriangle, Plus, Trash2,
  Pencil, X, Save, Loader2, ChevronDown, ChevronRight, ArrowLeft, GripVertical,
  Wrench, CheckCircle, Ban, ImageIcon
} from "lucide-react";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

type CleaningLog = { id: string; cleaned_by: string; cleaned_at: string; areas: string[]; notes: string | null };
type FaultReport = { id: string; user_id: string; studio_id: string; category: string; description: string; photo_path: string | null; status: string; compensation: number; created_at: string };
type RoomBlock = { id: string; studio_id: string; reason: string; fault_report_id: string | null; active: boolean; created_at: string };
type InventoryItem = { id: string; item_name: string; quantity: number; min_quantity: number; category: string };
type VendingItem = { id: string; item_name: string; quantity: number; max_quantity: number; next_purchase_date: string | null; is_full: boolean };

const CLEANING_AREAS = [
  { id: "studio_1", label: "Studio 1" },
  { id: "studio_2", label: "Studio 2" },
  { id: "content_room", label: "Content Room" },
  { id: "drukkerij", label: "Drukkerij" },
  { id: "gang_boven", label: "Gang boven" },
  { id: "gang_beneden", label: "Gang beneden" },
  { id: "wcs", label: "WC's" },
];

const AdminFacilitiesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vending, setVending] = useState<VendingItem[]>([]);
  const [admins, setAdmins] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [faultReports, setFaultReports] = useState<FaultReport[]>([]);
  const [roomBlocks, setRoomBlocks] = useState<RoomBlock[]>([]);
  const [reporterNames, setReporterNames] = useState<Map<string, string>>(new Map());
  const [resolvingFault, setResolvingFault] = useState<string | null>(null);

  const [sections, setSections] = useState({ faults: true, cleaning: true, inventory: true, vending: true });
  const toggleSection = (key: keyof typeof sections) => setSections((s) => ({ ...s, [key]: !s[key] }));

  const [cleanAreas, setCleanAreas] = useState<string[]>([]);
  const [cleanNotes, setCleanNotes] = useState("");
  const [submittingClean, setSubmittingClean] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(0);
  const [newItemMin, setNewItemMin] = useState(0);
  const [newItemCat, setNewItemCat] = useState("schoonmaak");
  const [editingInv, setEditingInv] = useState<string | null>(null);
  const [editInvForm, setEditInvForm] = useState<Partial<InventoryItem>>({});
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const [newVendName, setNewVendName] = useState("");
  const [newVendQty, setNewVendQty] = useState(0);
  const [newVendMax, setNewVendMax] = useState(0);
  const [newVendDate, setNewVendDate] = useState("");
  const [editingVend, setEditingVend] = useState<string | null>(null);
  const [editVendForm, setEditVendForm] = useState<Partial<VendingItem>>({});

  const loadAll = async () => {
    setLoading(true);
    const [cleanRes, invRes, vendRes, adminsRes] = await Promise.all([
      supabase.from("admin_cleaning_logs" as any).select("*").order("cleaned_at", { ascending: false }).limit(20),
      supabase.from("admin_inventory" as any).select("*").order("category").order("item_name"),
      supabase.from("admin_vending" as any).select("*").order("item_name"),
      (async () => {
        const { data: roles } = await supabase.from("user_roles").select("user_id, role");
        const adminIds = new Set((roles || []).filter((r: any) => r.role === "admin" || r.role === "staff").map((r: any) => r.user_id));
        const { data: profiles } = await supabase.from("profiles").select("id, full_name");
        return (profiles || []).filter((p: any) => adminIds.has(p.id));
      })(),
    ]);
    setCleaningLogs((cleanRes.data as any[] || []) as CleaningLog[]);
    setInventory((invRes.data as any[] || []) as InventoryItem[]);
    setVending((vendRes.data as any[] || []) as VendingItem[]);
    setAdmins(adminsRes as any[]);

    const [faultsRes, blocksRes] = await Promise.all([
      supabase.from("fault_reports").select("*").neq("status", "resolved").order("created_at", { ascending: false }),
      supabase.from("room_blocks").select("*").eq("active", true).order("created_at", { ascending: false }),
    ]);
    const faults = (faultsRes.data as any[] || []) as FaultReport[];
    setFaultReports(faults);
    setRoomBlocks((blocksRes.data as any[] || []) as RoomBlock[]);
    const reporterIds = [...new Set(faults.map((f) => f.user_id))];
    if (reporterIds.length > 0) {
      const { data: reporters } = await supabase.from("profiles").select("id, full_name, email").in("id", reporterIds);
      setReporterNames(new Map((reporters || []).map((p: any) => [p.id, p.full_name || p.email || "Onbekend"])));
    }
    setLoading(false);
  };

  const resolveFault = async (fault: FaultReport) => {
    setResolvingFault(fault.id);
    try {
      await supabase.from("fault_reports")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq("id", fault.id);
      // Lift any room block created by this report
      await supabase.from("room_blocks").update({ active: false }).eq("fault_report_id", fault.id);
      toast.success("Melding opgelost — ruimte weer boekbaar");
      loadAll();
    } finally {
      setResolvingFault(null);
    }
  };

  const liftBlock = async (block: RoomBlock) => {
    await supabase.from("room_blocks").update({ active: false }).eq("id", block.id);
    toast.success("Blokkade opgeheven");
    loadAll();
  };

  const openPhoto = async (path: string) => {
    const url = await getSignedUrl("uploads", path);
    window.open(url, "_blank");
  };

  useEffect(() => { loadAll(); }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: loadAll,
    scrollableRef: scrollRef as React.RefObject<HTMLElement>,
  });

  const getAdminName = (id: string) => admins.find((a) => a.id === id)?.full_name || "Onbekend";
  const lastCleaning = cleaningLogs[0];

  const submitCleaning = async () => {
    if (!user || cleanAreas.length === 0) { toast.error("Selecteer minstens één ruimte"); return; }
    setSubmittingClean(true);
    await (supabase.from("admin_cleaning_logs" as any) as any).insert({ cleaned_by: user.id, areas: cleanAreas, notes: cleanNotes || null });
    setCleanAreas([]); setCleanNotes(""); setSubmittingClean(false);
    loadAll(); toast.success("Schoonmaak geregistreerd! 🧹");
  };

  const addInventoryItem = async () => {
    if (!newItemName.trim() || !user) return;
    await (supabase.from("admin_inventory" as any) as any).insert({ item_name: newItemName.trim(), quantity: newItemQty, min_quantity: newItemMin, category: newItemCat, updated_by: user.id });
    setNewItemName(""); setNewItemQty(0); setNewItemMin(0); loadAll(); toast.success("Toegevoegd");
  };
  const saveInvEdit = async () => {
    if (!editingInv) return;
    await (supabase.from("admin_inventory" as any) as any).update({ item_name: editInvForm.item_name, quantity: editInvForm.quantity, min_quantity: editInvForm.min_quantity, category: editInvForm.category, updated_at: new Date().toISOString() }).eq("id", editingInv);
    setEditingInv(null); loadAll(); toast.success("Bijgewerkt");
  };
  const deleteInvItem = async (id: string) => {
    await (supabase.from("admin_inventory" as any) as any).delete().eq("id", id); loadAll(); toast.success("Verwijderd");
  };

  const addVendingItem = async () => {
    if (!newVendName.trim()) return;
    await (supabase.from("admin_vending" as any) as any).insert({ item_name: newVendName.trim(), quantity: newVendQty, max_quantity: newVendMax, next_purchase_date: newVendDate || null });
    setNewVendName(""); setNewVendQty(0); setNewVendMax(0); setNewVendDate(""); loadAll(); toast.success("Toegevoegd");
  };
  const saveVendEdit = async () => {
    if (!editingVend) return;
    const qty = editVendForm.quantity || 0; const max = editVendForm.max_quantity || 0;
    await (supabase.from("admin_vending" as any) as any).update({ item_name: editVendForm.item_name, quantity: qty, max_quantity: max, next_purchase_date: editVendForm.next_purchase_date || null, is_full: qty >= max && max > 0, updated_at: new Date().toISOString() }).eq("id", editingVend);
    setEditingVend(null); loadAll(); toast.success("Bijgewerkt");
  };
  const deleteVendItem = async (id: string) => {
    await (supabase.from("admin_vending" as any) as any).delete().eq("id", id); loadAll(); toast.success("Verwijderd");
  };

  const SectionHeader = ({ icon: Icon, title, sectionKey, color }: { icon: any; title: string; sectionKey: keyof typeof sections; color: string }) => (
    <button onClick={() => toggleSection(sectionKey)} className="flex items-center gap-2 w-full text-left py-2 min-h-[44px]">
      {sections[sectionKey] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      <Icon size={18} className={color} />
      <span className="font-semibold text-sm">{title}</span>
    </button>
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50dvh]"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  }

  return (
    <div ref={scrollRef} className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24 relative" data-toast-section>
      {/* Pull-to-refresh indicator */}
      <div
        className="absolute left-0 right-0 z-30 flex items-center justify-center pointer-events-none transition-all duration-200"
        style={{
          top: pullDistance > 0 || isRefreshing ? `${pullDistance - 40}px` : "-40px",
          opacity: progress > 0.1 || isRefreshing ? 1 : 0,
        }}
      >
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border shadow-lg transition-transform duration-200 ${isRefreshing ? "animate-spin" : ""}`}
          style={{ transform: isRefreshing ? undefined : `rotate(${progress * 360}deg) scale(${0.6 + progress * 0.4})` }}
        >
          <Loader2 size={20} className="text-primary" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/admin")} className="p-2 rounded-lg hover:bg-secondary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg sm:text-xl font-bold">Faciliteitenbeheer</h1>
      </div>

      {/* ── FAULT REPORTS & ROOM BLOCKS ────────────────────────── */}
      <Card className={faultReports.length > 0 ? "border-warning/40" : ""}>
        <CardHeader className="pb-1 pt-3 px-3 sm:px-4">
          <SectionHeader icon={Wrench} title={`Storingen${faultReports.length > 0 ? ` (${faultReports.length})` : ""}`} sectionKey="faults" color={faultReports.length > 0 ? "text-warning" : "text-primary"} />
        </CardHeader>
        {sections.faults && (
          <CardContent className="px-3 sm:px-4 pb-4 pt-1 space-y-3">
            {roomBlocks.length > 0 && (
              <div className="space-y-1.5">
                {roomBlocks.map((block) => (
                  <div key={block.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                    <Ban size={14} className="text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{block.studio_id} geblokkeerd</span>
                      <p className="text-xs text-muted-foreground truncate">{block.reason}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => liftBlock(block)} className="min-h-[44px] shrink-0">
                      Opheffen
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {faultReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen open storingen 🎉</p>
            ) : (
              <div className="space-y-2">
                {faultReports.map((fault) => (
                  <div key={fault.id} className="p-3 rounded-lg bg-warning/5 border border-warning/20 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-[10px] shrink-0">{fault.studio_id}</Badge>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{fault.category}</Badge>
                        {fault.compensation > 0 && (
                          <Badge className="text-[10px] bg-success/20 text-success shrink-0">€{fault.compensation} comp.</Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(fault.created_at), "d MMM HH:mm", { locale: nl })}
                      </span>
                    </div>
                    <p className="text-sm">{fault.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Gemeld door: {reporterNames.get(fault.user_id) || "Onbekend"}
                    </p>
                    <div className="flex gap-2">
                      {fault.photo_path && (
                        <Button size="sm" variant="outline" onClick={() => openPhoto(fault.photo_path!)} className="min-h-[44px]">
                          <ImageIcon size={14} /> Foto
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => resolveFault(fault)}
                        disabled={resolvingFault === fault.id}
                        className="flex-1 min-h-[44px]"
                      >
                        {resolvingFault === fault.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Opgelost & vrijgeven
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── CLEANING ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3 sm:px-4">
          <SectionHeader icon={SprayCan} title="Schoonmaak" sectionKey="cleaning" color="text-primary" />
        </CardHeader>
        {sections.cleaning && (
          <CardContent className="px-3 sm:px-4 pb-4 pt-1 space-y-3">
            {lastCleaning ? (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium">
                  Laatst schoongemaakt: {format(new Date(lastCleaning.cleaned_at), "d MMMM yyyy, HH:mm", { locale: nl })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Door: {getAdminName(lastCleaning.cleaned_by)} · {lastCleaning.areas.map((a) => CLEANING_AREAS.find((ca) => ca.id === a)?.label || a).join(", ")}
                </p>
                {lastCleaning.notes && <p className="text-xs text-muted-foreground mt-0.5">Notitie: {lastCleaning.notes}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nog geen schoonmaak geregistreerd</p>
            )}

            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-sm font-medium">Schoonmaak registreren</p>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                {CLEANING_AREAS.map((area) => (
                  <label key={area.id} className="flex items-center gap-2 text-sm cursor-pointer min-h-[44px] px-2 rounded-lg hover:bg-secondary/50 active:bg-secondary">
                    <Checkbox checked={cleanAreas.includes(area.id)} onCheckedChange={(c) => setCleanAreas((prev) => c ? [...prev, area.id] : prev.filter((a) => a !== area.id))} />
                    {area.label}
                  </label>
                ))}
              </div>
              <Input placeholder="Notitie (optioneel)" value={cleanNotes} onChange={(e) => setCleanNotes(e.target.value)} className="text-sm min-h-[44px]" />
              <Button size="sm" onClick={submitCleaning} disabled={submittingClean || cleanAreas.length === 0} className="w-full sm:w-auto min-h-[44px]">
                <SprayCan size={14} /> Schoongemaakt ✓
              </Button>
            </div>

            {cleaningLogs.length > 1 && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer min-h-[44px] flex items-center">Eerdere schoonmaak ({cleaningLogs.length - 1})</summary>
                <div className="mt-1 space-y-2">
                  {cleaningLogs.slice(1).map((log) => (
                    <div key={log.id} className="text-xs text-muted-foreground p-2 rounded bg-secondary/30">
                      <div className="font-medium">{format(new Date(log.cleaned_at), "d MMM HH:mm", { locale: nl })} — {getAdminName(log.cleaned_by)}</div>
                      <div>{log.areas.map((a) => CLEANING_AREAS.find((ca) => ca.id === a)?.label || a).join(", ")}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── INVENTORY ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3 sm:px-4">
          <SectionHeader icon={Package} title="Inventarisatie" sectionKey="inventory" color="text-primary" />
        </CardHeader>
        {sections.inventory && (
          <CardContent className="px-3 sm:px-4 pb-4 pt-1 space-y-3">
            {inventory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen artikelen</p>
            ) : (
              <div className="space-y-1">
                {inventory.map((item) => {
                  const low = item.quantity <= item.min_quantity && item.min_quantity > 0;
                  if (editingInv === item.id) {
                    return (
                      <div key={item.id} className="p-3 rounded-lg bg-card border space-y-2">
                        <Input className="text-sm" value={editInvForm.item_name || ""} onChange={(e) => setEditInvForm({ ...editInvForm, item_name: e.target.value })} placeholder="Naam" />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Aantal</label>
                            <Input type="number" className="text-sm" value={editInvForm.quantity ?? 0} onChange={(e) => setEditInvForm({ ...editInvForm, quantity: +e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Min.</label>
                            <Input type="number" className="text-sm" value={editInvForm.min_quantity ?? 0} onChange={(e) => setEditInvForm({ ...editInvForm, min_quantity: +e.target.value })} />
                          </div>
                        </div>
                        <select className="text-sm border rounded px-2 py-2 bg-background w-full min-h-[44px]" value={editInvForm.category} onChange={(e) => setEditInvForm({ ...editInvForm, category: e.target.value })}>
                          <option value="schoonmaak">Schoonmaak</option>
                          <option value="keuken">Keuken</option>
                          <option value="kantoor">Kantoor</option>
                          <option value="algemeen">Algemeen</option>
                        </select>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveInvEdit} className="flex-1 min-h-[44px]"><Save size={14} /> Opslaan</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingInv(null)} className="min-h-[44px]"><X size={14} /></Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragItem(item.id)}
                      onDragOver={(e) => { e.preventDefault(); setDragOverItem(item.id); }}
                      onDragEnd={() => { setDragItem(null); setDragOverItem(null); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragItem && dragItem !== item.id) {
                          setInventory((prev) => {
                            const arr = [...prev];
                            const fromIdx = arr.findIndex((i) => i.id === dragItem);
                            const toIdx = arr.findIndex((i) => i.id === item.id);
                            if (fromIdx === -1 || toIdx === -1) return prev;
                            const [moved] = arr.splice(fromIdx, 1);
                            arr.splice(toIdx, 0, moved);
                            return arr;
                          });
                        }
                        setDragItem(null); setDragOverItem(null);
                      }}
                      className={`flex items-center gap-2 sm:gap-3 p-2.5 rounded-lg hover:bg-secondary/50 active:bg-secondary/70 transition-all ${
                        dragOverItem === item.id && dragItem !== item.id ? "border-t-2 border-primary" : ""
                      } ${dragItem === item.id ? "opacity-40" : ""}`}
                    >
                      <GripVertical size={14} className="text-muted-foreground/40 shrink-0 hidden sm:block" />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${low ? "text-destructive font-medium" : ""}`}>
                          {low && <AlertTriangle size={12} className="inline mr-1 text-destructive" />}
                          {item.item_name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant={low ? "destructive" : "secondary"} className="text-[10px]">{item.quantity} stuks</Badge>
                          <span className="text-[10px] text-muted-foreground">min: {item.min_quantity}</span>
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingInv(item.id); setEditInvForm(item); }} className="p-2 hover:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"><Pencil size={14} /></button>
                        <button onClick={() => deleteInvItem(item.id)} className="p-2 hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-2 border-t border-border pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Artikel</label>
                  <Input className="text-sm" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="bijv. WC papier" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Aantal</label>
                    <Input type="number" className="text-sm" value={newItemQty} onChange={(e) => setNewItemQty(+e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Min.</label>
                    <Input type="number" className="text-sm" value={newItemMin} onChange={(e) => setNewItemMin(+e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Categorie</label>
                  <select className="text-sm border rounded px-2 py-2 bg-background w-full min-h-[44px]" value={newItemCat} onChange={(e) => setNewItemCat(e.target.value)}>
                    <option value="schoonmaak">Schoonmaak</option>
                    <option value="keuken">Keuken</option>
                    <option value="kantoor">Kantoor</option>
                    <option value="algemeen">Algemeen</option>
                  </select>
                </div>
                <Button size="sm" onClick={addInventoryItem} disabled={!newItemName.trim()} className="min-h-[44px]"><Plus size={14} /> Toevoegen</Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── VENDING ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3 sm:px-4">
          <SectionHeader icon={ShoppingCart} title="Vendingmachine" sectionKey="vending" color="text-primary" />
        </CardHeader>
        {sections.vending && (
          <CardContent className="px-3 sm:px-4 pb-4 pt-1 space-y-3">
            {vending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen artikelen</p>
            ) : (
              <div className="space-y-1">
                {vending.map((item) => {
                  const pct = item.max_quantity > 0 ? Math.round((item.quantity / item.max_quantity) * 100) : 0;
                  if (editingVend === item.id) {
                    return (
                      <div key={item.id} className="p-3 rounded-lg bg-card border space-y-2">
                        <Input className="text-sm" value={editVendForm.item_name || ""} onChange={(e) => setEditVendForm({ ...editVendForm, item_name: e.target.value })} placeholder="Naam" />
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-[10px] text-muted-foreground">Aantal</label><Input type="number" className="text-sm" value={editVendForm.quantity ?? 0} onChange={(e) => setEditVendForm({ ...editVendForm, quantity: +e.target.value })} /></div>
                          <div><label className="text-[10px] text-muted-foreground">Max</label><Input type="number" className="text-sm" value={editVendForm.max_quantity ?? 0} onChange={(e) => setEditVendForm({ ...editVendForm, max_quantity: +e.target.value })} /></div>
                        </div>
                        <div><label className="text-[10px] text-muted-foreground">Volgende inkoop</label><Input type="date" className="text-sm" value={editVendForm.next_purchase_date || ""} onChange={(e) => setEditVendForm({ ...editVendForm, next_purchase_date: e.target.value })} /></div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveVendEdit} className="flex-1 min-h-[44px]"><Save size={14} /> Opslaan</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingVend(null)} className="min-h-[44px]"><X size={14} /></Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={item.id} className="flex items-center gap-2 sm:gap-3 p-2.5 rounded-lg hover:bg-secondary/50 active:bg-secondary/70">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{item.item_name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-16 sm:w-20 h-2 rounded-full bg-secondary overflow-hidden shrink-0">
                            <div className={`h-full rounded-full transition-all ${pct > 60 ? "bg-primary" : pct > 25 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{item.quantity}/{item.max_quantity}</span>
                          {item.is_full && <Badge className="text-[10px] bg-primary/20 text-primary">Vol</Badge>}
                        </div>
                        {item.next_purchase_date && (
                          <span className="text-[11px] text-muted-foreground">Inkoop: {format(new Date(item.next_purchase_date), "d MMM", { locale: nl })}</span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingVend(item.id); setEditVendForm(item); }} className="p-2 hover:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"><Pencil size={14} /></button>
                        <button onClick={() => deleteVendItem(item.id)} className="p-2 hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-2 border-t border-border pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className="text-xs text-muted-foreground">Artikel</label><Input className="text-sm" value={newVendName} onChange={(e) => setNewVendName(e.target.value)} placeholder="bijv. Mars" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-muted-foreground">Aantal</label><Input type="number" className="text-sm" value={newVendQty} onChange={(e) => setNewVendQty(+e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground">Max</label><Input type="number" className="text-sm" value={newVendMax} onChange={(e) => setNewVendMax(+e.target.value)} /></div>
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1"><label className="text-xs text-muted-foreground">Volgende inkoop</label><Input type="date" className="text-sm" value={newVendDate} onChange={(e) => setNewVendDate(e.target.value)} /></div>
                <Button size="sm" onClick={addVendingItem} disabled={!newVendName.trim()} className="min-h-[44px]"><Plus size={14} /> Toevoegen</Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default AdminFacilitiesPage;
