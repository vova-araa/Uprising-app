import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, Headphones, Mic, Monitor, Radio, Disc, Speaker, Wifi,
  MapPin, Users, Clock, Expand, X, Crown, Loader2 } from
"lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import studioAImg from "@/assets/studio-a.webp";
import studioBImg from "@/assets/studio-b.webp";
import contentRoomImg from "@/assets/content-room-2.webp";
import printShopImg from "@/assets/print-shop.webp";
import SEO from "@/components/SEO";

const fallbackImages: Record<string, string> = {
  "studio-1": studioAImg,
  "studio-2": studioBImg,
  "content-room": contentRoomImg,
  "print-shop": printShopImg
};

const equipmentIcons: Record<string, any> = {
  "Neumann TLM103": Mic, "Focusrite Scarlett": Monitor, "Adams A77X": Speaker,
  "Arturia Piano": Disc, "Meerdere gitaren": Radio, "Yamaha HS7": Speaker,
  "Akai Mini Keyboard": Disc, "Camera": Monitor, "LED Panels": Wifi,
  "Green Screen": Monitor, "White Screen": Monitor, "Black Screen": Monitor,
  "Teleprompter": Monitor, "Podcast Setup": Headphones, "Large Format Printer": Monitor,
  "DTG Printer": Monitor, "Heat Press": Monitor, "Vinyl Cutter": Monitor
};

const SpacesPage = () => {
  const { t, lang } = useI18n();
  const localizedLang = lang === "nl" ? "nl" : "en";
  const navigate = useNavigate();
  const config = useAppConfig();
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [memberLoading, setMemberLoading] = useState(true);

  // Build spaces from config
  const configStudios = config.studios;
  const printShopConfig = config.printShop;
  const allSpaces = [
    ...configStudios.map(s => ({
      id: s.id,
      nameKey: s.nameKey,
      descKey: s.descKey,
      pricePerHour: s.pricePerHour,
      equipment: s.equipment,
      image: "",
    })),
    ...(config.featureFlags.print_shop_visible ? [{
      id: "print-shop",
      nameKey: "printShop",
      descKey: "printShopDesc",
      pricePerHour: 0,
      equipment: printShopConfig.equipment || [],
      image: "",
    }] : []),
  ];

  const spaceDetails: Record<string, { features: { nl: string; en: string }[]; capacity: number; availability: string; size: string }> = {};
  for (const s of configStudios) {
    if (s.features) {
      spaceDetails[s.id] = {
        features: s.features,
        capacity: s.capacity || 4,
        availability: s.availability || "24/7",
        size: s.size || "",
      };
    }
  }
  if (printShopConfig.features) {
    spaceDetails["print-shop"] = {
      features: printShopConfig.features,
      capacity: printShopConfig.capacity || 3,
      availability: printShopConfig.availability || "Ma-Zo",
      size: printShopConfig.size || "15m²",
    };
  }

  useEffect(() => {
    const checkMembership = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setMemberLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data?.subscribed) {
          setIsMember(true);
        }
        if (!data?.subscribed) {
          const { data: profile } = await supabase.from("profiles").select("membership").eq("id", authUser.id).single();
          if (profile?.membership) {
            setIsMember(true);
          }
        }
      } catch (err) {
        console.error("Failed to check subscription:", err);
      } finally {
        setMemberLoading(false);
      }
    };
    checkMembership();
  }, []);

  return (
    <div className="min-h-full pb-24">
      <SEO title="Ruimtes & Studio's — Uprising Studio Amersfoort" description="Ontdek onze muziekstudio's en contentruimtes in Amersfoort, met afmetingen en capaciteit per ruimte." path="/spaces" />
      <div className="relative px-5 pt-6 pb-5">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">{t("spaces")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("spacesSubtitle")}</p>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {allSpaces.map((space, index) => {
          const details = spaceDetails[space.id];
          const isExpanded = expandedSpace === space.id;

          return (
            <motion.div key={space.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.5 }} layout
            className="relative overflow-hidden rounded-2xl border border-border bg-card">
              <button onClick={() => setExpandedSpace(isExpanded ? null : space.id)} className="relative w-full aspect-[2/1] overflow-hidden">
                <img src={(() => { const studio = configStudios.find(s => s.id === space.id); const configImg = studio?.imageUrl || (space.id === "print-shop" ? printShopConfig?.imageUrl : ""); return configImg || fallbackImages[space.id] || ""; })()} alt={t(space.nameKey as any)} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" loading="lazy" decoding="async" width={600} height={240} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                <div className="absolute top-2 right-2">
                  {isMember && space.pricePerHour > 0 ?
                  <span className="flex items-center gap-1 rounded-full bg-success/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
                      <Crown size={10} /> {t("included")}
                    </span> :

                  <span className="rounded-full bg-background/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-foreground shadow-md">
                      {space.pricePerHour > 0 ? `€${space.pricePerHour}/${t("perHr")}` : t("onRequest")}
                    </span>
                  }
                </div>

                <div className="absolute top-2 left-2">
                  <div className="rounded-full bg-background/30 backdrop-blur-md p-1">
                    {isExpanded ? <X size={12} className="text-white" /> : <Expand size={12} className="text-white" />}
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-lg font-bold font-display text-white">{(() => { const studio = configStudios.find(s => s.id === space.id); const ps = space.id === "print-shop" ? printShopConfig : null; const title = lang === "nl" ? (studio?.titleNl || ps?.titleNl) : (studio?.titleEn || ps?.titleEn); return title || t(space.nameKey as any); })()}</h3>
                  {details &&
                  <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-white/70"><Users size={10} /><span className="text-[10px] font-medium">max {details.capacity}</span></div>
                      <div className="flex items-center gap-1 text-white/70"><Clock size={10} /><span className="text-[10px] font-medium">{details.availability}</span></div>
                      <div className="flex items-center gap-1 text-white/70"><Expand size={10} /><span className="text-[10px] font-medium">{details.size}</span></div>
                    </div>
                  }
                </div>
              </button>

              <AnimatePresence>
                {isExpanded &&
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }} className="overflow-hidden">
                    <div className="p-4 space-y-4 border-t border-border">
                      <p className="text-sm text-muted-foreground leading-relaxed">{(() => { const studio = configStudios.find(s => s.id === space.id); const ps = space.id === "print-shop" ? printShopConfig : null; const desc = lang === "nl" ? (studio?.descNl || ps?.descNl) : (studio?.descEn || ps?.descEn); return desc || t(space.descKey as any); })()}</p>

                      {details &&
                    <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("features")}</p>
                          <div className="flex flex-wrap gap-2">
                            {details.features.map((f) =>
                        <span key={f.nl} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">
                                <div className="h-1 w-1 rounded-full bg-primary" />
                                {f[localizedLang]}
                              </span>
                        )}
                          </div>
                        </div>
                    }

                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("equipment")}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {space.equipment.map((eq) => {
                          const EqIcon = equipmentIcons[eq] || Headphones;
                          return (
                            <div key={eq} className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2.5 py-2">
                                <EqIcon size={12} className="text-primary shrink-0" />
                                <span className="text-[11px] font-medium text-secondary-foreground truncate">{eq}</span>
                              </div>);

                        })}
                        </div>
                      </div>

                      <button onClick={() => {
                      if (space.pricePerHour > 0) navigate(`/book?studio=${space.id}`);else
                      navigate(`/request?type=${space.id}`);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform">
                        {space.pricePerHour > 0 ? t("bookThisSpace") : t("request")}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                }
              </AnimatePresence>

              {!isExpanded &&
              <div className="flex items-center justify-between p-3 border-t border-border">
                  <p className="text-xs text-muted-foreground line-clamp-1 flex-1 mr-3">{(() => { const studio = configStudios.find(s => s.id === space.id); const ps = space.id === "print-shop" ? printShopConfig : null; const desc = lang === "nl" ? (studio?.descNl || ps?.descNl) : (studio?.descEn || ps?.descEn); return desc || t(space.descKey as any); })()}</p>
                  <button onClick={(e) => {
                  e.stopPropagation();
                  if (space.pricePerHour > 0) navigate(`/book?studio=${space.id}`);else
                  navigate(`/request?type=${space.id}`);
                }}
                className="shrink-0 flex items-center gap-1 rounded-full gradient-primary px-4 py-2 text-[11px] font-bold text-primary-foreground shadow-glow active:scale-[0.97] transition-transform bg-primary">
                    {t("book2")}
                    <ChevronRight size={12} />
                  </button>
                </div>
              }
            </motion.div>);

        })}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <MapPin size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold font-display text-sm">Uprising Studio</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Spaceshuttle 6e, Amersfoort</p>
              <a href="https://maps.google.com/?q=Spaceshuttle+6e+Amersfoort" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-2 hover:underline">
                {t("viewOnMap")}
                <ChevronRight size={12} />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>);

};

export default SpacesPage;