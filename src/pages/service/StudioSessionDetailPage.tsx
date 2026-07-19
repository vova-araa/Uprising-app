import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, ChevronLeft, Music, PenTool, Lightbulb, Sliders, ChevronRight, CalendarDays, DoorOpen, CheckCircle2 } from "lucide-react";
import SEO from "@/components/SEO";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const sessionTypes = [
  { nl: "Vocal recordings", en: "Vocal recordings", icon: Mic },
  { nl: "Songwriting sessies", en: "Songwriting sessions", icon: PenTool },
  { nl: "Creatieve sessies", en: "Creative sessions", icon: Lightbulb },
  { nl: "Mixing sessies", en: "Mixing sessions", icon: Sliders },
];

const StudioSessionDetailPage = () => {
  const { t, lang } = useI18n();
  const localizedLang = lang === "nl" ? "nl" : "en";
  const navigate = useNavigate();

  const flow = [
    { label: t("chooseDateAndTime"), icon: CalendarDays },
    { label: t("selectWhichStudio"), icon: DoorOpen },
    { label: t("confirmSessionDirectly"), icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-full pb-24">
      <SEO title="Studio sessies — Uprising Studio" description="Boek een muziekstudio met of zonder engineer voor opname, productie of repetitie." path="/diensten/studio-session" />
      <div className="px-5 pt-4 pb-6">
        <button onClick={() => navigate("/diensten")} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:opacity-70">
          <ChevronLeft size={16} />
          {t("back")}
        </button>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
            <Mic size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">{t("studioSessionTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("professionalRecordingSessions")}</p>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-6">
        {/* Intro — waveform decoration */}
        <motion.div variants={item} className="relative rounded-2xl bg-card border border-border p-5 overflow-hidden">
          <div aria-hidden className="absolute right-3 top-3 flex items-end gap-0.5 h-8">
            {[3, 6, 4, 8, 5, 7, 3, 6, 4, 2].map((h, i) => (
              <span key={i} className="w-0.5 rounded-full bg-primary/40" style={{ height: `${h * 4}px` }} />
            ))}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "nl"
              ? "Bij Uprising Studio kun je professionele studio sessies boeken in een inspirerende en volledig uitgeruste opnameomgeving. Onze studio's zijn ontworpen voor artiesten en creators die serieus willen werken aan hun muziek."
              : "At Uprising Studio you can book professional studio sessions in an inspiring and fully equipped recording environment. Our studios are designed for artists and creators who want to seriously work on their music."}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            {lang === "nl"
              ? "Elke studio is uitgerust met hoogwaardige opnameapparatuur en akoestisch behandelde ruimtes zodat je altijd de beste kwaliteit kunt opnemen."
              : "Each studio is equipped with high-quality recording equipment and acoustically treated rooms so you can always record the best quality."}
          </p>
        </motion.div>

        {/* App flow — HORIZONTAL ARROW STEPS */}
        <motion.div variants={item}>
          <h3 className="font-semibold font-display text-sm mb-3 px-1">{t("throughTheAppEasily")}</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {flow.map((f, i) => (
              <div key={i} className="relative flex flex-col items-center gap-2 rounded-2xl bg-card border border-border p-3">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 mt-1">
                  <f.icon size={18} className="text-primary" />
                </div>
                <p className="text-[11px] font-medium text-center leading-tight">{f.label}</p>
                {i < flow.length - 1 && (
                  <ChevronRight size={14} className="absolute top-1/2 -right-2 -translate-y-1/2 text-primary/40 bg-background rounded-full z-10" />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Session types — LARGE ICON TILES with split layout */}
        <motion.div variants={item}>
          <h3 className="font-semibold font-display text-sm mb-3 px-1">{t("suitableFor")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {sessionTypes.map((st, i) => (
              <div
                key={st.nl}
                className="relative rounded-2xl bg-gradient-to-br from-card to-card/60 border border-border p-4 overflow-hidden aspect-[5/4] flex flex-col justify-between"
              >
                <span aria-hidden className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-primary/10 blur-xl" />
                <span className="text-[10px] font-bold tracking-widest text-primary/60 relative">0{i + 1}</span>
                <st.icon size={28} className="text-primary relative" strokeWidth={1.5} />
                <span className="text-sm font-semibold leading-tight relative">{st[localizedLang]}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item}>
          <button
            onClick={() => navigate("/book?type=studio")}
            className="w-full flex items-center justify-center gap-2 rounded-2xl gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform"
          >
            {t("bookStudioBtn")}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default StudioSessionDetailPage;
