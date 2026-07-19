import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isPast, isTomorrow, isThisWeek } from "date-fns";
import { nl } from "date-fns/locale";
import { inlineToast as toast } from "@/components/InlineToast";
import {
  CheckCircle2, Circle, Plus, Trash2, X, Save, Users, User,
  Star, Sun, CalendarDays, Flag, Loader2, ChevronLeft, Search,
  ListTodo, ArrowUpDown, ArrowLeft, Building2, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

type AdminTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  is_team_task: boolean;
  status: string;
  priority: string;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  _source?: "admin" | "org";
};

type ListView = "mijn_dag" | "belangrijk" | "gepland" | "persoonlijk" | "team" | "stichting" | "alles";

const LISTS: { id: ListView; label: string; icon: any; color: string }[] = [
  { id: "mijn_dag", label: "Mijn dag", icon: Sun, color: "text-amber-500" },
  { id: "belangrijk", label: "Belangrijk", icon: Star, color: "text-red-500" },
  { id: "gepland", label: "Gepland", icon: CalendarDays, color: "text-green-600" },
  { id: "persoonlijk", label: "Persoonlijk", icon: User, color: "text-blue-500" },
  { id: "team", label: "Team", icon: Users, color: "text-violet-500" },
  { id: "stichting", label: "Stichting", icon: Building2, color: "text-orange-500" },
  { id: "alles", label: "Alle taken", icon: ListTodo, color: "text-foreground" },
];

const AdminTasksPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [admins, setAdmins] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<ListView>("mijn_dag");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const [selectedTask, setSelectedTask] = useState<AdminTask | null>(null);
  const [detailForm, setDetailForm] = useState<Partial<AdminTask>>({});

  const [sortBy, setSortBy] = useState<"created" | "deadline" | "priority">("created");
  const taskListRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    const [tasksRes, orgTasksRes, adminsRes] = await Promise.all([
      supabase.from("admin_tasks" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("org_tasks").select("*").order("created_at", { ascending: false }),
      (async () => {
        const { data: roles } = await supabase.from("user_roles").select("user_id, role");
        const adminIds = new Set((roles || []).filter((r: any) => r.role === "admin" || r.role === "staff").map((r: any) => r.user_id));
        const { data: profiles } = await supabase.from("profiles").select("id, full_name");
        return (profiles || []).filter((p: any) => adminIds.has(p.id));
      })(),
    ]);
    const adminTasks: AdminTask[] = ((tasksRes.data as any[]) || []).map((t: any) => ({ ...t, _source: "admin" as const }));
    const orgTasks: AdminTask[] = ((orgTasksRes.data as any[]) || []).map((t: any) => ({
      id: t.id, title: t.title, description: t.description, assigned_to: t.assigned_to,
      created_by: t.created_by, is_team_task: false,
      status: t.status === "open" ? "open" : t.status === "done" ? "done" : t.status,
      priority: t.priority || "normal", deadline: t.deadline || t.scheduled_date || null,
      completed_at: null, created_at: t.created_at, _source: "org" as const,
    }));
    setTasks([...adminTasks, ...orgTasks]);
    setAdmins(adminsRes as any[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const getAdminName = (id: string) => admins.find((a) => a.id === id)?.full_name || "Onbekend";

  const { pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: loadData,
    scrollableRef: taskListRef as React.RefObject<HTMLElement>,
  });

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    switch (activeList) {
      case "mijn_dag":
        list = list.filter((t) => {
          if (t.status === "done") return false;
          if (t.deadline && isToday(new Date(t.deadline))) return true;
          if (isToday(new Date(t.created_at))) return true;
          if (t.deadline && isPast(new Date(t.deadline))) return true;
          return false;
        });
        break;
      case "belangrijk": list = list.filter((t) => t.priority === "high"); break;
      case "gepland": list = list.filter((t) => t.deadline !== null && t.status !== "done"); break;
      case "persoonlijk": list = list.filter((t) => !t.is_team_task && (t.assigned_to === user?.id || t.created_by === user?.id)); break;
      case "team": list = list.filter((t) => t.is_team_task && t._source === "admin"); break;
      case "stichting": list = list.filter((t) => t._source === "org"); break;
      case "alles": break;
    }
    list = [...list].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      if (sortBy === "deadline") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === "priority") {
        const prio = { high: 0, normal: 1, low: 2 };
        return (prio[a.priority as keyof typeof prio] ?? 1) - (prio[b.priority as keyof typeof prio] ?? 1);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [tasks, activeList, searchQuery, sortBy, user]);

  const openTasks = filteredTasks.filter((t) => t.status !== "done");
  const doneTasks = filteredTasks.filter((t) => t.status === "done");

  const listCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    counts.mijn_dag = tasks.filter((t) => {
      if (t.status === "done") return false;
      if (t.deadline && isToday(new Date(t.deadline))) return true;
      if (isToday(new Date(t.created_at))) return true;
      if (t.deadline && isPast(new Date(t.deadline))) return true;
      return false;
    }).length;
    counts.belangrijk = tasks.filter((t) => t.priority === "high" && t.status !== "done").length;
    counts.gepland = tasks.filter((t) => t.deadline && t.status !== "done").length;
    counts.persoonlijk = tasks.filter((t) => !t.is_team_task && t._source === "admin" && (t.assigned_to === user?.id || t.created_by === user?.id) && t.status !== "done").length;
    counts.team = tasks.filter((t) => t.is_team_task && t._source === "admin" && t.status !== "done").length;
    counts.stichting = tasks.filter((t) => t._source === "org" && t.status !== "done").length;
    counts.alles = tasks.filter((t) => t.status !== "done").length;
    return counts;
  }, [tasks, user]);

  // CRUD
  const createTask = async () => {
    if (!newTitle.trim() || !user) return;
    setAddingTask(true);
    const isTeam = activeList === "team";
    const isImportant = activeList === "belangrijk";
    await (supabase.from("admin_tasks" as any) as any).insert({
      title: newTitle.trim(), created_by: user.id,
      assigned_to: isTeam ? null : user.id, is_team_task: isTeam,
      priority: isImportant ? "high" : "normal",
      deadline: activeList === "mijn_dag" ? format(new Date(), "yyyy-MM-dd") : null,
    });
    setNewTitle(""); setAddingTask(false); loadData();
    toast.success("Taak toegevoegd");
  };

  const getTable = (task: AdminTask) => task._source === "org" ? "org_tasks" : "admin_tasks";

  const toggleTask = async (task: AdminTask) => {
    const newStatus = task.status === "done" ? "open" : "done";
    const table = getTable(task);
    await (supabase.from(table as any) as any).update({
      status: newStatus,
      ...(table === "admin_tasks" ? { completed_at: newStatus === "done" ? new Date().toISOString() : null } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null } : t));
    if (selectedTask?.id === task.id) setSelectedTask({ ...selectedTask, status: newStatus });
  };

  const toggleImportant = async (task: AdminTask) => {
    const newPriority = task.priority === "high" ? "normal" : "high";
    const table = getTable(task);
    await (supabase.from(table as any) as any).update({ priority: newPriority, updated_at: new Date().toISOString() }).eq("id", task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, priority: newPriority } : t));
    if (selectedTask?.id === task.id) {
      setSelectedTask({ ...selectedTask, priority: newPriority });
      setDetailForm((f) => ({ ...f, priority: newPriority }));
    }
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    const table = task?._source === "org" ? "org_tasks" : "admin_tasks";
    await (supabase.from(table as any) as any).delete().eq("id", id);
    if (selectedTask?.id === id) setSelectedTask(null);
    loadData(); toast.success("Taak verwijderd");
  };

  const saveDetail = async () => {
    if (!selectedTask) return;
    const table = getTable(selectedTask);
    const updateData: any = {
      title: detailForm.title, description: detailForm.description || null,
      assigned_to: detailForm.assigned_to || null, priority: detailForm.priority,
      deadline: detailForm.deadline || null, updated_at: new Date().toISOString(),
    };
    if (table === "admin_tasks") updateData.is_team_task = detailForm.is_team_task;
    await (supabase.from(table as any) as any).update(updateData).eq("id", selectedTask.id);
    setSelectedTask(null); loadData(); toast.success("Opgeslagen");
  };

  const openDetail = (task: AdminTask) => {
    setSelectedTask(task);
    setDetailForm({ ...task });
    if (isMobile) setSidebarOpen(false);
  };

  const deadlineLabel = (d: string) => {
    const date = new Date(d);
    if (isToday(date)) return "Vandaag";
    if (isTomorrow(date)) return "Morgen";
    if (isPast(date)) return `Verlopen · ${format(date, "d MMM", { locale: nl })}`;
    if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, "EEEE", { locale: nl });
    return format(date, "d MMM", { locale: nl });
  };

  const activeListInfo = LISTS.find((l) => l.id === activeList)!;

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50dvh]"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  }

  // Detail panel content (shared between mobile overlay and desktop side panel)
  const detailContent = selectedTask ? (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">Details</span>
        <div className="flex gap-1">
          <button onClick={() => deleteTask(selectedTask.id)} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Trash2 size={16} />
          </button>
          <button onClick={() => setSelectedTask(null)} className="p-2 rounded hover:bg-secondary text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => toggleTask(selectedTask)} className="min-w-[44px] min-h-[44px] flex items-center justify-center">
            {selectedTask.status === "done"
              ? <CheckCircle2 size={22} className="text-primary" />
              : <Circle size={22} className="text-muted-foreground hover:text-primary" />}
          </button>
          <input
            value={detailForm.title || ""}
            onChange={(e) => setDetailForm({ ...detailForm, title: e.target.value })}
            className="flex-1 text-sm font-medium bg-transparent outline-none border-b border-transparent focus:border-primary pb-0.5"
          />
        </div>
        <button
          onClick={() => toggleImportant(selectedTask)}
          className="flex items-center gap-2 w-full px-3 py-3 rounded-lg hover:bg-secondary text-sm min-h-[44px]"
        >
          <Star size={16} className={selectedTask.priority === "high" ? "fill-amber-400 text-amber-400" : "text-muted-foreground"} />
          {selectedTask.priority === "high" ? "Belangrijk" : "Markeer als belangrijk"}
        </button>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">Toegewezen aan</label>
          <select
            className="w-full text-sm border rounded-lg px-3 py-2.5 bg-background min-h-[44px]"
            value={detailForm.assigned_to || ""}
            onChange={(e) => setDetailForm({ ...detailForm, assigned_to: e.target.value || null })}
          >
            <option value="">Niet toegewezen</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">Deadline</label>
          <Input type="date" value={detailForm.deadline || ""} onChange={(e) => setDetailForm({ ...detailForm, deadline: e.target.value || null })} className="text-sm min-h-[44px]" />
        </div>
        <label className="flex items-center gap-2 px-3 py-3 rounded-lg hover:bg-secondary cursor-pointer min-h-[44px]">
          <Checkbox checked={detailForm.is_team_task} onCheckedChange={(c) => setDetailForm({ ...detailForm, is_team_task: !!c })} />
          <Users size={14} className="text-muted-foreground" />
          <span className="text-sm">Teamtaak</span>
        </label>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">Notities</label>
          <textarea
            value={detailForm.description || ""}
            onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })}
            placeholder="Voeg een notitie toe..."
            rows={4}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-background resize-none outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="text-[11px] text-muted-foreground space-y-0.5 pt-2 border-t border-border">
          <p>Aangemaakt: {format(new Date(selectedTask.created_at), "d MMM yyyy, HH:mm", { locale: nl })}</p>
          {selectedTask.completed_at && <p>Afgerond: {format(new Date(selectedTask.completed_at), "d MMM yyyy, HH:mm", { locale: nl })}</p>}
          <p>Door: {getAdminName(selectedTask.created_by)}</p>
        </div>
      </div>
      <div className="p-3 border-t border-border">
        <Button onClick={saveDetail} className="w-full min-h-[44px]" size="sm">
          <Save size={14} /> Opslaan
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden" data-toast-section>
      {/* ─── SIDEBAR (mobile: overlay, desktop: side panel) ───── */}
      {isMobile ? (
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-y-0 left-0 w-[280px] z-50 bg-card border-r border-border flex flex-col"
              >
                <div className="p-3 border-b border-border">
                  <button onClick={() => navigate("/admin")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 w-full min-h-[44px]">
                    <ArrowLeft size={14} /> Admin Dashboard
                  </button>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Zoeken..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-10 text-sm bg-secondary/50" />
                  </div>
                </div>
                <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                  {LISTS.map((list) => {
                    const isActive = activeList === list.id;
                    const count = listCounts[list.id] || 0;
                    return (
                      <button
                        key={list.id}
                        onClick={() => { setActiveList(list.id); setSelectedTask(null); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px]
                          ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                      >
                        <list.icon size={18} className={isActive ? "text-primary" : list.color} />
                        <span className="flex-1 text-left">{list.label}</span>
                        {count > 0 && <span className={`text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`}>{count}</span>}
                      </button>
                    );
                  })}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      ) : (
        <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <button onClick={() => navigate("/admin")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 w-full">
              <ArrowLeft size={14} /> Admin Dashboard
            </button>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Zoeken..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm bg-secondary/50" />
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {LISTS.map((list) => {
              const isActive = activeList === list.id;
              const count = listCounts[list.id] || 0;
              return (
                <button
                  key={list.id}
                  onClick={() => { setActiveList(list.id); setSelectedTask(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                >
                  <list.icon size={18} className={isActive ? "text-primary" : list.color} />
                  <span className="flex-1 text-left">{list.label}</span>
                  {count > 0 && <span className={`text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`}>{count}</span>}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* ─── MAIN CONTENT ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-secondary rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
                <Menu size={20} />
              </button>
            )}
            <activeListInfo.icon size={20} className={activeListInfo.color} />
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold truncate">{activeListInfo.label}</h1>
              {activeList === "mijn_dag" && (
                <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE d MMMM", { locale: nl })}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSortBy(sortBy === "created" ? "deadline" : sortBy === "deadline" ? "priority" : "created")} className="gap-1 text-xs text-muted-foreground min-h-[44px] px-2">
              <ArrowUpDown size={14} />
              <span className="hidden sm:inline">{sortBy === "created" ? "Datum" : sortBy === "deadline" ? "Deadline" : "Prioriteit"}</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Task list */}
          <div ref={taskListRef} className="flex-1 overflow-y-auto relative">
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
            {/* Add task */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-primary shrink-0" />
                <input
                  placeholder="Taak toevoegen..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createTask()}
                  disabled={addingTask}
                  className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none min-h-[44px]"
                />
                {newTitle && (
                  <Button size="sm" onClick={createTask} disabled={addingTask} className="h-9 px-3 text-xs">
                    Toevoegen
                  </Button>
                )}
              </div>
            </div>

            {/* Open tasks */}
            <div className="divide-y divide-border">
              <AnimatePresence>
                {openTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => openDetail(task)}
                    className={`flex items-center gap-2 sm:gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-secondary/60 hover:bg-secondary/40 ${
                      selectedTask?.id === task.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                      className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <Circle size={20} className="text-muted-foreground" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {task.deadline && (
                          <span className={`text-[11px] ${isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) ? "text-destructive" : "text-muted-foreground"}`}>
                            {deadlineLabel(task.deadline)}
                          </span>
                        )}
                        {task.assigned_to && <span className="text-[11px] text-muted-foreground">· {getAdminName(task.assigned_to)}</span>}
                        {task.is_team_task && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4"><Users size={8} className="mr-0.5" />Team</Badge>}
                        {task._source === "org" && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-orange-300 text-orange-600"><Building2 size={8} className="mr-0.5" />Stichting</Badge>}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleImportant(task); }}
                      className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <Star size={16} className={task.priority === "high" ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {openTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <activeListInfo.icon size={40} className="mb-3 opacity-30" />
                <p className="text-sm">Geen taken</p>
              </div>
            )}

            {doneTasks.length > 0 && (
              <details className="border-t border-border">
                <summary className="px-4 py-3 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-secondary/30 min-h-[44px] flex items-center">
                  Afgerond ({doneTasks.length})
                </summary>
                <div className="divide-y divide-border">
                  {doneTasks.map((task) => (
                    <div key={task.id} onClick={() => openDetail(task)} className="flex items-center gap-2 sm:gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 active:bg-secondary/50 opacity-60">
                      <button onClick={(e) => { e.stopPropagation(); toggleTask(task); }} className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <CheckCircle2 size={20} className="text-primary" />
                      </button>
                      <p className="text-sm line-through flex-1 truncate">{task.title}</p>
                      <button onClick={(e) => { e.stopPropagation(); toggleImportant(task); }} className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <Star size={16} className={task.priority === "high" ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* ─── DETAIL PANEL (desktop only) ─────────────────── */}
          {!isMobile && (
            <AnimatePresence>
              {selectedTask && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 340, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 border-l border-border bg-card overflow-hidden"
                >
                  <div className="w-[340px] h-full">
                    {detailContent}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ─── DETAIL PANEL (mobile: full-screen overlay) ──────── */}
      {isMobile && (
        <AnimatePresence>
          {selectedTask && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 bg-card"
            >
              {detailContent}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default AdminTasksPage;
