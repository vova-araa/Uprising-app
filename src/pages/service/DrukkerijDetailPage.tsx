import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Printer, ChevronLeft, Truck, ChevronRight, Paintbrush, ShoppingBag } from "lucide-react";
import SEO from "@/components/SEO";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

type ProcessTopic = {
  title: { nl: string; en: string };
  subtitle: { nl: string; en: string };
  icon: any;
  steps: { nl: string; en: string }[];
};

const processTopics: ProcessTopic[] = [
  {
    title: { nl: "Artiesten Deal", en: "Artist Deal" },
    subtitle: { nl: "Voor artiesten — wij regelen het", en: "For artists — we handle it all" },
    icon: Truck,
    steps: [
      { nl: "Wij maken een design geschikt voor onze printers", en: "We create a design suited for our printers" },
      { nl: "De artiest betaalt alleen voor het design", en: "The artist only pays for the design" },
      { nl: "Klanten bestellen → order komt bij ons binnen", en: "Customers order → it lands directly with us" },
      { nl: "Wij produceren en verzenden het product", en: "We produce and ship the product" },
      { nl: "De artiest ontvangt een deel van de winst", en: "The artist receives a share of the profit" },
    ],
  },
  {
    title: { nl: "Business", en: "Business" },
    subtitle: { nl: "Van idee naar product", en: "From idea to product" },
    icon: ShoppingBag,
    steps: [
      { nl: "Kies je product (t-shirt, hoodie, etc.)", en: "Pick your product (tee, hoodie, etc.)" },
      { nl: "Upload of laat ons je ontwerp maken", en: "Upload your design or let us create it" },
      { nl: "Wij printen in onze studio in Amersfoort", en: "We print in our studio in Amersfoort" },
      { nl: "Ophalen of laten bezorgen", en: "Pick up or get it delivered" },
    ],
  },
  {
    title: { nl: "Creators", en: "Creators" },
    subtitle: { nl: "Jouw idee, onze uitvoering", en: "Your idea, our execution" },
    icon: Paintbrush,
    steps: [
      { nl: "Upload je eigen artwork of logo", en: "Upload your own artwork or logo" },
      { nl: "Kies het product dat bij jouw merk past", en: "Pick the product that fits your brand" },
      { nl: "Wij maken een mockup voor je goedkeuring", en: "We create a mockup for your approval" },
      { nl: "Na goedkeuring gaan we direct in productie", en: "Once approved, we go straight into production" },
      { nl: "Jouw merch is klaar — ophalen of verzenden", en: "Your merch is ready — pick up or ship" },
    ],
  },
];

const ProcessTimeline = ({ steps, lang }: { steps: { nl: string; en: string }[]; lang: "nl" | "en" }) => (
  <div className="relative">
    {steps.map((step, i) => {
      const isLast = i === steps.length - 1;
      return (
        <div key={i} className="relative flex items-start gap-4 pb-5 last:pb-0">
          {!isLast && (
            <span
              aria-hidden
              className="absolute left-[15px] top-8 bottom-0 w-px bg-gradient-to-b from-primary/60 via-primary/30 to-primary/10"
            />
          )}
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/40">
            <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-[10px] font-bold tracking-widest text-primary mb-0.5">
              {String(i + 1).padStart(2, "0")}
            </p>
            <p className="text-sm text-foreground/90 leading-snug">{step[lang]}</p>
          </div>
        </div>
      );
    })}
  </div>
);

const DrukkerijDetailPage = () => {
  const { t, lang } = useI18n();
  const localizedLang = lang === "nl" ? "nl" : "en";
  const navigate = useNavigate();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <div className="min-h-full pb-24">
      <SEO title="Drukkerij — Uprising Studio" description="Print- en drukkerijdiensten voor merch, artwork en promotiemateriaal." path="/diensten/drukkerij" />
      <div className="px-5 pt-4 pb-6">
        <button onClick={() => navigate("/diensten")} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:opacity-70">
          <ChevronLeft size={16} />
          {t("back")}
        </button>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
            <Printer size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">{t("printShopTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("customClothingMerch")}</p>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-5">
        <motion.div variants={item} className="rounded-2xl card-premium border border-border p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "nl"
              ? "Met onze drukkerij kun je eenvoudig eigen kleding en merchandise laten produceren. Wij bedrukken t-shirts, hoodies, merchandise en accessoires — ideaal voor artiesten, creators en merken die hun eigen kledinglijn willen aanbieden."
              : "With our print shop you can easily have your own clothing and merchandise produced. We print t-shirts, hoodies, merchandise and accessories — ideal for artists, creators and brands who want to offer their own clothing line."}
          </p>
        </motion.div>

        {/* Process carousel — swipe between topics */}
        <motion.div variants={item} className="-mx-5">
          <div className="flex items-end justify-between px-5 mb-3">
            <h3 className="font-semibold font-display text-sm">
              {lang === "nl" ? "Hoe het werkt" : "How it works"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {lang === "nl" ? "Swipe →" : "Swipe →"}
            </p>
          </div>

          <Carousel setApi={setApi} opts={{ align: "start", loop: false }} className="w-full">
            <CarouselContent className="-ml-3 px-5">
              {processTopics.map((topic, idx) => {
                const Icon = topic.icon;
                const active = idx === current;
                return (
                  <CarouselItem key={idx} className="pl-3 basis-[88%]">
                    <div
                      className={`relative h-full rounded-2xl bg-card border p-5 transition-all overflow-hidden ${
                        active ? "border-primary/50 shadow-glow" : "border-border"
                      }`}
                    >
                      {/* Decorative dots */}
                      <span aria-hidden className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                      <span aria-hidden className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-primary/40" />
                      <span aria-hidden className="absolute right-7 top-7 h-1 w-1 rounded-full bg-primary/30" />

                      <div className="flex items-center gap-3 mb-1 relative">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                          <Icon size={20} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold tracking-widest text-primary/80 uppercase">
                            {String(idx + 1).padStart(2, "0")} / {String(processTopics.length).padStart(2, "0")}
                          </p>
                          <h4 className="font-bold font-display text-base leading-tight">{topic.title[localizedLang]}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-5 ml-[52px]">{topic.subtitle[localizedLang]}</p>

                      <ProcessTimeline steps={topic.steps} lang={localizedLang} />
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>

          {/* Pagination dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {processTopics.map((_, idx) => (
              <button
                key={idx}
                onClick={() => api?.scrollTo(idx)}
                aria-label={`Ga naar stap ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </motion.div>

        {/* App features */}
        <motion.div variants={item} className="rounded-2xl card-premium border border-border p-5">
          <h3 className="font-semibold font-display text-sm mb-3">{t("throughTheAppCan")}</h3>
          <div className="space-y-2">
            {[t("requestPrintJob"), t("haveMerchDeveloped"), t("startMerchManagement")].map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 bg-primary" />
                <p className="text-sm text-muted-foreground">{f}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item}>
          <button
            onClick={() => navigate("/request?type=clothing")}
            className="w-full flex items-center justify-center gap-2 rounded-2xl gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform bg-primary"
          >
            {t("requestBtn")}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default DrukkerijDetailPage;
