import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  CheckCircle2, Circle, Plus, Trash2, Loader2, CalendarDays,
  ListTodo, Flag, Users as UsersIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MilestoneStep {
  label: string;
  key: string;
  done: boolean;
}

interface Props {
  trajectId?: string | null;
  workshopId?: string | null;
  milestones: MilestoneStep[];
  progress: number;
  onMilestoneClick?: (key: string) => void;
}

const NONE = "__none__";

const OrgMilestoneTasks = ({ trajectId, workshopId, milestones, progress, onMilestoneClick }: Props) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "normal", deadline: "", assigned_to: "" });

  const load = async () => {
    setLoading(true);
    let query = supabase.from("org_tasks" as any).select("*").order("created_at", { ascending: true });
    if (trajectId) query = (query as any).eq("traject_id", trajectId);
    else if (workshopId) query = (query as any).eq("workshop_id", workshopId);
    else { setLoading(false); return; }

    const [tRes, tmRes] = await Promise.all([
      query,
      supabase.from("org_team_members" as any).select("id, name, is_active").order("name"),
    ]);
    setTasks((tRes.data as any[]) || []);
    setTeamMembers((tmRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [trajectId, workshopId]);

  const addTask = async () => {
    if (!newTask.title.trim() || !user) return;
    setSaving(true);
    try {
      const payload: any = {
        title: newTask.title.trim(),
        priority: newTask.priority,
        deadline: newTask.deadline || null,
        assigned_to: newTask.assigned_to || null,
        created_by: user.id,
      };
      if (trajectId) payload.traject_id = trajectId;
      if (workshopId) payload.workshop_id = workshopId;
      await (supabase.from("org_tasks" as any) as any).insert(payload);
      setNewTask({ title: "", priority: "normal", deadline: "", assigned_to: "" });
      setAdding(false);
      load();
    } catch { } finally { setSaving(false); }
  };

  const toggleTask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "open" : "done";
    await (supabase.from("org_tasks" as any) as any).update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const removeTask = async (id: string) => {
    await (supabase.from("org_tasks" as any) as any).delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const getTeamName = (id: string) => teamMembers.find(m => m.id === id)?.name || null;

  const openCount = tasks.filter(t => t.status === "open").length;
  const doneCount = tasks.filter(t => t.status === "done").length;

  const priorityColors: Record<string, string> = {
    high: "text-destructive",
    normal: "text-foreground",
    low: "text-muted-foreground",
  };

  // Green for done, red for not done
  const getColor = (done: boolean) => done
    ? { bg: "bg-emerald-400", bar: "bg-emerald-400" }
    : { bg: "bg-destructive", bar: "bg-destructive" };

  return (
    <div className="space-y-5">
      {/* Milestone tracker - horizontal colorful timeline */}
      <div className="p-5 rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Flag size={18} className="text-primary" /> Milestones
          </h2>
          <Badge variant="outline" className="text-xs font-medium">
            {milestones.filter(m => m.done).length}/{milestones.length}
          </Badge>
        </div>

        {/* Scrollable horizontal timeline */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          <div className="relative" style={{ minWidth: `${Math.max(milestones.length * 90, 400)}px` }}>
            {/* Background track */}
            <div className="absolute top-[14px] left-4 right-4 h-2 rounded-full bg-secondary" />

            {/* Colored segments */}
            <div className="absolute top-[14px] left-4 right-4 h-2 rounded-full overflow-hidden flex">
              {milestones.map((step) => {
                const color = getColor(step.done);
                return (
                  <div
                    key={step.key}
                    className={`h-full flex-1 transition-all duration-500 ${step.done ? color.bar : "bg-transparent"}`}
                    style={{ opacity: step.done ? 1 : 0.15 }}
                  />
                );
              })}
            </div>

            {/* Dots */}
            <div className="relative flex">
              {milestones.map((step) => {
                const color = getColor(step.done);
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1 min-w-[80px]">
                    <button
                      type="button"
                      onClick={() => !step.done && onMilestoneClick?.(step.key)}
                      disabled={step.done || !onMilestoneClick}
                      className={`w-[30px] h-[30px] rounded-full border-[3px] border-card flex items-center justify-center transition-all duration-300 ${
                        step.done ? `${color.bg} shadow-lg` : "bg-destructive"
                      } ${!step.done && onMilestoneClick ? "cursor-pointer hover:scale-110 hover:ring-2 hover:ring-destructive/50" : ""}`}
                    >
                      {step.done ? (
                        <CheckCircle2 size={14} className="text-white" />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
                      )}
                    </button>
                    <span className={`text-[9px] mt-2 text-center leading-tight px-1 ${
                      step.done ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Open tasks indicator */}
        {openCount > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <Badge variant="outline" className="text-[10px]">{openCount} taken open</Badge>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ListTodo size={18} className="text-primary" /> Taken
            {tasks.length > 0 && (
              <Badge variant="outline" className="text-[10px]">{doneCount}/{tasks.length}</Badge>
            )}
          </h2>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAdding(!adding)}>
            {adding ? "Annuleren" : <><Plus size={12} /> Taak</>}
          </Button>
        </div>

        {adding && (
          <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
            <Input
              value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Taakomschrijving..."
              className="h-8 text-xs"
              onKeyDown={e => e.key === "Enter" && addTask()}
            />
            <div className="flex flex-wrap gap-2">
              <Select value={newTask.priority} onValueChange={v => setNewTask({ ...newTask, priority: v })}>
                <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 Hoog</SelectItem>
                  <SelectItem value="normal">🟡 Normaal</SelectItem>
                  <SelectItem value="low">🟢 Laag</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })} className="h-7 text-xs w-36" />
              <Select value={newTask.assigned_to || NONE} onValueChange={v => setNewTask({ ...newTask, assigned_to: v === NONE ? "" : v })}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Toewijzen..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Niemand</SelectItem>
                  {teamMembers.filter(m => m.is_active).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 text-xs" onClick={addTask} disabled={saving}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nog geen taken</p>
        ) : (
          <div className="space-y-1">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/30 transition-colors group">
                <button onClick={() => toggleTask(t.id, t.status)} className="shrink-0">
                  {t.status === "done"
                    ? <CheckCircle2 size={18} className="text-emerald-400" />
                    : <Circle size={18} className="text-muted-foreground/50 hover:text-foreground" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs ${t.status === "done" ? "line-through text-muted-foreground" : priorityColors[t.priority] || "text-foreground"}`}>
                    {t.title}
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {t.deadline && (
                      <span className={`text-[10px] flex items-center gap-1 ${new Date(t.deadline) < new Date() && t.status !== "done" ? "text-destructive" : "text-muted-foreground"}`}>
                        <CalendarDays size={9} />{format(new Date(t.deadline), "d MMM", { locale: nl })}
                      </span>
                    )}
                    {t.assigned_to && getTeamName(t.assigned_to) && (
                      <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                        <UsersIcon size={9} />{getTeamName(t.assigned_to)}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0" onClick={() => removeTask(t.id)}>
                  <Trash2 size={11} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgMilestoneTasks;
