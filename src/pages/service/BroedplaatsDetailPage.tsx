import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, ChevronLeft, GraduationCap, Flame, Rocket, Mic, Camera, Shirt, BookOpen, ChevronRight, Calendar, UserCheck, Sparkles } from "lucide-react";
import SEO from "@/components/SEO";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const activities = [
  { nl: "Studio", en: "Studio", icon: Mic },
  { nl: "Content", en: "Content", icon: Camera },
  { nl: "Kleding / merchandise", en: "Clothing / merchandise", icon: Shirt },
];

const appFeatures = [
  { nl: "Aangeven of je aanwezig bent op de vaste dagen", en: "Indicate your attendance on fixed days", icon: UserCheck },
  { nl: "Je inschrijven voor workshops", en: "Sign up for workshops", icon: BookOpen },
  { nl: "Zien welke activiteiten binnenkort plaatsvinden", en: "See upcoming activities", icon: Calendar },
];

const tiers = [
  {
    name: { nl: "Scholieren membership", en: "Student membership" },
    price: 45,
    icon: GraduationCap,
    plan: "broedplaats-students",
    desc: { nl: "Speciaal voor scholieren die zich creatief willen ontwikkelen.", en: "Special for students who want to develop creatively." },
  },
  {
    name: { nl: "Broedplaats membership", en: "Creative Hub membership" },
    price: 70,
    icon: Flame,
    plan: "broedplaats",
    desc: { nl: "Toegang tot de community en vaste broedplaats dagen.", en: "Access to the community and fixed creative hub days." },
  },
  {
    name: { nl: "Broedplaats Plus membership", en: "Creative Hub Plus membership" },
    price: 150,
    icon: Rocket,
    plan: "broedplaats-plus",
    desc: { nl: "Inclusief extra voordelen, mogelijkheden en meer ondersteuning binnen de studio.", en: "Including extra benefits, possibilities and more support within the studio." },
  },
];

const BroedplaatsDetailPage = () => {
  const { t, lang } = useI18n();
  const localizedLang = lang === "nl" ? "nl" : "en";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [broedplaatsTier, setBroedplaatsTier] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data?.broedplaats_plan) {
          setBroedplaatsTier(data.broedplaats_plan);
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("broedplaats").eq("id", user.id).single();
        if (profile?.broedplaats) setBroedplaatsTier(profile.broedplaats);
      } catch (err) {
        console.error("Failed to check subscription:", err);
      }
    };
    check();
  }, [user]);

  return (
    <div className="min-h-full pb-24">
      <SEO title="Broedplaats — Uprising Studio Amersfoort" description="Onze creatieve broedplaats voor jong talent in Amersfoort." path="/diensten/broedplaats" />
      <div className="px-5 pt-4 pb-6">
        <button onClick={() => navigate("/diensten")} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:opacity-70">
          <ChevronLeft size={16} />
          {t("back")}
        </button>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
            <Users size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">{t("creativeHub")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("creativeDevForMakers")}</p>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-6">
        {/* Intro */}
        <motion.div variants={item} className="rounded-2xl card-premium border border-border p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "nl"
              ? "De Broedplaats is een creatieve ontwikkelplek waar makers samenkomen om zich te ontwikkelen in muziek, content en creatieve projecten. Iedereen kan deelnemen, met een speciale optie voor scholieren."
              : "The Creative Hub is a creative development space where makers come together to develop in music, content and creative projects. Everyone can participate, with a special option for students."}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            {lang === "nl"
              ? "De Broedplaats komt 2 vaste dagen per week samen in de studio. Via de app kun je altijd aangeven of je aanwezig bent en waar je die dag aan wilt werken."
              : "The Creative Hub meets 2 fixed days per week in the studio. Through the app you can always indicate your attendance and what you'd like to work on."}
          </p>
        </motion.div>

        {/* Activities — BIG ICON COLUMN */}
        <motion.div variants={item}>
          <h3 className="font-semibold font-display text-sm mb-3 px-1">{t("youCanComeFor")}</h3>
          <div className="grid grid-cols-3 gap-2">
            {activities.map((a) => (
              <div key={a.nl} className="rounded-2xl card-premium border border-border p-4 text-center flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5">
                  <a.icon size={22} className="text-primary" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold leading-tight">{a[localizedLang]}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Workshops — FEATURED SPOTLIGHT */}
        <motion.div variants={item} className="relative rounded-2xl bg-gradient-to-br from-primary/15 via-card to-card border border-primary/30 p-5 overflow-hidden">
          <span aria-hidden className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <span aria-hidden className="absolute top-3 right-3">
            <Sparkles size={16} className="text-primary/60" />
          </span>
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/25 ring-1 ring-primary/40">
              <BookOpen size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-primary uppercase">{lang === "nl" ? "Maandelijks" : "Monthly"}</p>
              <h3 className="font-bold font-display text-base">Workshops</h3>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed relative">
            {lang === "nl"
              ? "Elke maand organiseert de Broedplaats een workshop rondom een specifieke leermodule. Deze workshops helpen deelnemers nieuwe skills te ontwikkelen binnen muziek, content of creatieve ondernemerschap."
              : "Every month the Creative Hub organizes a workshop around a specific learning module. These workshops help participants develop new skills in music, content or creative entrepreneurship."}
          </p>
        </motion.div>

        {/* App features — TIMELINE */}
        <motion.div variants={item}>
          <h3 className="font-semibold font-display text-sm mb-3 px-1">{t("inTheAppYouCan")}</h3>
          <div className="relative pl-1">
            {appFeatures.map((f, i) => {
              const isLast = i === appFeatures.length - 1;
              return (
                <div key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
                  {!isLast && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-gradient-to-b from-primary/40 to-primary/10" />}
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/40">
                    <f.icon size={14} className="text-primary" />
                  </div>
                  <p className="text-sm text-foreground/90 pt-1.5">{f[localizedLang]}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Tiers — STACKED with ACCENT BAR */}
        <motion.div variants={item}>
          <h3 className="font-semibold font-display text-sm mb-3 px-1">{t("broedplaatsMemberships")}</h3>
          <div className="space-y-2">
            {tiers.map((tier) => {
              const isCurrent = broedplaatsTier === tier.plan;
              return (
                <div
                  key={tier.name.nl}
                  className={`relative flex items-stretch rounded-2xl bg-card border overflow-hidden ${isCurrent ? "border-success/50" : "border-border"}`}
                >
                  <div className={`w-1.5 shrink-0 ${isCurrent ? "bg-success" : "bg-primary/60"}`} />
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${isCurrent ? "bg-success/20" : "bg-primary/20"}`}>
                          <tier.icon size={18} className={isCurrent ? "text-success" : "text-primary"} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold font-display text-sm leading-tight">{tier.name[localizedLang]}</h4>
                            {isCurrent && (
                              <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[9px] font-bold text-success">{t("currentPlan")}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{tier.desc[localizedLang]}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-lg font-bold font-display ${isCurrent ? "text-success" : "text-primary"}`}>€{tier.price}</p>
                        <p className="text-[10px] text-muted-foreground">{t("perMonthLabel")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Quote */}
        <motion.div variants={item} className="relative rounded-2xl bg-primary/5 border border-primary/10 p-5">
          <span aria-hidden className="absolute top-2 left-3 text-4xl font-serif text-primary/30 leading-none">"</span>
          <p className="text-sm text-muted-foreground italic leading-relaxed pl-5">
            {lang === "nl"
              ? "Aankomende vrijdag is een workshop of open sessie — ik meld me aan en kom voor de content ruimte."
              : "This Friday is a workshop or open session — I sign up and come for the content room."}
          </p>
        </motion.div>

        <motion.div variants={item}>
          <button
            onClick={() => navigate("/book")}
            className="w-full flex items-center justify-center gap-2 rounded-2xl gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform"
          >
            {t("chooseMembership")}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default BroedplaatsDetailPage;
