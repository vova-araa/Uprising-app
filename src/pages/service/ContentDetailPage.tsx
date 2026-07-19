import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, ChevronLeft, Smartphone, Image, Video, Megaphone, ChevronRight, CalendarCheck, UserPlus, Clapperboard, Mic2, Podcast } from "lucide-react";
import SEO from "@/components/SEO";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const contentTypes = [
  { nl: "Podcast & video-podcast", en: "Podcast & video podcast", icon: Podcast },
  { nl: "Social media content", en: "Social media content", icon: Smartphone },
  { nl: "Artist visuals", en: "Artist visuals", icon: Image },
  { nl: "Foto en video opnames", en: "Photo and video recordings", icon: Video },
  { nl: "Promo materiaal", en: "Promo material", icon: Megaphone },
  { nl: "Interviews & talking heads", en: "Interviews & talking heads", icon: Mic2 },
];

const ContentDetailPage = () => {
  const { t, lang } = useI18n();
  const localizedLang = lang === "nl" ? "nl" : "en";
  const navigate = useNavigate();

  const appFlow = [
    { nl: "De content ruimte boeken", en: "Book the content room", icon: CalendarCheck, onRequest: false },
    { nl: "Een fotograaf of content creator boeken", en: "Book a photographer or content creator", icon: UserPlus, onRequest: true },
    { nl: "Content sessies plannen", en: "Plan content sessions", icon: Clapperboard, onRequest: false },
  ];

  return (
    <div className="min-h-full pb-24">
      <SEO title="Contentruimte — Uprising Studio" description="Foto-, video- en contentruimtes voor creators, merken en social media producties." path="/diensten/content" />
      <div className="px-5 pt-4 pb-6">
        <button onClick={() => navigate("/diensten")} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:opacity-70">
          <ChevronLeft size={16} />
          {t("back")}
        </button>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
            <Camera size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Content</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("professionalContentCreation")}</p>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-6">
        {/* Editorial intro with film-strip motif */}
        <motion.div variants={item} className="relative rounded-2xl bg-card border border-border p-5 overflow-hidden">
          <span aria-hidden className="absolute top-0 left-0 right-0 h-2 flex gap-1 px-2 pt-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className="flex-1 h-1 rounded-full bg-primary/30" />
            ))}
          </span>
          <span aria-hidden className="absolute bottom-0 left-0 right-0 h-2 flex gap-1 px-2 pb-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className="flex-1 h-1 rounded-full bg-primary/20" />
            ))}
          </span>
          <p className="text-sm text-muted-foreground leading-relaxed py-3">
            {lang === "nl"
              ? "Naast muziekproductie biedt Uprising Studio ook een volwaardige content- en podcaststudio. Complete podcast-setup, camera, LED panels, green screen en teleprompter — boek per uur, neem je hele aflevering of contentdag in één sessie op."
              : "In addition to music production, Uprising Studio offers a fully equipped content and podcast studio. Complete podcast setup, camera, LED panels, green screen and teleprompter — book by the hour and record your whole episode or content day in one session."}
          </p>
        </motion.div>

        {/* Content types — refined uniform grid */}
        <motion.div variants={item}>
          <h3 className="font-semibold font-display text-sm mb-3 px-1">{t("roomSuitableFor")}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {contentTypes.map((ct) => (
              <div
                key={ct.nl}
                className="group relative rounded-2xl bg-gradient-to-br from-card to-card/40 border border-border/60 p-4 overflow-hidden hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                <span aria-hidden className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex flex-col gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
                    <ct.icon size={18} className="text-primary" />
                  </div>
                  <span className="text-sm font-semibold leading-tight">{ct[localizedLang]}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>


        {/* App features — NUMBERED CHEVRON STEPS */}
        <motion.div variants={item}>
          <h3 className="font-semibold font-display text-sm mb-3 px-1">{t("throughTheAppCan")}</h3>
          <div className="space-y-2">
            {appFlow.map((f, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-card border border-border pl-3 pr-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0">
                  <f.icon size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-widest text-primary/70">{String(i + 1).padStart(2, "0")}</p>
                  <p className="text-sm font-medium leading-snug">
                    {f[localizedLang]}
                    {f.onRequest && (
                      <span className="ml-1.5 text-[9px] font-semibold text-warning">({t("onRequestLabel")})</span>
                    )}
                  </p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground/40 shrink-0" />
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item}>
          <button
            onClick={() => navigate("/book?studio=content-room")}
            className="w-full flex items-center justify-center gap-2 rounded-2xl gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform"
          >
            {t("bookContentRoomBtn")}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ContentDetailPage;
