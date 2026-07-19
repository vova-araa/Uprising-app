import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, Sliders, ChevronRight, Clock, ArrowRight, Layers, DoorOpen, Users, AlertTriangle, X, Info, Crown, Sparkles, Bell, Loader2, Instagram } from "lucide-react";
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

  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: fetchAvailability,
  });

  const visibleSlots = useMemo(() => {
    const currentHour = new Date().getHours();
    return todaySlots.filter((_, i) => i > currentHour).slice(0, 8);
  }, [todaySlots]);

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
      <motion.div variants={item} className="relative overflow-hidden lg:rounded-2xl lg:mx-8 lg:mt-4" style={{ height: "calc(320px + var(--safe-area-top))", paddingTop: "var(--safe-area-top)" }}>
        <img src={heroImg} alt="Uprising Studio" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" decoding="async" width={1200} height={320} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute bottom-6 left-5 right-5 lg:left-10 lg:right-10 lg:bottom-10 z-10">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="uppercase tracking-wider mb-1 text-xl lg:text-2xl font-bold text-white">
            {user?.user_metadata?.full_name
              ? `${t("welcome")}, ${user.user_metadata.full_name}`
              : t("yourCreativePlatform")}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl lg:text-5xl font-bold font-display leading-tight">
            {lang === "nl" ? heroContent.titleNl : heroContent.titleEn}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-2 max-w-[280px] lg:max-w-[420px] text-white text-base lg:text-lg">
            {t(heroContent.subtitleKey as any)}
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}
            onClick={() => navigate(heroContent.ctaPath)}
            className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 lg:px-6 lg:py-3 text-sm lg:text-base font-semibold text-primary-foreground active:scale-[0.97] lg:hover:bg-primary/90 lg:hover:scale-[1.02] transition-all">
            {t(heroContent.ctaLabelKey as any)}
            <ArrowRight size={16} />
          </motion.button>
        </div>
      </motion.div>
      )}

      <div className="px-5 lg:px-8 space-y-7 mt-6">
        {/* Quick Actions */}
        {visibleSections.some(s => s.id === "quick_actions") && (
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
        {visibleSections.some(s => s.id === "featured_studios") && (
        <motion.section variants={item} className="pb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("featuredServices")}
          </h2>
          <div className="flex lg:grid lg:grid-cols-3 gap-3 overflow-x-auto lg:overflow-visible pb-2 -mx-1 px-1 scrollbar-none">
            {studios.map((studio, idx) => (
              <motion.button
                key={studio.id}
                whileHover={{ y: -4 }}
                onClick={() => navigate(`/book?studio=${studio.id}`)}
                className="relative flex-shrink-0 w-[260px] lg:w-full rounded-2xl overflow-hidden border border-border card-premium transition-all hover:border-primary/40 hover:shadow-glow active:scale-[0.98] lg:hover:scale-[1.01] lg:hover:-translate-y-1"
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
