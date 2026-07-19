import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Search, Loader2, Edit3, Calendar, MapPin, Users, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OrgSessionDialog from "./OrgSessionDialog";

const ALL = "__all__";

const OrgSessionList = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState(ALL);
  const [filterTeam, setFilterTeam] = useState(ALL);
  const [filterType, setFilterType] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessRes, locRes, teamRes] = await Promise.all([
        supabase.from("org_sessions" as any).select("*").order("session_date", { ascending: true }),
        supabase.from("org_locations" as any).select("*"),
        supabase.from("org_team_members" as any).select("*"),
      ]);
      if (sessRes.error) throw sessRes.error;
      setSessions((sessRes.data as any[]) || []);
      setLocations((locRes.data as any[]) || []);
      setTeamMembers((teamRes.data as any[]) || []);
    } catch {
      // Silently fail — data will be empty, user sees empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || "—";
  const getTeamName = (id: string) => teamMembers.find(t => t.id === id)?.name || "—";

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterLocation !== ALL && s.location_id !== filterLocation) return false;
      if (filterTeam !== ALL && s.team_member_id !== filterTeam) return false;
      if (filterType !== ALL && s.session_type !== filterType) return false;
      return true;
    });
  }, [sessions, search, filterLocation, filterTeam, filterType]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      planned: "bg-blue-500/20 text-blue-400",
      completed: "bg-emerald-500/20 text-emerald-400",
      cancelled: "bg-destructive/20 text-destructive",
    };
    return map[status] || "bg-muted text-muted-foreground";
  };

  const statusLabel = (status: string) => {
    return status === "planned" ? "Gepland" : status === "completed" ? "Voltooid" : "Geannuleerd";
  };

  const openEdit = (s: any) => {
    setEditingSession(s);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-foreground">Sessielijst</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Alle geplande projecten & workshops</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken..." className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-28 shrink-0 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle types</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="workshop">Workshop</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-32 shrink-0 h-8 text-xs"><SelectValue placeholder="Locatie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle locaties</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-32 shrink-0 h-8 text-xs"><SelectValue placeholder="Teamlid" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle teamleden</SelectItem>
              {teamMembers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Geen sessies gevonden</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="lg:hidden space-y-2">
            {filtered.map(s => (
              <button
                key={s.id}
                onClick={() => openEdit(s)}
                className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{s.title}</span>
                      <Badge variant="outline" className={`text-[10px] py-0 ${s.session_type === "project" ? "border-primary/40 text-primary" : "border-emerald-500/40 text-emerald-400"}`}>
                        {s.session_type === "project" ? "Project" : "Workshop"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {format(new Date(s.session_date), "d MMM yyyy", { locale: nl })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {s.start_time} - {s.end_time}
                      </span>
                      {s.location_id && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} />
                          {getLocationName(s.location_id)}
                        </span>
                      )}
                      {s.team_member_id && (
                        <span className="flex items-center gap-1">
                          <Users size={10} />
                          {getTeamName(s.team_member_id)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${statusBadge(s.status)}`}>
                    {statusLabel(s.status)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden lg:block rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Tijd</TableHead>
                  <TableHead>Locatie</TableHead>
                  <TableHead>Teamlid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => openEdit(s)}>
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.session_type === "project" ? "border-primary/40 text-primary" : "border-emerald-500/40 text-emerald-400"}>
                        {s.session_type === "project" ? "Project" : "Workshop"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(s.session_date), "d MMM yyyy", { locale: nl })}</TableCell>
                    <TableCell className="text-muted-foreground">{s.start_time} - {s.end_time}</TableCell>
                    <TableCell className="text-muted-foreground">{getLocationName(s.location_id)}</TableCell>
                    <TableCell className="text-muted-foreground">{getTeamName(s.team_member_id)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(s.status)}`}>
                        {statusLabel(s.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit3 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <OrgSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={editingSession}
        defaultDate={null}
        locations={locations}
        teamMembers={teamMembers}
        onSaved={loadData}
      />
    </div>
  );
};

export default OrgSessionList;
