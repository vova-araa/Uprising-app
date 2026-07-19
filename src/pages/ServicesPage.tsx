import { useI18n } from "@/lib/i18n";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { motion } from "framer-motion";
import { services as fallbackServices } from "@/lib/data";
import { Mic, Camera, Sliders, Music, Image, Shirt, Package, ChevronRight, Sparkles, Star, Crown, Building2, ToggleLeft, ToggleRight, FileText, CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

const iconMap: Record<string, any> = { Mic, Camera, Sliders, Music, Image, Shirt, Package };

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const memberships = [
{
  name: "Basic",
  icon: Sparkles,
  desc: { nl: "8 uur per maand, toegang tot Studio's & Content Room — voor producers die regelmatig werken", en: "8 hours per month, access to Studios & Content Room — for producers who work regularly" },
  priceMonthly: 150,
  priceYearly: 100,
  color: "text-success",
  borderColor: "hover:border-success/40",
  bgIcon: "bg-success/20"
},
{
  name: "Pro",
  icon: Star,
  desc: { nl: "16 uur per maand, 10% korting op mix & master en producer sessies — voor serieuze producers", en: "16 hours per month, 10% discount on mix & master and producer sessions — for serious producers" },
  priceMonthly: 250,
  priceYearly: 200,
  color: "text-primary",
  borderColor: "hover:border-primary/40",
  bgIcon: "bg-primary/20"
},
{
  name: "Unlimited",
  icon: Crown,
  desc: { nl: "Onbeperkt boeken, 20% korting op mix & master en producer sessies — de ultieme producer setup", en: "Unlimited booking, 20% discount on mix & master and producer sessions — the ultimate producer setup" },
  priceMonthly: 350,
  priceYearly: 300,
  color: "text-warning",
  borderColor: "hover:border-warning/40",
  bgIcon: "bg-warning/20"
},
{
  name: "Business",
  icon: Building2,
  desc: { nl: "Voor labels & bedrijven. Meerdere gebruikers, facturatie, dedicated account manager", en: "For labels & businesses. Multiple users, invoicing, dedicated account manager" },
  priceMonthly: null,
  priceYearly: null,
  priceLabel: { nl: "Op aanvraag", en: "On request" },
  color: "text-warning",
  borderColor: "hover:border-warning/40",
  bgIcon: "bg-warning/20"
}];

// Request-based services that go to the contact form
const requestServices = ["photography", "clothing", "merch"];

const ServicesPage = () => {
  const { t, lang } = useI18n();
  const config = useAppConfig();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [memberTier, setMemberTier] = useState<string | null>(null);
  const localizedLang = lang === "nl" ? "nl" : "en";

  // Use config-driven services, fallback to hardcoded
  const configServices = config.servicesConfig;
  const services = configServices.length > 0
    ? configServices.map(cs => ({
        id: cs.id,
        nameKey: cs.nameKey,
        description: cs.descNl,
        descriptionEn: cs.descEn,
        price: cs.priceNl,
        priceEn: cs.priceEn,
        requestOnly: cs.requestOnly,
        icon: cs.icon,
      }))
    : fallbackServices;

  useEffect(() => {
    const checkMembership = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data?.subscribed) {
          setMemberTier(data.plan || "basic");
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("membership").eq("id", user.id).single();
        if (profile?.membership) setMemberTier(profile.membership);
      } catch {}
    };
    checkMembership();
  }, []);

  const memberDiscount = memberTier === "unlimited" ? 0.2 : memberTier === "pro" ? 0.1 : 0;

  const getServicePrice = (service: typeof services[0]) => {
    if (service.id === "mix-master") {
      const base = 150;
      const discounted = Math.round(base * (1 - memberDiscount));
      if (memberDiscount > 0) {
        return lang === "nl" ? `€${discounted} per track` : `€${discounted} per track`;
      }
      return lang === "nl" ? service.price : service.priceEn;
    }
    if (service.id === "producer") {
      const base = 350;
      const discounted = Math.round(base * (1 - memberDiscount));
      if (memberDiscount > 0) {
        return `€${discounted} per single`;
      }
      return lang === "nl" ? service.price : service.priceEn;
    }
    return lang === "nl" ? service.price : service.priceEn;
  };

  const bookable = services.filter((s) => !s.requestOnly);
  const requestBased = services.filter((s) => s.requestOnly);

  const handleServiceClick = (serviceId: string) => {
    if (serviceId === "mix-master") {
      navigate("/mix-master");
    } else if (serviceId === "producer") {
      navigate("/producer-booking");
    } else if (requestServices.includes(serviceId)) {
      navigate(`/request?type=${serviceId}`);
    } else if (serviceId === "content-space") {
      navigate("/book?studio=content-room");
    } else if (serviceId === "music-studio") {
      navigate("/book?type=studio");
    } else {
      navigate("/book");
    }
  };

  const handleMembershipClick = (planName: string) => {
    navigate("/book");
  };

  return (
    <div className="min-h-full">
      <SEO title="Diensten — Uprising Studio Amersfoort" description="Alle creatieve diensten van Uprising Studio: studio-sessies, content, mix & master en meer." path="/services" />
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-2xl font-bold font-display">{t("allServices")}</h1>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 pb-6 mt-4">
        {/* Bookable */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-1 rounded-full gradient-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t("bookDirectly")}
            </h2>
          </div>
          <div className="space-y-4">
            {bookable.map((service) => {
              const Icon = iconMap[service.icon] || Mic;
              return (
                <motion.button key={service.id} variants={item} onClick={() => handleServiceClick(service.id)}
                className="group relative flex w-full items-center gap-4 rounded-2xl card-premium border border-border p-4 text-left transition-all hover:border-primary/40 active:scale-[0.99] overflow-hidden">
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                    <Icon size={24} className="text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <h3 className="font-semibold font-display text-base">{t(service.nameKey as any)}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lang === "nl" ? service.description : service.descriptionEn}
                    </p>
                    <p className="text-sm font-bold text-primary mt-1.5">
                      {getServicePrice(service)}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </motion.button>);
            })}
          </div>
        </motion.div>

        {/* Memberships */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-success" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Producer Memberships</h2>
            </div>
            <button onClick={() => { setYearly(!yearly); setContractAccepted(false); }}
              className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold transition-all">
              <span className={yearly ? "text-muted-foreground" : "text-foreground"}>
                {t("monthly")}
              </span>
              {yearly ? (
                <ToggleRight size={20} className="text-success" />
              ) : (
                <ToggleLeft size={20} className="text-muted-foreground" />
              )}
              <span className={yearly ? "text-foreground" : "text-muted-foreground"}>
                {t("yearly")}
              </span>
              {yearly && (
                <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[9px] font-bold text-success ml-0.5">
                  {t("save")}
                </span>
              )}
            </button>
          </div>

          {/* Yearly contract notice */}
          {yearly && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="mb-3 rounded-xl bg-warning/10 border border-warning/20 p-4">
              <div className="flex items-start gap-3">
                <FileText size={18} className="text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-warning mb-2">
                    {t("annualTerms")}
                  </p>
                  <div className="text-[10px] text-muted-foreground leading-relaxed space-y-2 max-h-48 overflow-y-auto pr-1">
                    <p className="font-semibold text-foreground/80">{t("article1Title")}</p>
                    <p>{lang === "nl"
                      ? "1.1 Door het afsluiten van een jaarabonnement gaat de klant een bindende overeenkomst aan met Uprising Studio, gevestigd te Amersfoort, Spaceshuttle 6e, voor een vaste periode van twaalf (12) opeenvolgende kalendermaanden. 1.2 Het abonnement wordt na afloop stilzwijgend verlengd per maand, tenzij schriftelijk opgezegd met 30 dagen opzegtermijn."
                      : "1.1 By subscribing, the customer enters a binding agreement with Uprising Studio, Spaceshuttle 6e, Amersfoort, for twelve (12) consecutive months. 1.2 After the initial period, the subscription renews monthly unless cancelled with 30 days written notice."}</p>
                    <p className="font-semibold text-foreground/80">{t("article2Title")}</p>
                    <p>{lang === "nl"
                      ? "2.1 De klant verplicht zich tot maandelijkse betaling gedurende de volledige 12 maanden. 2.2 Tussentijdse opzegging ontslaat niet van de betalingsverplichting; het restbedrag wordt direct opeisbaar."
                      : "2.1 The customer commits to monthly payment for the full 12 months. 2.2 Early termination does not release payment obligations; the remaining balance becomes immediately due."}</p>
                    <p className="font-semibold text-foreground/80">{t("article3Title")}</p>
                    <p>{lang === "nl"
                      ? "3.1 Bij wanbetaling worden incassokosten (conform WIK), administratiekosten en wettelijke rente (art. 6:119a BW) in rekening gebracht. 3.2 Uprising Studio behoudt zich het recht voor gerechtelijke stappen te nemen; proceskosten komen voor rekening van de klant."
                      : "3.1 Collection costs, administrative fees, and statutory interest apply upon default. 3.2 Uprising Studio reserves the right to take legal action; costs are borne by the customer."}</p>
                    <p className="font-semibold text-foreground/80">{lang === "nl" ? "Artikel 4 — Toepasselijk Recht" : "Article 4 — Applicable Law"}</p>
                    <p>{lang === "nl"
                      ? "Op deze overeenkomst is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement Midden-Nederland."
                      : "This agreement is governed by Dutch law. Disputes shall be submitted to the competent court in the Central Netherlands district."}</p>
                  </div>
                  <button onClick={() => setContractAccepted(!contractAccepted)}
                    className="flex items-center gap-2 mt-3">
                    <div className={`flex h-5 w-5 items-center justify-center rounded ${contractAccepted ? "bg-warning text-background" : "border-2 border-muted-foreground/30"}`}>
                      {contractAccepted && <CheckSquare size={14} />}
                    </div>
                    <span className="text-xs font-medium">
                      {t("agreeTerms")}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <div className="space-y-4">
            {memberships.map((plan) => {
              const hasCustomPrice = "priceLabel" in plan && plan.priceLabel;
              let priceDisplay: string;
              if (hasCustomPrice) {
                priceDisplay = (plan as any).priceLabel[localizedLang];
              } else {
                const amount = yearly ? plan.priceYearly : plan.priceMonthly;
                priceDisplay = `€${amount}/${t("perMonth")}`;
              }
              const desc = plan.desc[localizedLang];
              const isDisabled = yearly && !contractAccepted && !hasCustomPrice;
              // Note: 3-month commitment notice is shown on the booking page
              return (
                <button key={plan.name}
                onClick={() => {
                  if (hasCustomPrice) {
                    navigate("/request?type=business");
                  } else if (!isDisabled) {
                    handleMembershipClick(plan.name);
                  }
                }}
                disabled={isDisabled}
                className={`group relative flex w-full items-center gap-4 rounded-2xl card-premium border border-border p-4 text-left transition-all ${plan.borderColor} active:scale-[0.99] overflow-hidden ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <div className={`absolute -left-4 top-1/2 -translate-y-1/2 h-20 w-20 rounded-full ${plan.bgIcon} blur-2xl opacity-50`} />
                  <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${plan.bgIcon}`}>
                    <plan.icon size={24} className={plan.color} />
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <h3 className="font-semibold font-display text-base">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 my-[3px]">{desc}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {hasCustomPrice ? (
                        <span className="inline-flex items-center rounded-full border border-warning/60 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">{priceDisplay}</span>
                      ) : (
                        <p className={`text-sm font-bold ${plan.color}`}>{priceDisplay}</p>
                      )}
                      {yearly && plan.priceMonthly && plan.priceYearly && (
                        <span className="text-xs text-muted-foreground line-through">€{plan.priceMonthly}/{t("perMonth")}</span>
                      )}
                    </div>
                    {yearly && !hasCustomPrice && (
                      <p className="text-[10px] text-success mt-0.5">
                        {lang === "nl"
                          ? `Jaarcontract — bespaar €${((plan.priceMonthly! - plan.priceYearly!) * 12)}/jaar`
                          : `Annual contract — save €${((plan.priceMonthly! - plan.priceYearly!) * 12)}/year`}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>);
            })}
          </div>
        </motion.div>

        {/* On Request - now split into Mix & Master (bookable) and contact form services */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-1 rounded-full bg-warning" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("onRequest")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {requestBased.map((service) => {
              const Icon = iconMap[service.icon] || Mic;
              return (
                <motion.button key={service.id} variants={item}
                onClick={() => handleServiceClick(service.id)}
                className="group flex flex-col items-center gap-3 rounded-2xl card-premium border border-border p-5 text-center transition-all hover:border-primary/30 active:scale-[0.98]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                    <Icon size={22} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold font-display leading-tight">{t(service.nameKey as any)}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {getServicePrice(service)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                    service.id === "mix-master" || service.id === "producer" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                  }`}>
                    {service.id === "mix-master" || service.id === "producer"
                      ? (t("book2"))
                      : t("onRequest")}
                  </span>
                </motion.button>);
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>);
};

export default ServicesPage;
