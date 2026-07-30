import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Music, ChevronLeft, Disc, PenTool, Layers, Headphones, ChevronRight, Crown } from "lucide-react";
import SEO from "@/components/SEO";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const sessionParts = [
  { nl: "Beat productie", en: "Beat production", icon: Disc },
  { nl: "Songwriting ondersteuning", en: "Songwriting support", icon: PenTool },
  { nl: "Arrangement en sound design", en: "Arrangement and sound design", icon: Layers },
  { nl: "Opname begeleiding", en: "Recording guidance", icon: Headphones },
];

const ProducerSessionDetailPage = () => {
  const { t, lang } = useI18n();
  const localizedLang = lang === "nl" ? "nl" : "en";
  const navigate = useNavigate();

  const basePrice = 350;
  const proPrice = Math.round(basePrice * 0.9);
  const unlimitedPrice = Math.round(basePrice * 0.8);

  const pricingRows = [
    { label: lang === "nl" ? "Standaard" : "Standard", price: basePrice, discount: 0, highlight: false },
    { label: "Pro Member", price: proPrice, discount: 10, highlight: true },
    { label: "Unlimited Member", price: unlimitedPrice, discount: 20, highlight: true },
  ];

  return (
    <div className="min-h-full pb-24">
      <SEO title="Producer sessies — Uprising Studio" description="Werk samen met een ervaren producer aan je track in onze studio's in Amersfoort." path="/diensten/producer-session" />
      <div className="px-5 pt-4 pb-6">
        <button onClick={() => navigate("/diensten")} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:opacity-70">
          <ChevronLeft size={16} />
          {t("back")}
        </button>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl icon-tile">
            <Music size={28} className="text-white" strokeWidth={2.1} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold font-display tracking-[-0.01em]">{t("producerSessionTitle")}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground">{t("workTogetherTrack")}</p>
              <span className="text-[10px] font-semibold text-warning bg-warning/20 px-2 py-0.5 rounded-full">
                {t("onRequest")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-6">
        {/* Intro */}
        <motion.div variants={item} className="rounded-2xl card-feature border border-white/5 p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "nl"
              ? "Tijdens een producer sessie werk je samen met een ervaren producer aan het maken van een volledige track. Samen werk je van idee tot een complete productie."
              : "During a producer session you work together with an experienced producer to create a complete track. Together you work from idea to a complete production."}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            {lang === "nl" ? "Het doel van de sessie is om samen één volledige track te ontwikkelen." : "The goal of the session is to develop one complete track together."}
          </p>
        </motion.div>

        {/* Pricing — COMPARISON BARS */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="h-5 w-1 rounded-full accent-bar" />
            <h3 className="font-extrabold font-display text-sm tracking-[-0.01em]">{t("pricingLabel")}</h3>
          </div>
          <div className="rounded-2xl card-feature border border-white/5 p-5 space-y-3">
            {pricingRows.map((r) => {
              const widthPct = (r.price / basePrice) * 100;
              return (
                <div key={r.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {r.highlight && <Crown size={12} className="text-primary" />}
                      {r.label}
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      {r.discount > 0 && (
                        <span className="text-[10px] font-bold text-success bg-success/15 px-1.5 py-0.5 rounded-full">
                          -{r.discount}%
                        </span>
                      )}
                      <span className="text-base font-bold text-foreground">€{r.price}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                      className={`h-full rounded-full ${r.highlight ? "bg-gradient-to-r from-primary to-primary/70" : "bg-muted-foreground/40"}`}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-1">{t("depositLabel")}</p>
          </div>
        </motion.div>

        {/* Session parts — 2x2 BENTO */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="h-5 w-1 rounded-full accent-bar" />
            <h3 className="font-extrabold font-display text-sm tracking-[-0.01em]">{t("sessionCanInclude")}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sessionParts.map((sp, i) => (
              <div key={sp.nl} className="relative rounded-2xl card-feature border border-white/5 p-4 overflow-hidden hover:-translate-y-0.5 transition-all">
                <span aria-hidden className="absolute -bottom-4 -right-4 h-14 w-14 rounded-full bg-primary/10 blur-xl" />
                <p className="text-[10px] font-bold tracking-widest text-primary/60 mb-2">0{i + 1}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-tile mb-3">
                  <sp.icon size={16} className="text-white" strokeWidth={2.1} />
                </div>
                <p className="text-sm font-semibold leading-tight">{sp[localizedLang]}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} className="rounded-2xl bg-primary/5 border border-primary/10 p-5">
          <p className="text-sm text-muted-foreground">
            {lang === "nl" ? "Producer sessies zijn op aanvraag en kunnen via de app worden aangevraagd." : "Producer sessions are on request and can be requested through the app."}
          </p>
        </motion.div>

        <motion.div variants={item}>
          <button
            onClick={() => navigate("/producer-booking")}
            className="w-full flex items-center justify-center gap-2 rounded-2xl btn-glow py-4 text-sm font-extrabold text-primary-foreground active:scale-[0.98] hover:-translate-y-0.5 transition-all"
          >
            {t("requestSession")}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ProducerSessionDetailPage;
