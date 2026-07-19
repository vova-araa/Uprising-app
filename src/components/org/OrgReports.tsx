import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignedLink } from "@/components/SignedStorageFile";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, isSameWeek, isAfter, isBefore, isToday } from "date-fns";
import { nl } from "date-fns/locale";
import {
  FileText, Upload, Loader2, Check, Image, Route, Plus,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Circle,
  CalendarDays, ListTodo, Users, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { inlineToast as toast } from "@/components/InlineToast";

const OrgReports = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [trajecten, setTrajecten] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedTraject, setExpandedTraject] = useState<string | null>(null);

  const [form, setForm] = useState({
    status: "completed",
    participant_count: 0,
    notes: "",
    file_urls: [] as string[],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessRes, repRes, locRes, trajRes, taskRes, tmRes] = await Promise.all([
        supabase.from("org_sessions" as any).select("*").order("session_date", { ascending: true }),
        supabase.from("org_session_reports" as any).select("*"),
        supabase.from("org_locations" as any).select("*"),
        supabase.from("org_trajecten" as any).select("*").order("title"),
        supabase.from("org_tasks" as any).select("*").order("deadline", { ascending: true }),
        supabase.from("org_team_members" as any).select("id, name"),
      ]);
      if (sessRes.error) throw sessRes.error;
      setSessions((sessRes.data as any[]) || []);
      setReports((repRes.data as any[]) || []);
      setLocations((locRes.data as any[]) || []);
      setTrajecten((trajRes.data as any[]) || []);
      setTasks((taskRes.data as any[]) || []);
      setTeamMembers((tmRes.data as any[]) || []);
    } catch (err: any) {
      toast.error(`Laden mislukt: ${err.message || "Onbekende fout"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getReport = (sessionId: string) => reports.find(r => r.session_id === sessionId);
  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || "—";
  const getTeamName = (id: string) => teamMembers.find(m => m.id === id)?.name || null;

  // Summary stats
  const summaryStats = useMemo(() => {
    const now = new Date();
    const pastSessions = sessions.filter(s => new Date(s.session_date) <= now);
    const reportedIds = new Set(reports.map(r => r.session_id));
    const reported = pastSessions.filter(s => reportedIds.has(s.id)).length;
    const missing = pastSessions.length - reported;
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => t.status === "done").length;
    const openTasks = totalTasks - doneTasks;
    const overdueTasks = tasks.filter(t => t.status === "open" && t.deadline && new Date(t.deadline) < now).length;
    return { total: pastSessions.length, reported, missing, openTasks, overdueTasks, totalTasks, doneTasks };
  }, [sessions, reports, tasks]);

  // Weekly breakdown per traject
  const getWeeklyBreakdown = (trajectId: string) => {
    const tSessions = sessions.filter(s => s.traject_id === trajectId && new Date(s.session_date) <= new Date());
    if (tSessions.length === 0) return [];

    const dates = tSessions.map(s => new Date(s.session_date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime()), Date.now()));

    const weeks = eachWeekOfInterval({ start: minDate, end: maxDate }, { weekStartsOn: 1 });

    return weeks.map((weekStart, i) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekSessions = tSessions.filter(s => isSameWeek(new Date(s.session_date), weekStart, { weekStartsOn: 1 }));
      const hasReport = weekSessions.some(s => getReport(s.id));
      const isPast = isBefore(weekEnd, new Date());

      return {
        weekNum: i + 1,
        weekStart,
        weekEnd,
        sessions: weekSessions,
        hasReport,
        isPast,
        isMissing: isPast && weekSessions.length > 0 && !hasReport,
      };
    }).filter(w => w.sessions.length > 0);
  };

  const openReport = (session: any) => {
    const existing = getReport(session.id);
    setSelectedSession(session);
    setForm({
      status: existing?.status || "completed",
      participant_count: existing?.participant_count || 0,
      notes: existing?.notes || "",
      file_urls: existing?.file_urls || [],
    });
    setDialogOpen(true);
  };

  const openNewReport = (trajectId: string) => {
    const traject = trajecten.find(t => t.id === trajectId);
    setSelectedSession({
      id: null,
      title: traject?.title || "Nieuwe rapportage",
      traject_id: trajectId,
      session_date: format(new Date(), "yyyy-MM-dd"),
      start_time: "10:00",
      end_time: "12:00",
      location_id: traject?.location_id || null,
      _isNew: true,
    });
    setForm({ status: "completed", participant_count: 0, notes: "", file_urls: [] });
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !selectedSession) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const sessionKey = selectedSession.id || `new-${Date.now()}`;
      const path = `${sessionKey}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("org-reports").upload(path, file);
      if (error) {
        toast.error(`Upload mislukt: ${error.message}`);
      } else {
        newUrls.push(path);
      }
    }
    setForm(prev => ({ ...prev, file_urls: [...prev.file_urls, ...newUrls] }));
    setUploading(false);
  };

  const saveReport = async () => {
    if (!user) { toast.error("Je bent niet ingelogd"); return; }
    if (!selectedSession) return;
    setSaving(true);
    try {
      let sessionId = selectedSession.id;
      if (selectedSession._isNew) {
        const { data: newSess, error: sessErr } = await (supabase.from("org_sessions" as any) as any)
          .insert({
            title: selectedSession.title,
            session_type: "workshop",
            session_date: selectedSession.session_date,
            start_time: selectedSession.start_time,
            end_time: selectedSession.end_time,
            location_id: selectedSession.location_id || null,
            traject_id: selectedSession.traject_id || null,
            status: form.status,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (sessErr) throw new Error(sessErr.message);
        sessionId = newSess.id;
      }

      const existing = sessionId ? getReport(sessionId) : null;
      if (existing) {
        const { error } = await (supabase.from("org_session_reports" as any) as any)
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await (supabase.from("org_session_reports" as any) as any)
          .insert({ session_id: sessionId, ...form, reported_by: user.id });
        if (error) throw new Error(error.message);
      }

      if (sessionId && !selectedSession._isNew) {
        await (supabase.from("org_sessions" as any) as any)
          .update({ status: form.status, updated_at: new Date().toISOString() })
          .eq("id", sessionId);
      }

      toast.success("Rapportage opgeslagen");
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message || "onbekende fout"}`);
    } finally {
      setSaving(false);
    }
  };

  const activeTrajecten = trajecten.filter(t => t.status === "active" || t.status === "planned");
  const completedSessions = sessions.filter(s => new Date(s.session_date) <= new Date());
  const unlinkedSessions = completedSessions.filter(s => !s.traject_id);

  const reportPercent = summaryStats.total > 0 ? Math.round((summaryStats.reported / summaryStats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-foreground">Rapportages</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Wekelijkse rapportages bijhouden per traject</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Ingevuld</div>
              <div className="text-xl font-bold text-foreground mt-0.5">{summaryStats.reported}<span className="text-sm text-muted-foreground font-normal">/{summaryStats.total}</span></div>
              <Progress value={reportPercent} className="h-1.5 mt-1.5" />
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Ontbrekend</div>
              <div className={`text-xl font-bold mt-0.5 ${summaryStats.missing > 0 ? "text-destructive" : "text-foreground"}`}>
                {summaryStats.missing}
              </div>
              {summaryStats.missing > 0 && (
                <span className="text-[10px] text-destructive flex items-center gap-0.5 mt-0.5">
                  <AlertCircle size={9} /> Nog in te vullen
                </span>
              )}
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Taken</div>
              <div className="text-xl font-bold text-foreground mt-0.5">{summaryStats.doneTasks}<span className="text-sm text-muted-foreground font-normal">/{summaryStats.totalTasks}</span></div>
              {summaryStats.overdueTasks > 0 && (
                <span className="text-[10px] text-destructive flex items-center gap-0.5 mt-0.5">
                  <AlertCircle size={9} /> {summaryStats.overdueTasks} verlopen
                </span>
              )}
              {summaryStats.overdueTasks === 0 && summaryStats.openTasks > 0 && (
                <span className="text-[10px] text-muted-foreground">{summaryStats.openTasks} open</span>
              )}
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Trajecten</div>
              <div className="text-xl font-bold text-foreground mt-0.5">{activeTrajecten.length}</div>
              <span className="text-[10px] text-muted-foreground">actief</span>
            </div>
          </div>

          {/* Taken voor vandaag */}
          {(() => {
            const todayTasks = tasks.filter(t => t.status === "open" && t.scheduled_date && isToday(new Date(t.scheduled_date)));
            const overdueTasks = tasks.filter(t => t.status === "open" && t.deadline && new Date(t.deadline) < new Date() && (!t.scheduled_date || !isToday(new Date(t.scheduled_date))));
            const relevant = [...todayTasks, ...overdueTasks];
            if (relevant.length === 0) return null;
            return (
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ListTodo size={14} className="text-primary" /> Taken voor vandaag
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{relevant.length}</Badge>
                </h2>
                <div className="space-y-1">
                  {relevant.map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/30 transition-colors">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.priority === "high" ? "bg-destructive" : t.priority === "low" ? "bg-muted-foreground/40" : "bg-primary"}`} />
                      <span className="text-xs text-foreground flex-1 min-w-0 truncate">{t.title}</span>
                      {t.deadline && new Date(t.deadline) < new Date() && (
                        <Badge className="text-[8px] py-0 px-1 bg-destructive/15 text-destructive border-destructive/30">verlopen</Badge>
                      )}
                      {t.assigned_to && getTeamName(t.assigned_to) && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                          <Users size={8} />{getTeamName(t.assigned_to)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}


          {activeTrajecten.map(t => {
            const weeklyData = getWeeklyBreakdown(t.id);
            const tSessions = completedSessions.filter(s => s.traject_id === t.id);
            const allTrajectSessions = sessions.filter(s => s.traject_id === t.id);
            const reportedCount = tSessions.filter(s => getReport(s.id)).length;
            const missingCount = weeklyData.filter(w => w.isMissing).length;
            const isExpanded = expandedTraject === t.id;


            return (
              <div key={t.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedTraject(isExpanded ? null : t.id)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-secondary/30 transition-colors text-left gap-2"
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Route size={16} className="text-primary shrink-0" />
                    <span className="font-medium text-foreground text-sm">{t.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {reportedCount}/{allTrajectSessions.length}
                    </Badge>
                    {missingCount > 0 && (
                      <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/30 gap-0.5">
                        <AlertCircle size={9} /> {missingCount} ontbrekend
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs hidden sm:flex"
                      onClick={(e) => { e.stopPropagation(); openNewReport(t.id); }}
                    >
                      <Plus size={12} className="mr-1" /> Rapportage
                    </Button>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Mobile add button */}
                    <div className="sm:hidden p-3 border-b border-border">
                      <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => openNewReport(t.id)}>
                        <Plus size={12} className="mr-1" /> Nieuwe rapportage
                      </Button>
                    </div>

                    {weeklyData.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-4">Nog geen afgelopen sessies voor dit traject.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {weeklyData.map(week => (
                          <div key={week.weekNum} className={`${week.isMissing ? "bg-destructive/5" : ""}`}>
                            <div className="px-3 sm:px-4 py-2 flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${week.hasReport ? "bg-emerald-500" : week.isMissing ? "bg-destructive" : "bg-muted-foreground/30"}`} />
                              <span className="text-xs font-semibold text-foreground">
                                Week {week.weekNum}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(week.weekStart, "d MMM", { locale: nl })} – {format(week.weekEnd, "d MMM", { locale: nl })}
                              </span>
                              {week.hasReport && (
                                <Badge className="text-[9px] py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                  <Check size={8} className="mr-0.5" /> Ingevuld
                                </Badge>
                              )}
                              {week.isMissing && (
                                <Badge className="text-[9px] py-0 bg-destructive/15 text-destructive border-destructive/30">
                                  <AlertCircle size={8} className="mr-0.5" /> Ontbrekend
                                </Badge>
                              )}
                            </div>
                            <div className="divide-y divide-border/50">
                              {week.sessions.map(s => {
                                const report = getReport(s.id);
                                return (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between py-2 px-4 sm:px-6 hover:bg-secondary/20 cursor-pointer transition-colors"
                                    onClick={() => openReport(s)}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <span className="text-xs font-medium text-foreground">{s.title}</span>
                                      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                                        <span className="flex items-center gap-0.5">
                                          <CalendarDays size={8} />
                                          {format(new Date(s.session_date), "EEE d MMM", { locale: nl })}
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                          <Clock size={8} />
                                          {s.start_time}–{s.end_time}
                                        </span>
                                      </div>
                                    </div>
                                    {report ? (
                                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                    ) : (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0">Invullen</Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unlinked sessions */}
          {unlinkedSessions.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-border">
                <span className="font-medium text-foreground text-sm">Overige sessies</span>
                <span className="text-xs text-muted-foreground ml-2">({unlinkedSessions.length})</span>
              </div>
              <div className="divide-y divide-border">
                {unlinkedSessions.map(s => {
                  const report = getReport(s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 px-3 sm:px-4 hover:bg-secondary/20 cursor-pointer transition-colors"
                      onClick={() => openReport(s)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-foreground">{s.title}</span>
                          <Badge variant="outline" className="text-[9px]">{s.session_type}</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {format(new Date(s.session_date), "d MMM yyyy", { locale: nl })} • {s.start_time}–{s.end_time}
                        </div>
                      </div>
                      {report ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0">Invullen</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTrajecten.length === 0 && unlinkedSessions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Geen trajecten of sessies gevonden</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Rapportage: {selectedSession?.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Voltooid</SelectItem>
                  <SelectItem value="cancelled">Geannuleerd</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Aantal deelnemers</Label>
              <Input
                type="number"
                min={0}
                className="h-9"
                value={form.participant_count}
                onChange={e => setForm({ ...form, participant_count: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label className="text-xs">Rapportage van de dag</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Wat ging goed? Wat kan beter? Observaties..."
                rows={4}
                className="text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Bestanden uploaden</Label>
              <div className="mt-1">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  <span className="text-xs text-muted-foreground">
                    {uploading ? "Uploaden..." : "Foto, muziek of document toevoegen"}
                  </span>
                  <input type="file" className="hidden" multiple accept="image/*,audio/*,.pdf,.doc,.docx" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>
              {form.file_urls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.file_urls.map((url, i) => (
                    <SignedLink key={i} bucket="org-reports" urlOrPath={url} className="flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/10 px-2 py-1 rounded">
                      <Image size={10} /> Bestand {i + 1}
                    </SignedLink>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Annuleren</Button>
              <Button size="sm" onClick={saveReport} disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin mr-1" />}
                Opslaan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrgReports;
