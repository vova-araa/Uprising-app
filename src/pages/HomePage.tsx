import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, Sliders, ChevronRight, Clock, ArrowRight, Layers, DoorOpen, Users, AlertTriangle, X, Info, Crown, Sparkles, Bell, Loader2, Instagram, Camera, Music } from "lucide-react";
import { useAIOverlay } from "@/components/AppShell";
import heroImg from "@/assets/hero-studio.webp";
import studioAImg from "@/assets/studio-a.webp";
import studioBImg from "@/assets/studio-b.webp";
import contentRoomImg from "@/assets/content-room-2.webp";
import { useMemo, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns/format";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import SEO from "@/components/SEO";

const studioImages: Record<string, string> = {
  "studio-1": studioAImg,
  "studio-2": studioBImg,
  "content-room": contentRoomImg
};

const iconMap: Record<string, any> = {
  Mic, Sliders, DoorOpen, Users, Layers, ChevronRight, Clock, ArrowRight, Crown,
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

interface TimeSlotAvailability {
  time: string;
  available: boolean;
  availableStudios: string[];
}

const HomePage = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setShowAI } = useAIOverlay();
  const config = useAppConfig();
  const [todaySlots, setTodaySlots] = useState<TimeSlotAvailability[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [summary, setSummary] = useState<{ next: any | null; points: number; wallet: number; lastStudio: string | null } | null>(null);

  const studios = config.studios;
  const studioNameMap = config.studioDisplayNames;
  const heroContent = config.heroContent;
  const featureFlags = config.featureFlags;
  const banner = config.announcementBanner;
  const sections = config.homepageSections;

  const fetchAvailability = useCallback(async () => {
    if (!featureFlags.booking_enabled) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: bookings } = await supabase.rpc("get_booking_availability", { target_date: today });

    const bookedHours = new Set<string>();
    if (bookings) {
      for (const b of bookings) {
        const startHour = parseInt(b.start_time.split(":")[0], 10);
        for (let h = startHour; h < startHour + b.duration_hours; h++) {
          bookedHours.add(`${b.studio_id}:${h}`);
        }
      }
    }

    const studioIds = studios.map(s => s.id);
    const now = new Date();
    const currentHour = now.getHours();

    const slots: TimeSlotAvailability[] = [];
    for (let h = 0; h < 24; h++) {
      const isPast = h <= currentHour;
      const freeStudios = studioIds.filter(sid => !bookedHours.has(`${sid}:${h}`));
      slots.push({
        time: `${h.toString().padStart(2, "0")}:00`,
        available: !isPast && freeStudios.length > 0,
        availableStudios: isPast ? [] : freeStudios,
      });
    }
    setTodaySlots(slots);
  }, [studios, featureFlags.booking_enabled]);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  // Personalized summary for logged-in users
  useEffect(() => {
    if (!user) { setSummary(null); return; }
    const load = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const [nextRes, lastRes, profRes] = await Promise.all([
        supabase.from("bookings").select("id, studio_id, booking_date, start_time, duration_hours")
          .eq("user_id", user.id).eq("status", "confirmed").gte("booking_date", today)
          .order("booking_date", { ascending: true }).limit(1),
        supabase.from("bookings").select("studio_id").eq("user_id", user.id).eq("status", "confirmed")
          .order("booking_date", { ascending: false }).limit(1),
        supabase.from("profiles").select("points_balance, credit_balance").eq("id", user.id).maybeSingle(),
      ]);
      setSummary({
        next: nextRes.data?.[0] || null,
        points: (profRes.data as any)?.points_balance || 0,
        wallet: Number((profRes.data as any)?.credit_balance || 0),
        lastStudio: lastRes.data?.[0]?.studio_id || null,
      });
    };
    load();
  }, [user]);

  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: fetchAvailability,
  });

  const visibleSlots = useMemo(() => {
    const currentHour = new Date().getHours();
    return todaySlots.filter((_, i) => i > currentHour).slice(0, 8);
  }, [todaySlots]);

  // Last-minute deals: free slots starting within the configured window today
  const lastMinuteCfg = { enabled: false, discount_pct: 25, within_hours: 6, ...(config.getConfigRaw("lastminute_pricing") || {}) };
  const dealSlots = useMemo(() => {
    if (!lastMinuteCfg.enabled) return [] as TimeSlotAvailability[];
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return todaySlots.filter((s) => {
      if (!s.available) return false;
      const startMin = parseInt(s.time.split(":")[0], 10) * 60;
      const lead = startMin - nowMin;
      return lead > 0 && lead <= lastMinuteCfg.within_hours * 60;
    }).slice(0, 8);
  }, [todaySlots, lastMinuteCfg.enabled, lastMinuteCfg.within_hours]);

  const quickActions = config.quickActions
    .filter(a => a.visible)
    .map(a => ({ label: t(a.labelKey as any), icon: iconMap[a.icon] || Layers, path: a.path }));

  const visibleSections = sections.filter(s => s.visible).sort((a, b) => a.sort - b.sort);

  // While config is still loading, show ONLY the centered logo (no flashing of social buttons / partial layout)
  if (config.loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "100dvh" }}>
        <img src="/uprising-logo.png" alt="Uprising Studio" className="w-16 h-16 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Maintenance mode
  if (featureFlags.maintenance_mode) {
    return (
      <div className="min-h-full flex items-center justify-center px-5">
        <div className="text-center space-y-4">
          <AlertTriangle size={48} className="mx-auto text-warning" />
          <h1 className="text-2xl font-bold font-display">Onderhoudsmodus</h1>
          <p className="text-muted-foreground">De app wordt momenteel bijgewerkt. Probeer het later opnieuw.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <SEO title="Uprising Studio — Studio's & Ruimtes Amersfoort" description="Boek muziekstudio's, contentruimtes en creatieve diensten bij Uprising Studio in Amersfoort." path="/" />
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : 0 }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            opacity: progress,
            transform: `rotate(${progress * 360}deg)`,
            transition: isRefreshing ? "none" : "transform 0.1s ease-out",
          }}
        >
          <Loader2
            size={22}
            className={`text-primary ${isRefreshing ? "animate-spin" : ""}`}
          />
        </div>
      </div>
      <motion.div variants={container} initial="hidden" animate="show">
      {/* Announcement Banner */}
      {banner.visible && banner.message && !bannerDismissed && (
        <motion.div variants={item} className={`mx-5 mt-3 rounded-xl p-3 flex items-center gap-3 ${
          banner.type === "warning" ? "bg-warning/20 border border-warning/30" :
          banner.type === "error" ? "bg-destructive/20 border border-destructive/30" :
          banner.type === "success" ? "bg-success/20 border border-success/30" :
          "bg-primary/20 border border-primary/30"
        }`}>
          <Info size={16} className={banner.type === "warning" ? "text-warning" : banner.type === "error" ? "text-destructive" : "text-primary"} />
          <p className="text-xs flex-1">{banner.message}</p>
          {banner.dismissible && (
            <button onClick={() => setBannerDismissed(true)} aria-label="Sluiten"><X size={14} className="text-muted-foreground" /></button>
          )}
        </motion.div>
      )}

      {/* Hero */}
      {visibleSections.some(s => s.id === "hero") && (
      <motion.div variants={item} className="relative overflow-hidden lg:rounded-3xl lg:mx-8 lg:mt-4" style={{ height: "calc(360px + var(--safe-area-top))", paddingTop: "var(--safe-area-top)" }}>
        <img src={heroImg} alt="Uprising Studio" className="absolute inset-0 h-full w-full object-cover scale-105" fetchPriority="high" decoding="async" width={1200} height={360} />
        {/* Cinematic grade: bottom-up dark lift + purple studio glow + side vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/78 to-background/10" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 82% 8%, hsl(272 96% 58% / 0.42), transparent 55%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, hsl(250 30% 4% / 0.55), transparent 30%, transparent 78%, hsl(250 30% 4% / 0.5))" }} />
        <div className="absolute bottom-6 left-5 right-5 lg:left-10 lg:right-10 lg:bottom-10 z-10">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 uppercase tracking-[0.18em] mb-2.5 text-[11px] lg:text-xs font-bold text-white/85">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
            {user?.user_metadata?.full_name
              ? `${t("welcome")}, ${user.user_metadata.full_name}`
              : t("yourCreativePlatform")}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
            className="text-[2.6rem] leading-[0.95] lg:text-6xl font-extrabold font-display tracking-[-0.02em] text-white"
            style={{ textShadow: "0 2px 24px hsl(272 92% 30% / 0.55), 0 1px 2px hsl(0 0% 0% / 0.4)" }}>
            {lang === "nl" ? heroContent.titleNl : heroContent.titleEn}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-3 max-w-[290px] lg:max-w-[440px] text-white/80 text-[15px] lg:text-lg leading-snug">
            {t(heroContent.subtitleKey as any)}
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}
            onClick={() => navigate(heroContent.ctaPath)}
            className="btn-glow mt-5 inline-flex items-center gap-2 rounded-2xl px-6 py-3 lg:px-7 lg:py-3.5 text-sm lg:text-base font-bold text-primary-foreground active:scale-[0.97] lg:hover:scale-[1.03] transition-transform">
            {t(heroContent.ctaLabelKey as any)}
            <ArrowRight size={17} strokeWidth={2.5} />
          </motion.button>
        </div>
      </motion.div>
      )}

      <div className="px-5 lg:px-8 space-y-7 mt-6">
        {/* What can you do here? — clear capability overview for every visitor */}
        <motion.section variants={item}>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-5 w-1 rounded-full accent-bar" />
            <h2 className="text-xl font-extrabold font-display leading-tight tracking-[-0.01em]">{t("capsTitle")}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-4 pl-3.5">{t("capsSubtitle")}</p>
          {/* Bento grid: featured wide tile → 2×2 blocks → wide upsell bar */}
          <div className="grid grid-cols-2 gap-3">
            {/* Featured — Studio boeken (wide, prominent) */}
            <button onClick={() => navigate("/book?type=studio")}
              className="col-span-2 group relative flex items-center gap-4 rounded-2xl card-feature border border-white/5 p-5 text-left transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.99]">
              <div className="icon-tile flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105">
                <Mic size={26} className="text-white" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-extrabold font-display leading-tight tracking-[-0.01em]">{t("cap1Label")}</p>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">{lang === "nl" ? "Populair" : "Popular"}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug mt-1 max-w-[38ch]">{t("cap1Desc")}</p>
              </div>
              <ChevronRight size={20} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
            </button>

            {/* 2×2 blocks */}
            {[
              { icon: Camera, label: t("cap2Label"), desc: t("cap2Desc"), path: "/diensten/content" },
              { icon: Sliders, label: t("cap3Label"), desc: t("cap3Desc"), path: "/mix-master" },
              { icon: Music, label: t("cap4Label"), desc: t("cap4Desc"), path: "/diensten/producer-session" },
              { icon: Sparkles, label: t("cap5Label"), desc: t("cap5Desc"), path: user ? "/coach" : "/auth" },
            ].map((c) => (
              <button key={c.label} onClick={() => navigate(c.path)}
                className="group flex flex-col gap-3 rounded-2xl card-feature border border-white/5 p-4 text-left transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.98]">
                <div className="icon-tile flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105">
                  <c.icon size={20} className="text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[15px] font-bold font-display leading-tight">{c.label}</p>
                  <p className="text-[11.5px] text-muted-foreground leading-snug mt-1">{c.desc}</p>
                </div>
              </button>
            ))}

            {/* Wide upsell — Memberships */}
            <button onClick={() => navigate("/diensten/memberships")}
              className="col-span-2 group relative flex items-center gap-4 rounded-2xl card-feature border border-white/5 p-4 text-left transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.99]">
              <div className="icon-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105">
                <Crown size={22} className="text-white" strokeWidth={2.1} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold font-display leading-tight">{t("cap6Label")}</p>
                <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">{t("cap6Desc")}</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
            </button>
          </div>
        </motion.section>

        {/* Personalized summary (logged-in) */}
        {user && summary && (
        <motion.section variants={item}>
          <div className="card-premium rounded-2xl border border-border p-4">
            {summary.next ? (
              <button onClick={() => navigate("/account?tab=bookings")} className="w-full flex items-center justify-between text-left mb-3">
                <div>
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">{lang === "nl" ? "Volgende sessie" : "Next session"}</p>
                  <p className="text-sm font-bold font-display mt-0.5">{studioNameMap[summary.next.studio_id] || summary.next.studio_id}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(summary.next.booking_date), "EEE d MMM")} • {summary.next.start_time} • {summary.next.duration_hours}u</p>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            ) : (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{lang === "nl" ? "Geen komende sessie" : "No upcoming session"}</p>
                {summary.lastStudio && (
                  <button onClick={() => navigate(`/book?studio=${summary.lastStudio}`)}
                    className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary flex items-center gap-1">
                    <ArrowRight size={13} /> {lang === "nl" ? "Boek opnieuw" : "Book again"}
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
              <button onClick={() => navigate("/account")} className="text-center">
                <p className="text-lg font-bold font-display text-primary">€{summary.wallet}</p>
                <p className="text-[10px] text-muted-foreground">{lang === "nl" ? "Tegoed" : "Credit"}</p>
              </button>
              <button onClick={() => navigate("/account?tab=settings")} className="text-center border-x border-border">
                <p className="text-lg font-bold font-display text-primary">{summary.points}</p>
                <p className="text-[10px] text-muted-foreground">Points</p>
              </button>
              <button onClick={() => navigate("/coach")} className="text-center">
                <p className="text-lg font-bold font-display text-primary">🎯</p>
                <p className="text-[10px] text-muted-foreground">Coach</p>
              </button>
            </div>
          </div>
        </motion.section>
        )}

        {/* Quick Actions */}
        {visibleSections.some(s => s.id === "quick_actions") && quickActions.length > 0 && (
        <motion.section variants={item}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("quickActions")}
          </h2>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-3">
            {quickActions.map((action) =>
              <button key={action.label} onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-2 rounded-xl bg-primary/10 border border-primary/40 p-3 lg:p-4 text-center transition-all hover:bg-primary/20 hover:border-primary hover:shadow-glow active:scale-[0.98] lg:hover:scale-[1.02] lg:hover:-translate-y-0.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <action.icon size={18} className="text-primary" />
                </div>
                <span className="text-[11px] lg:text-xs font-medium leading-tight">{action.label}</span>
              </button>
            )}
          </div>
        </motion.section>
        )}

        {/* Last-minute deals */}
        {featureFlags.booking_enabled && dealSlots.length > 0 && (
        <motion.section variants={item}>
          <div className="rounded-2xl border border-primary/30 card-premium p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚡</span>
              <h2 className="text-sm font-bold font-display">{lang === "nl" ? `Last-minute — ${lastMinuteCfg.discount_pct}% korting vandaag` : `Last-minute — ${lastMinuteCfg.discount_pct}% off today`}</h2>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">{lang === "nl" ? "Boek een vrij slot dat binnenkort start en pak de korting." : "Book a free slot starting soon and grab the discount."}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {dealSlots.map((slot) => (
                <button key={slot.time} onClick={() => navigate("/book?type=studio")}
                  className="flex shrink-0 flex-col items-center rounded-lg bg-primary/10 border border-primary/30 px-3 py-2.5 text-xs font-semibold min-w-[76px] active:scale-[0.97]">
                  <Clock size={14} className="text-primary mb-1" />
                  <span>{slot.time}</span>
                  <span className="text-[9px] text-primary mt-0.5">-{lastMinuteCfg.discount_pct}%</span>
                </button>
              ))}
            </div>
          </div>
        </motion.section>
        )}

        {/* Today's Availability */}
        {visibleSections.some(s => s.id === "today_availability") && featureFlags.booking_enabled && (
        <motion.section variants={item}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("todayAvailability")}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {visibleSlots.length > 0 ? visibleSlots.map((slot) =>
              <button key={slot.time} disabled={!slot.available} onClick={() => navigate("/book?type=studio")}
                className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-2.5 text-xs font-medium transition-all min-w-[80px] ${
                  slot.available ? "bg-card border border-border hover:border-primary/40" : "bg-muted/50 text-muted-foreground opacity-50"
                }`}>
                <Clock size={14} className={slot.available ? "text-primary mb-1" : "mb-1"} />
                <span>{slot.time}</span>
                {slot.available && slot.availableStudios.length > 0 && (
                  <span className="text-[9px] text-muted-foreground mt-1 leading-tight text-center">
                    {slot.availableStudios.map(id => studioNameMap[id] || id).join(", ")}
                  </span>
                )}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("noMoreSlots")}</p>
            )}
          </div>
        </motion.section>
        )}

        {/* AI & Notifications */}
        {user && (
        <motion.section variants={item}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* AI Assistant */}
            {featureFlags.ai_assistant_enabled && (
              <button onClick={() => setShowAI(true)}
                className="flex flex-col items-center gap-2 rounded-xl bg-primary/10 border border-primary/40 p-4 text-center transition-all hover:bg-primary/20 hover:border-primary hover:shadow-glow active:scale-[0.98] lg:hover:scale-[1.02]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Sparkles size={18} className="text-primary" />
                </div>
                <span className="text-[11px] lg:text-xs font-medium leading-tight">AI Assistant</span>
              </button>
            )}
            {/* Notifications / Settings */}
            <button onClick={() => navigate({ pathname: "/account", search: "?tab=settings" })}
              className="flex flex-col items-center gap-2 rounded-xl bg-primary/10 border border-primary/40 p-4 text-center transition-all hover:bg-primary/20 hover:border-primary hover:shadow-glow active:scale-[0.98] lg:hover:scale-[1.02]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Bell size={18} className="text-primary" />
              </div>
              <span className="text-[11px] lg:text-xs font-medium leading-tight">{t("notifications") || "Meldingen"}</span>
            </button>
          </div>
        </motion.section>
        )}

        {/* Featured Studios */}
        {visibleSections.some(s => s.id === "featured_studios") && studios.length > 0 && (
        <motion.section variants={item} className="pb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("featuredStudios")}
          </h2>
          <div className="flex lg:grid lg:grid-cols-3 gap-3 overflow-x-auto lg:overflow-visible pb-2 -mx-1 px-1 scrollbar-none">
            {studios.map((studio, idx) => (
              <motion.button
                key={studio.id}
                whileHover={{ y: -4 }}
                onClick={() => navigate(`/book?studio=${studio.id}`)}
                className="group relative flex-shrink-0 w-[260px] lg:w-full rounded-2xl overflow-hidden border border-border card-premium transition-all hover:border-primary/40 hover:shadow-glow active:scale-[0.98] lg:hover:scale-[1.01] lg:hover:-translate-y-1"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={studioImages[studio.id]}
                    alt={t(studio.nameKey as any)}
                    className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    decoding="async"
                    width={520}
                    height={390}
                    {...(idx === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                  <div className="absolute top-3 right-3 rounded-full glass border border-primary/30 px-3 py-1">
                    <span className="text-xs font-bold text-primary">€{studio.pricePerHour}/{t("perHr")}</span>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-lg font-bold font-display text-white drop-shadow-lg">
                      {t(studio.nameKey as any)}
                    </h3>
                    <p className="text-xs text-white/80 mt-0.5 drop-shadow">
                      {t(studio.descKey as any)}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>
        )}

        {/* Social Links */}
        <motion.section variants={item} className="pb-6">
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://www.instagram.com/uprising.nl/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[hsl(280,60%,45%)] to-[hsl(330,70%,50%)] px-5 py-2.5 text-white transition-all active:scale-[0.96] lg:hover:scale-[1.03] lg:hover:shadow-[0_0_20px_hsl(300,60%,40%/0.4)]"
            >
              <Instagram size={18} className="transition-transform group-hover:rotate-12" />
              <span className="text-sm font-semibold tracking-wide">Instagram</span>
            </a>
            <a
              href="https://www.tiktok.com/@uprising_nl"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-full bg-card border border-border px-5 py-2.5 text-foreground transition-all active:scale-[0.96] lg:hover:scale-[1.03] lg:hover:border-primary/50 lg:hover:shadow-glow"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px] transition-transform group-hover:-rotate-12" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.16z"/>
              </svg>
              <span className="text-sm font-semibold tracking-wide">TikTok</span>
            </a>
          </div>
        </motion.section>
      </div>
    </motion.div>
    </div>
  );
};

export default HomePage;
