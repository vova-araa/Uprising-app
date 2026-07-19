import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Clock, Music, Mic, Calendar, TrendingUp, Users, BookOpen, Check, ChevronRight, X, Wallet, Gift, Crown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import AccountAccessSection from "@/components/AccountAccessSection";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const mockStats = {
  totalHours: 47,
  sessionsThisMonth: 5,
  totalSessions: 23,
  activeProjects: 2,
  mixMasterProjects: 1,
};

const monthlyData = [
  { month: "Okt", hours: 8 },
  { month: "Nov", hours: 12 },
  { month: "Dec", hours: 6 },
  { month: "Jan", hours: 10 },
  { month: "Feb", hours: 14 },
  { month: "Mrt", hours: 11 },
];

const recentSessions = [
  { date: "8 mrt", studio: "Studio 1", hours: 3, type: "Recording" },
  { date: "5 mrt", studio: "Studio 2", hours: 2, type: "Mixing" },
  { date: "1 mrt", studio: "Content Room", hours: 4, type: "Podcast" },
  { date: "25 feb", studio: "Studio 1", hours: 3, type: "Recording" },
];

const hasBroedplaats = true;

const DashboardPage = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [creditBalance, setCreditBalance] = useState(0);
  const [freeHours, setFreeHours] = useState({ studio1: 0, studio2: 0, content: 0 });
  const [hasActiveAccess, setHasActiveAccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("credit_balance, studio1_hours, studio2_hours, content_hours").eq("id", user.id).single();
      if (data) {
        setCreditBalance(Number(data.credit_balance) || 0);
        setFreeHours({
          studio1: data.studio1_hours || 0,
          studio2: data.studio2_hours || 0,
          content: data.content_hours || 0,
        });
      }
    };

    const checkAccess = async () => {
      if (!user) return;
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("booking_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("access_status", "active")
        .lte("access_start", now)
        .gte("access_end", now)
        .limit(1);
      setHasActiveAccess(!!(data && data.length > 0));
    };

    fetchProfile();
    checkAccess();
  }, [user]);

  const [weekRsvp, setWeekRsvp] = useState<Record<string, { attending: boolean; confirmed: boolean; activity: string | null }>>({
    day1: { attending: false, confirmed: false, activity: null },
    day2: { attending: false, confirmed: false, activity: null },
  });
  const [workshopRsvp, setWorkshopRsvp] = useState(false);
  const [workshopConfirmed, setWorkshopConfirmed] = useState(false);

  const toggleDayAttendance = (dayId: string) => {
    setWeekRsvp((prev) => ({
      ...prev,
      [dayId]: { ...prev[dayId], attending: !prev[dayId].attending, confirmed: false, activity: !prev[dayId].attending ? prev[dayId].activity : null },
    }));
  };

  const setDayActivity = (dayId: string, activity: string) => {
    setWeekRsvp((prev) => ({
      ...prev,
      [dayId]: { ...prev[dayId], activity },
    }));
  };

  const confirmDay = (dayId: string) => {
    setWeekRsvp((prev) => ({
      ...prev,
      [dayId]: { ...prev[dayId], confirmed: true, attending: true },
    }));
  };

  const cancelDay = (dayId: string) => {
    setWeekRsvp((prev) => ({
      ...prev,
      [dayId]: { attending: false, confirmed: false, activity: null },
    }));
  };

  const maxHours = Math.max(...monthlyData.map((d) => d.hours));

  const broedplaatsWeekDays = [
    { id: "day1", label: t("day1"), sublabel: t("toBeDetermined") },
    { id: "day2", label: t("day2"), sublabel: t("toBeDetermined") },
  ];

  const activityOptions = [
    { id: "studio", label: "Studio" },
    { id: "content", label: "Content" },
    { id: "clothing", label: t("clothingLabel") },
  ];

  return (
    <div className="min-h-full">
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-2xl font-bold font-display">{t("dashboard")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("yourCreativeProgress")}</p>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-7 mt-4 pb-6">
        {/* Access Section - always visible */}
        <AccountAccessSection />

        {/* Studio Abonnement CTA */}
        <motion.div variants={item}>
          <button
            onClick={() => navigate("/diensten/memberships")}
            className="w-full flex items-center gap-4 rounded-xl bg-primary/10 border border-primary/30 p-4 transition-all hover:bg-primary/20 active:scale-[0.98]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary shrink-0">
              <Crown size={20} className="text-primary-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold font-display">{t("studioSubscription")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {lang === "nl" ? "Bekijk onze studio-abonnementen" : "View our studio memberships"}
              </p>
            </div>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={item}>
          <h2 className="text-lg font-bold font-display mb-4">
            {t("studioHours")} & {t("activeProjects")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Clock, label: t("studioHours"), value: `${mockStats.totalHours}h`, color: "text-primary", bg: "gradient-primary" },
              { icon: Calendar, label: t("sessionsThisMonth"), value: mockStats.sessionsThisMonth.toString(), color: "text-success", bg: "bg-success/20" },
              { icon: Music, label: t("activeProjects"), value: mockStats.activeProjects.toString(), color: "text-warning", bg: "bg-warning/20" },
              { icon: Mic, label: "Mix & Master", value: mockStats.mixMasterProjects.toString(), color: "text-primary", bg: "bg-primary/20" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-card border border-border p-4 shadow-sm">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg} mb-3`}>
                  <stat.icon size={18} className={stat.icon === Clock ? "text-primary-foreground" : stat.color} />
                </div>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tegoed & Gratis Uren */}
        {(creditBalance > 0 || freeHours.studio1 > 0 || freeHours.studio2 > 0 || freeHours.content > 0) && (
          <motion.div variants={item}>
            <h2 className="text-lg font-bold font-display mb-4">
              {t("creditsAndAssignedHours")}
            </h2>
            <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
              <div className="space-y-3">
                {creditBalance > 0 && (
                  <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 shrink-0">
                      <Wallet size={18} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{t("creditBalance")}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t("creditBalanceDesc")}
                      </p>
                    </div>
                    <span className="text-xl font-bold text-primary font-display">{creditBalance > 0 ? `€${creditBalance}` : "-"}</span>
                  </div>
                )}
                {(freeHours.studio1 > 0 || freeHours.studio2 > 0 || freeHours.content > 0) && (
                  <div className="rounded-xl bg-success/5 border border-success/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Gift size={14} className="text-success" />
                      <p className="text-xs font-semibold text-success">
                        {t("assignedHours")}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {freeHours.studio1 > 0 && (
                        <div className="rounded-lg bg-card border border-border p-3 text-center">
                          <p className="text-lg font-bold font-display">{`${freeHours.studio1}h`}</p>
                          <p className="text-[10px] text-muted-foreground">Studio 1</p>
                        </div>
                      )}
                      {freeHours.studio2 > 0 && (
                        <div className="rounded-lg bg-card border border-border p-3 text-center">
                          <p className="text-lg font-bold font-display">{`${freeHours.studio2}h`}</p>
                          <p className="text-[10px] text-muted-foreground">Studio 2</p>
                        </div>
                      )}
                      {freeHours.content > 0 && (
                        <div className="rounded-lg bg-card border border-border p-3 text-center">
                          <p className="text-lg font-bold font-display">{`${freeHours.content}h`}</p>
                          <p className="text-[10px] text-muted-foreground">Content Room</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Broedplaats Section */}
        {hasBroedplaats && (
          <motion.div variants={item}>
            <h2 className="text-lg font-bold font-display mb-4">
              {t("creativeHub")}
            </h2>
            <div className="rounded-xl bg-card border border-primary/20 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                  <Users size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold font-display text-sm">{t("creativeHub")}</h3>
                  <p className="text-[10px] text-muted-foreground">{t("weeklyDays")} & workshops</p>
                </div>
              </div>

              {/* Weekly days */}
              <div className="space-y-3 mb-5" data-toast-section>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("weeklyDays")}</p>
                {broedplaatsWeekDays.map((day) => {
                  const dayState = weekRsvp[day.id];
                  const isConfirmed = dayState?.confirmed;
                  const isSelecting = dayState?.attending && !isConfirmed;

                  return (
                    <div key={day.id} className="rounded-xl bg-secondary/60 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold">{day.label}</p>
                          <p className="text-[10px] text-muted-foreground">{day.sublabel}</p>
                        </div>
                        {isConfirmed ? (
                          <button
                            onClick={() => cancelDay(day.id)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold gradient-primary text-primary-foreground shadow-glow transition-all"
                          >
                            <Check size={12} />
                            {t("attending")}
                            <X size={12} className="ml-1 opacity-70" />
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleDayAttendance(day.id)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                              isSelecting
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "bg-card border border-border text-muted-foreground"
                            }`}
                          >
                            {t("signUp")}
                          </button>
                        )}
                      </div>
                      {isSelecting && (
                        <div className="space-y-3 mt-2">
                          <div className="flex gap-2">
                            {activityOptions.map((act) => {
                              const isSelected = dayState?.activity === act.id;
                              return (
                                <button
                                  key={act.id}
                                  onClick={() => setDayActivity(day.id, act.id)}
                                  className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition-all ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-card border border-border text-muted-foreground"
                                  }`}
                                >
                                  {act.label}
                                </button>
                              );
                            })}
                          </div>
                          {dayState?.activity && (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`confirm-${day.id}`}
                                onCheckedChange={(checked) => {
                                  if (checked) confirmDay(day.id);
                                }}
                              />
                              <label htmlFor={`confirm-${day.id}`} className="text-xs font-medium cursor-pointer">
                                {t("confirmSignUp")}
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Monthly workshop */}
              <div data-toast-section>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("monthlyWorkshop")}</p>
                <div className="rounded-xl bg-secondary/60 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 shrink-0 mt-0.5">
                      <BookOpen size={16} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{t("workshopComingSoon")}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t("workshopDesc")}</p>
                      <p className="text-[10px] text-primary font-semibold mt-1">{t("dateTbd")}</p>
                    </div>
                  </div>
                  {workshopConfirmed ? (
                    <button
                      onClick={() => { setWorkshopConfirmed(false); setWorkshopRsvp(false); }}
                      className="w-full mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold gradient-primary text-primary-foreground shadow-glow transition-all"
                    >
                      <Check size={12} />
                      {t("signedUp")}
                      <X size={12} className="ml-1 opacity-70" />
                    </button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="workshop-confirm"
                          checked={workshopRsvp}
                          onCheckedChange={(checked) => setWorkshopRsvp(!!checked)}
                        />
                        <label htmlFor="workshop-confirm" className="text-xs font-medium cursor-pointer">
                          {t("wantToSignUpWorkshop")}
                        </label>
                      </div>
                      {workshopRsvp && (
                        <button
                          onClick={() => setWorkshopConfirmed(true)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold bg-primary text-primary-foreground transition-all"
                        >
                          <Check size={12} />
                          {t("signUpForWorkshop")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Monthly Chart */}
        <motion.div variants={item}>
          <h2 className="text-lg font-bold font-display mb-4">
            {t("studioHoursPerMonth")}
          </h2>
          <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
            <div className="flex items-end gap-2 h-32">
              {monthlyData.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-primary">{d.hours}h</span>
                  <div
                    className="w-full rounded-t-md gradient-primary transition-all"
                    style={{ height: `${(d.hours / maxHours) * 100}%`, minHeight: 4 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.month}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Total Progress */}
        <motion.div variants={item}>
          <h2 className="text-lg font-bold font-display mb-4">
            {t("totalProgress")}
          </h2>
          <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{t("totalSessions")}</span>
                  <span className="font-semibold">{mockStats.totalSessions}</span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full gradient-primary" style={{ width: "76%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{t("studioHours")}</span>
                  <span className="font-semibold">{mockStats.totalHours}h</span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-success" style={{ width: "62%" }} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Sessions Timeline */}
        <motion.div variants={item}>
          <h2 className="text-lg font-bold font-display mb-4">
            {t("recentSessions")}
          </h2>
          <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
            <div className="space-y-0">
              {recentSessions.map((session, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full gradient-primary" />
                    {i < recentSessions.length - 1 && <div className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{session.studio}</p>
                      <span className="text-xs text-muted-foreground">{session.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.hours}h · {session.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default DashboardPage;
