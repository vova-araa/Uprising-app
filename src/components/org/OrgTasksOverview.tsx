import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ListTodo, CheckCircle2, Circle, CalendarDays, Route, BookOpen,
  Users, Loader2, AlertCircle, Plus, Save, X, Edit3, Trash2, Flame, GraduationCap, Clock, Star
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inlineToast as toast } from "@/components/InlineToast";
import { useConfirm } from "@/components/ConfirmDialog";

const ALL = "__all__";
const NONE = "__none__";

const OrgTasksOverview = () => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [trajecten, setTrajecten] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [orgWorkshops, setOrgWorkshops] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("open");

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    project_type: NONE as string,
    assigned_to: NONE as string,
    priority: "normal",
    deadline: "",
    scheduled_date: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, trRes, wsRes, owRes, tmRes] = await Promise.all([
        supabase.from("org_tasks" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("org_trajecten" as any).select("id, title, status"),
        supabase.from("broedplaats_workshops" as any).select("id, title, workshop_date, learning_module"),
        supabase.from("org_workshops" as any).select("id, title, status, class_name"),
        supabase.from("org_team_members" as any).select("id, name, role").eq("is_active", true),
      ]);
      if (tRes.error) throw tRes.error;
      setTasks((tRes.data as any[]) || []);
      setTrajecten((trRes.data as any[]) || []);
      setWorkshops((wsRes.data as any[]) || []);
      setOrgWorkshops((owRes.data as any[]) || []);
      setTeamMembers((tmRes.data as any[]) || []);
    } catch (err: any) {
      toast.error(`Laden mislukt: ${err.message || "Onbekende fout"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleTask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "open" : "done";
    await (supabase.from("org_tasks" as any) as any).update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const resetForm = () => {
    setForm({ title: "", description: "", project_type: NONE, assigned_to: NONE, priority: "normal", deadline: "", scheduled_date: "" });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setAdding(false);
    const projectType = t.traject_id ? `traject_${t.traject_id}` 
      : t.org_workshop_id ? `orgworkshop_${t.org_workshop_id}`
      : t.workshop_id ? `workshop_${t.workshop_id}` 
      : NONE;
    setForm({
      title: t.title || "",
      description: t.description || "",
      project_type: projectType,
      assigned_to: t.assigned_to || NONE,
      priority: t.priority || "normal",
      deadline: t.deadline || "",
      scheduled_date: t.scheduled_date || "",
    });
  };

  const saveTask = async () => {
    if (!form.title.trim()) { toast.error("Titel is verplicht"); return; }
    if (form.title.trim().length > 200) { toast.error("Titel mag maximaal 200 tekens zijn"); return; }
    if (form.description.length > 2000) { toast.error("Beschrijving mag maximaal 2000 tekens zijn"); return; }
    if (!user) return;
    setSaving(true);
    try {
      let traject_id: string | null = null;
      let workshop_id: string | null = null;
      let org_workshop_id: string | null = null;
      if (form.project_type.startsWith("traject_")) traject_id = form.project_type.replace("traject_", "");
      if (form.project_type.startsWith("workshop_")) workshop_id = form.project_type.replace("workshop_", "");
      if (form.project_type.startsWith("orgworkshop_")) org_workshop_id = form.project_type.replace("orgworkshop_", "");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        traject_id,
        workshop_id,
        org_workshop_id,
        assigned_to: form.assigned_to !== NONE ? form.assigned_to : null,
        priority: form.priority,
        deadline: form.deadline || null,
        scheduled_date: form.scheduled_date || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await (supabase.from("org_tasks" as any) as any).update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
        toast.success("Taak bijgewerkt");
      } else {
        const { error } = await (supabase.from("org_tasks" as any) as any).insert({
          ...payload,
          created_by: user.id,
          status: "open",
        });
        if (error) throw new Error(error.message);
        toast.success("Taak toegevoegd");
      }
      resetForm();
      load();
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message}`);
    } finally { setSaving(false); }
  };

  const removeTask = async (id: string) => {
    if (!(await confirm({ title: "Taak verwijderen?", destructive: true }))) return;
    const { error } = await (supabase.from("org_tasks" as any) as any).delete().eq("id", id);
    if (error) { toast.error(`Verwijderen mislukt: ${error.message}`); return; }
    toast.success("Taak verwijderd");
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const getTrajectName = (id: string) => trajecten.find(t => t.id === id)?.title || null;
  const getWorkshopLabel = (id: string) => {
    const ws = workshops.find(w => w.id === id);
    if (!ws) return null;
    return ws.title || `Workshop ${format(new Date(ws.workshop_date), "d MMM", { locale: nl })}`;
  };
  const getOrgWorkshopName = (id: string) => orgWorkshops.find(w => w.id === id)?.title || null;
  const getTeamName = (id: string) => teamMembers.find(m => m.id === id)?.name || null;

  const filtered = tasks.filter(t => {
    if (filterStatus === ALL) return true;
    return t.status === filterStatus;
  });

  const todayTasks = tasks.filter(t => t.status === "open" && t.scheduled_date && isToday(parseISO(t.scheduled_date)));
  const openCount = tasks.filter(t => t.status === "open").length;
  const overdueCount = tasks.filter(t => t.status === "open" && t.deadline && new Date(t.deadline) < new Date()).length;

  const priorityColors: Record<string, string> = {
    high: "text-destructive",
    normal: "text-foreground",
    low: "text-muted-foreground",
  };

  const renderTask = (t: any) => {
    const projectName = t.traject_id ? getTrajectName(t.traject_id) : t.org_workshop_id ? getOrgWorkshopName(t.org_workshop_id) : t.workshop_id ? getWorkshopLabel(t.workshop_id) : "Los";
    const projectIcon = t.traject_id ? <Route size={9} /> : t.org_workshop_id ? <GraduationCap size={9} /> : t.workshop_id ? <Flame size={9} /> : <BookOpen size={9} />;
    const isOverdue = t.status === "open" && t.deadline && new Date(t.deadline) < new Date();

    return (
      <div key={t.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors group ${isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border bg-card hover:bg-secondary/30"}`}>
        <button onClick={() => toggleTask(t.id, t.status)} className="shrink-0">
          {t.status === "done"
            ? <CheckCircle2 size={16} className="text-emerald-400" />
            : <Circle size={16} className="text-muted-foreground/50 hover:text-foreground" />
          }
        </button>
        <div className="flex-1 min-w-0">
          <span className={`text-xs leading-tight ${t.status === "done" ? "line-through text-muted-foreground" : priorityColors[t.priority] || "text-foreground"}`}>
            {t.title}
          </span>
          <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
            {projectName && projectName !== "Los" && (
              <span className="text-[9px] flex items-center gap-0.5 text-primary">
                {projectIcon}{projectName}
              </span>
            )}
            {t.scheduled_date && (
              <span className={`text-[9px] flex items-center gap-0.5 ${isToday(parseISO(t.scheduled_date)) ? "text-primary font-medium" : "text-muted-foreground"}`}>
                <Clock size={8} />voor {format(parseISO(t.scheduled_date), "d MMM", { locale: nl })}
              </span>
            )}
            {t.deadline && (
              <span className={`text-[9px] flex items-center gap-0.5 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                <CalendarDays size={8} />{format(new Date(t.deadline), "d MMM", { locale: nl })}
              </span>
            )}
            {t.assigned_to && getTeamName(t.assigned_to) && (
              <span className="text-[9px] flex items-center gap-0.5 text-muted-foreground">
                <Users size={8} />{getTeamName(t.assigned_to)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(t)}>
            <Edit3 size={11} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeTask(t.id)}>
            <Trash2 size={11} />
          </Button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  return (
    <div className="space-y-3">
      {/* Header - compact on mobile */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base sm:text-xl font-bold text-foreground flex items-center gap-1.5">
          <ListTodo size={18} className="text-primary" /> Taken
        </h1>
        <div className="flex items-center gap-1.5 flex-wrap">
          {overdueCount > 0 && (
            <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[10px] gap-1 px-1.5 py-0.5">
              <AlertCircle size={10} /> {overdueCount}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{openCount} open</Badge>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-7 w-24 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Afgerond</SelectItem>
              <SelectItem value={ALL}>Alles</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs gap-1 px-2" onClick={() => { setAdding(true); setEditingId(null); setForm({ title: "", description: "", project_type: NONE, assigned_to: NONE, priority: "normal", deadline: "", scheduled_date: "" }); }}>
            <Plus size={12} /> Nieuw
          </Button>
        </div>
      </div>

      {/* Add/edit task form - compact */}
      {(adding || editingId) && (
        <div className="p-3 rounded-lg border border-border bg-card space-y-2">
          <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Wat moet er gedaan worden..." className="h-8 text-xs" />
          <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Omschrijving (optioneel)..." rows={1} className="text-xs min-h-[32px]" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.project_type} onValueChange={val => setForm({ ...form, project_type: val })}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Geen project</SelectItem>
                {trajecten.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Trajecten</div>
                    {trajecten.map(t => <SelectItem key={`t_${t.id}`} value={`traject_${t.id}`}>{t.title}</SelectItem>)}
                  </>
                )}
                {orgWorkshops.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Workshops</div>
                    {orgWorkshops.map(w => <SelectItem key={`ow_${w.id}`} value={`orgworkshop_${w.id}`}>{w.title}{w.class_name ? ` (${w.class_name})` : ""}</SelectItem>)}
                  </>
                )}
                {workshops.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Broedplaats</div>
                    {workshops.map(w => <SelectItem key={`w_${w.id}`} value={`workshop_${w.id}`}>{w.title || `Workshop ${format(new Date(w.workshop_date), "d MMM", { locale: nl })}`}</SelectItem>)}
                  </>
                )}
              </SelectContent>
            </Select>
            <Select value={form.assigned_to} onValueChange={val => setForm({ ...form, assigned_to: val })}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Teamlid" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Niet toegewezen</SelectItem>
                {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.priority} onValueChange={val => setForm({ ...form, priority: val })}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Laag</SelectItem>
                <SelectItem value="normal">Normaal</SelectItem>
                <SelectItem value="high">Hoog</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} className="h-7 text-[11px]" placeholder="Datum" />
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="h-7 text-[11px] w-32" placeholder="Deadline" />
            <span className="text-[10px] text-muted-foreground">Deadline</span>
            <div className="flex-1" />
            <Button size="sm" className="h-7 text-xs" onClick={saveTask} disabled={saving}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetForm}>
              <X size={12} />
            </Button>
          </div>
        </div>
      )}

      {/* Today's tasks */}
      {todayTasks.length > 0 && (
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-foreground flex items-center gap-1">
            <Star size={12} className="text-primary" /> Vandaag
            <Badge variant="outline" className="text-[9px] ml-1 px-1 py-0">{todayTasks.length}</Badge>
          </h2>
          <div className="space-y-1 pl-2 border-l-2 border-primary/30">
            {todayTasks.map(renderTask)}
          </div>
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ListTodo size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">Geen taken gevonden</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(renderTask)}
        </div>
      )}
    </div>
  );
};

export default OrgTasksOverview;
