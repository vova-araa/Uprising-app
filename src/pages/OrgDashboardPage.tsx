import { useState } from "react";
import {
  CalendarDays, List, BarChart3, MapPin, Users, School, Route,
  ChevronLeft, Menu, Flame, ListTodo
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OrgCalendarView from "@/components/org/OrgCalendarView";
import OrgSessionList from "@/components/org/OrgSessionList";
import OrgReports from "@/components/org/OrgReports";
import OrgInsights from "@/components/org/OrgInsights";
import OrgLocations from "@/components/org/OrgLocations";
import OrgTeamMembers from "@/components/org/OrgTeamMembers";
import OrgWorkshopsList from "@/components/org/OrgWorkshopsList";
import OrgTrajecten from "@/components/org/OrgTrajecten";
import OrgBroedplaats from "@/components/org/OrgBroedplaats";
import OrgTasksOverview from "@/components/org/OrgTasksOverview";

type OrgTab = "calendar" | "sessions" | "reports" | "insights" | "locations" | "team" | "schools" | "trajecten" | "broedplaats" | "tasks";

const tabs: { id: OrgTab; label: string; icon: any }[] = [
  { id: "calendar", label: "Kalender", icon: CalendarDays },
  { id: "tasks", label: "Taken", icon: ListTodo },
  { id: "sessions", label: "Sessies", icon: List },
  { id: "trajecten", label: "Trajecten", icon: Route },
  { id: "schools", label: "Workshops", icon: School },
  { id: "broedplaats", label: "Broedplaats", icon: Flame },
  { id: "reports", label: "Rapportages", icon: BarChart3 },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "locations", label: "Locaties", icon: MapPin },
  { id: "team", label: "Team", icon: Users },
];

const OrgDashboardPage = () => {
  const [activeTab, setActiveTab] = useState<OrgTab>("calendar");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100dvh-4rem)] bg-background">
      {/* Mobile: Horizontal scrollable tab bar */}
      <div className="lg:hidden border-b border-border bg-card sticky top-0 z-30">
        <div className="flex items-center gap-1 px-2 py-1.5">
          <h2 className="text-sm font-bold text-foreground px-2 shrink-0">Stichting</h2>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 px-2 pb-2 min-w-max">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0
                    ${isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                >
                  <tab.icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: Sidebar */}
      <aside
        className={`hidden lg:flex ${
          sidebarOpen ? "w-56" : "w-14"
        } shrink-0 border-r border-border bg-card transition-all duration-200 flex-col`}
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          {sidebarOpen && (
            <h2 className="text-sm font-bold text-foreground tracking-tight">
              Stichting
            </h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <tab.icon size={18} />
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6" data-toast-section>
        {activeTab === "calendar" && <OrgCalendarView />}
        {activeTab === "tasks" && <OrgTasksOverview />}
        {activeTab === "sessions" && <OrgSessionList />}
        {activeTab === "trajecten" && <OrgTrajecten />}
        {activeTab === "schools" && <OrgWorkshopsList />}
        {activeTab === "broedplaats" && <OrgBroedplaats />}
        {activeTab === "reports" && <OrgReports />}
        {activeTab === "insights" && <OrgInsights />}
        {activeTab === "locations" && <OrgLocations />}
        {activeTab === "team" && <OrgTeamMembers />}
      </main>
    </div>
  );
};

export default OrgDashboardPage;
