import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, ChevronLeft, ChevronDown, Star, Sparkles, Building2, ChevronRight, ToggleLeft, ToggleRight, FileText, CheckSquare } from "lucide-react";
import { useState } from "react";
import { useAppConfig } from "@/contexts/AppConfigContext";
import SEO from "@/components/SEO";
import MembershipTermsBody from "@/components/MembershipTermsBody";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const DEFAULT_TIERS = [
  {
    name: "Basic",
    icon: Sparkles,
    priceMonthly: 150,
    priceYearly: 100,
    features: {
      nl: ["8 studio-uren per maand", "Toegang tot studio's en content ruimte", "Ideaal voor producers die regelmatig werken"],
      en: ["8 studio hours per month", "Access to studios and content room", "Ideal for producers who work regularly"],
    },
  },
  {
    name: "Pro",
    icon: Star,
    priceMonthly: 250,
    priceYearly: 200,
    features: {
      nl: ["16 studio-uren per maand", "10% korting op mix & master en producer sessies", "Voor serieuze producers"],
      en: ["16 studio hours per month", "10% discount on mix & master and producer sessions", "For serious producers"],
    },
  },
  {
    name: "Unlimited",
    icon: Crown,
    priceMonthly: 350,
    priceYearly: 300,
    features: {
      nl: ["Onbeperkt studio gebruik", "20% korting op mix & master en producer sessies", "De ultieme producer setup"],
      en: ["Unlimited studio use", "20% discount on mix & master and producer sessions", "The ultimate producer setup"],
    },
  },
];

const appFeatures = {
  nl: [
    "Je studio-uren bekijken en beheren",
    "Direct studio sessies boeken vanuit de app",
    "Korting op mix & master en producer sessies",
    "Je boekingsgeschiedenis en facturen bekijken",
    "Toegang tot de Uprising producer community",
  ],
  en: [
    "View and manage your studio hours",
    "Book studio sessions directly from the app",
    "Discounts on mix & master and producer sessions",
    "View your booking history and invoices",
    "Access to the Uprising producer community",
  ],
};

const MembershipsDetailPage = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const config = useAppConfig();
  const [yearly, setYearly] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const localizedLang = lang === "nl" ? "nl" : "en";

  // Keep the rich feature lists local, but take PRICES from config so this page
  // never shows stale prices vs the booking flow (single source of truth).
  const priceByName = new Map(config.membershipTiers.map((tier) => [tier.name.toLowerCase(), tier]));
  const tiers = DEFAULT_TIERS.map((tier) => {
    const cfg = priceByName.get(tier.name.toLowerCase());
    return cfg
      ? { ...tier, priceMonthly: cfg.priceMonthly ?? tier.priceMonthly, priceYearly: cfg.priceYearly ?? tier.priceYearly }
      : tier;
  });

  return (
    <div className="min-h-full pb-24">
      <SEO title="Memberships — Uprising Studio" description="Lidmaatschappen voor frequente makers: korting op studio's, contentruimtes en producer-sessies." path="/diensten/memberships" />
      {/* Header */}
      <div className="px-5 pt-4 pb-6">
        <button onClick={() => navigate("/diensten")} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:opacity-70">
          <ChevronLeft size={16} />
          {t("back")}
        </button>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl icon-tile">
            <Crown size={28} className="text-white" strokeWidth={2.1} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold font-display tracking-[-0.01em]">Producer Memberships</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lang === "nl" ? "Memberships voor producers" : "Memberships for producers"}
            </p>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-5">
        {/* Intro */}
        <motion.div variants={item} className="rounded-2xl card-feature border border-white/5 p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "nl"
              ? "Met een Uprising Producer Membership krijg je vaste toegang tot onze studio's en creatieve ruimtes. Speciaal ontwikkeld voor producers die regelmatig willen werken aan hun beats, tracks en projecten in een professionele studio omgeving. Minimaal 3 maanden commitment, maandelijks betalen."
              : "With an Uprising Producer Membership you get regular access to our studios and creative spaces. Specially designed for producers who regularly want to work on their beats, tracks and projects in a professional studio environment. Minimum 3-month commitment, billed monthly."}
          </p>
        </motion.div>

        {/* App Features — STEP LADDER */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="h-5 w-1 rounded-full accent-bar" />
            <h3 className="font-extrabold font-display text-sm tracking-[-0.01em]">{t("throughTheAppEasily")}</h3>
          </div>
          <div className="space-y-1.5">
            {appFeatures[localizedLang].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl card-feature border border-white/5 py-3 pr-4 hover:-translate-y-0.5 transition-all"
                style={{ paddingLeft: `${12 + i * 8}px` }}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 shrink-0">
                  <span className="text-[11px] font-bold text-primary">{i + 1}</span>
                </div>
                <p className="text-sm font-medium text-foreground/90 leading-snug">{f}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Period toggle */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-1">
            <span className="h-5 w-1 rounded-full accent-bar" />
            <h3 className="font-extrabold font-display text-sm tracking-[-0.01em]">
              {t("availablePlansLabel")}
            </h3>
          </div>
          <button onClick={() => setYearly(!yearly)}
            className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold transition-all">
            <span className={yearly ? "text-muted-foreground" : "text-foreground"}>
              {t("monthly")}
            </span>
            {yearly ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-muted-foreground" />}
            <span className={yearly ? "text-foreground" : "text-muted-foreground"}>
              {t("yearly")}
            </span>
            {yearly && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary ml-0.5">
                {t("save")}
              </span>
            )}
          </button>
        </motion.div>

        {/* Collapsible contract terms */}
        <motion.div variants={item} className="rounded-2xl bg-primary/20 border border-primary/30 overflow-hidden">
          <button
            onClick={() => setTermsOpen(!termsOpen)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-primary shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-primary">
                  {yearly ? t("annualTerms") : t("quarterlyTerms")}
                </p>
                {!termsOpen && !yearly && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {lang === "nl" ? "⚡ Minimum 3 maanden commitment" : "⚡ Minimum 3-month commitment"}
                  </p>
                )}
              </div>
            </div>
            <ChevronDown size={16} className={`text-primary transition-transform duration-200 ${termsOpen ? "rotate-180" : ""}`} />
          </button>

          <motion.div
            initial={false}
            animate={{ height: termsOpen ? "auto" : 0, opacity: termsOpen ? 1 : 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              {!yearly && (
                <p className="text-xs text-muted-foreground mb-2">
                  {lang === "nl"
                    ? "⚡ Minimum 3 maanden commitment, daarna maandelijks opzegbaar"
                    : "⚡ Minimum 3-month commitment, then cancel monthly"}
                </p>
              )}
              <MembershipTermsBody yearly={yearly} />
            </div>
          </motion.div>
        </motion.div>

        {/* Tiers */}
        <motion.div variants={item}>
          <div className="space-y-3">
            {tiers.map((tier) => {
              const price = yearly ? tier.priceYearly : tier.priceMonthly;
              const savings = (tier.priceMonthly - tier.priceYearly) * 12;
              return (
                <button
                  key={tier.name}
                  onClick={() => navigate(`/book?plan=${tier.name.toLowerCase()}&interval=${yearly ? "year" : "quarter"}`)}
                  className="w-full text-left rounded-2xl card-feature border border-white/5 p-5 transition-all hover:border-primary/30 active:scale-[0.99] hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-tile">
                        <tier.icon size={20} className="text-white" strokeWidth={2.1} />
                      </div>
                      <h4 className="font-extrabold font-display text-base tracking-[-0.01em]">{tier.name}</h4>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-lg font-bold font-display text-primary">€{price}</p>
                        {yearly && (
                          <span className="text-xs text-muted-foreground line-through">€{tier.priceMonthly}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{t("perMonthLabel")}</p>
                      {yearly && (
                        <p className="text-[10px] text-success font-semibold">
                          {lang === "nl" ? `Bespaar €${savings}/jaar` : `Save €${savings}/year`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {tier.features[localizedLang].map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 bg-primary" />
                        <p className="text-sm text-muted-foreground">{f}</p>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Business */}
        <motion.div variants={item} className="rounded-2xl card-feature border border-white/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-tile">
              <Building2 size={20} className="text-white" strokeWidth={2.1} />
            </div>
            <div>
              <h4 className="font-extrabold font-display text-sm tracking-[-0.01em]">Business</h4>
              <span className="text-[10px] font-semibold text-warning">{t("onRequest")}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {lang === "nl"
              ? "Voor labels, bedrijven of grotere teams bieden we ook een Business membership met meerdere gebruikers en facturatie mogelijkheden."
              : "For labels, companies or larger teams we also offer a Business membership with multiple users and invoicing options."}
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div variants={item}>
          <button
            onClick={() => navigate(`/book?interval=${yearly ? "year" : "quarter"}`)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl btn-glow py-4 text-sm font-extrabold text-primary-foreground active:scale-[0.98] hover:-translate-y-0.5 transition-all"
          >
            {t("viewPlansBtn")}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default MembershipsDetailPage;
