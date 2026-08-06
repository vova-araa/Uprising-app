import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Mic, Camera, Sliders, Music, Crown, Sparkles, Image, Shirt, Package, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

// Per-category colour so the overview reads as a lively launcher, not a grey list.
const GRAD = {
  studio: "linear-gradient(142deg,#8b3ff5,#c94bf0)",
  content: "linear-gradient(142deg,#f0409b,#f57ac0)",
  mix: "linear-gradient(142deg,#3b82f6,#22d3ee)",
  producer: "linear-gradient(142deg,#16c784,#4ade80)",
  coach: "linear-gradient(142deg,#f59e0b,#fbbf24)",
  member: "linear-gradient(142deg,#e0a417,#f5c542)",
  request: "linear-gradient(142deg,#f59e0b,#fbbf24)",
};

const ServicesPage = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const nl = lang === "nl";

  const featured = {
    icon: Mic,
    title: nl ? "Studio's boeken" : "Book a studio",
    desc: nl ? "Opnemen & produceren in Studio 1 of 2 — 24/7 self-service" : "Record & produce in Studio 1 or 2 — 24/7 self-service",
    price: nl ? "vanaf €30/uur" : "from €30/hr",
    grad: GRAD.studio,
    path: "/book?type=studio",
    tag: nl ? "Populair" : "Popular",
  };

  const tiles = [
    { icon: Camera, title: nl ? "Contentruimte" : "Content room", desc: nl ? "Foto, video & podcast" : "Photo, video & podcast", price: nl ? "vanaf €35/uur" : "from €35/hr", grad: GRAD.content, path: "/book?studio=content-room" },
    { icon: Sliders, title: "Mix & Master", desc: nl ? "Radio-ready door een engineer" : "Radio-ready by an engineer", price: "€150/track", grad: GRAD.mix, path: "/mix-master" },
    { icon: Music, title: nl ? "Producer-sessie" : "Producer session", desc: nl ? "Samen aan je track werken" : "Work on your track together", price: "€350/single", grad: GRAD.producer, path: "/producer-booking" },
    { icon: Sparkles, title: "Content Coach", desc: nl ? "Post-ideeën & releaseplan" : "Post ideas & release plan", price: nl ? "AI-coaching" : "AI coaching", grad: GRAD.coach, path: user ? "/coach" : "/auth" },
  ];

  const membership = {
    icon: Crown,
    title: "Producer Memberships",
    desc: nl ? "Korting op studio's & meer — voordeliger als je vaker komt" : "Discounts on studios & more — better value when you come often",
    price: nl ? "vanaf €150/mnd" : "from €150/mo",
    grad: GRAD.member,
    path: "/diensten/memberships",
  };

  const requests = [
    { icon: Image, title: nl ? "Fotografie" : "Photography", path: "/request?type=photography" },
    { icon: Shirt, title: nl ? "Kleding" : "Clothing", path: "/request?type=clothing" },
    { icon: Package, title: nl ? "Merchandise" : "Merchandise", path: "/request?type=merch" },
  ];

  return (
    <div className="min-h-full pb-24">
      <SEO title="Diensten — Uprising Studio Amersfoort" description="Alle creatieve diensten van Uprising Studio: studio-sessies, content, mix & master en meer." path="/services" />
      <div className="px-5 pt-6 pb-1">
        <h1 className="text-2xl font-extrabold font-display tracking-[-0.01em]">{t("allServices")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {nl ? "Kies een dienst en boek direct — of vraag maatwerk aan." : "Pick a service and book directly — or request custom work."}
        </p>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 mt-4 space-y-6">
        {/* Bento launcher */}
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          {/* Featured — wide */}
          <button onClick={() => navigate(featured.path)}
            className="col-span-2 group relative flex items-center gap-4 rounded-2xl card-feature border border-white/5 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.99]">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-glow transition-transform group-hover:scale-105" style={{ background: featured.grad }}>
              <featured.icon size={26} className="text-white" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold font-display tracking-[-0.01em] leading-tight">{featured.title}</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">{featured.tag}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug mt-1">{featured.desc}</p>
              <p className="text-sm font-bold text-primary mt-1.5">{featured.price}</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
          </button>

          {/* 2×2 colour tiles */}
          {tiles.map((c) => (
            <button key={c.title} onClick={() => navigate(c.path)}
              className="group flex flex-col gap-3 rounded-2xl card-feature border border-white/5 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105" style={{ background: c.grad }}>
                <c.icon size={20} className="text-white" strokeWidth={2.2} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold font-display leading-tight">{c.title}</p>
                <p className="text-[11.5px] text-muted-foreground leading-snug mt-1">{c.desc}</p>
              </div>
              <p className="text-xs font-bold text-primary">{c.price}</p>
            </button>
          ))}

          {/* Memberships — wide */}
          <button onClick={() => navigate(membership.path)}
            className="col-span-2 group relative flex items-center gap-4 rounded-2xl card-feature border border-white/5 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.99]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105" style={{ background: membership.grad }}>
              <membership.icon size={22} className="text-white" strokeWidth={2.1} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold font-display leading-tight">{membership.title}</h3>
              <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">{membership.desc}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-primary whitespace-nowrap">{membership.price}</p>
              <ChevronRight size={18} className="text-muted-foreground ml-auto mt-1 group-hover:text-primary transition-colors" />
            </div>
          </button>
        </motion.div>

        {/* On request */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="h-5 w-1 rounded-full accent-bar" />
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("onRequest")}</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {requests.map((r) => (
              <button key={r.title} onClick={() => navigate(r.path)}
                className="group flex flex-col items-center gap-2.5 rounded-2xl card-feature border border-white/5 p-4 text-center transition-all hover:-translate-y-0.5 active:scale-[0.98]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: GRAD.request }}>
                  <r.icon size={19} className="text-white" strokeWidth={2.1} />
                </div>
                <span className="text-xs font-bold font-display leading-tight">{r.title}</span>
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-medium text-warning">{t("onRequest")}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ServicesPage;
