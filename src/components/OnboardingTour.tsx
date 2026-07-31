import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Music, LayoutGrid, CalendarCheck, DoorOpen, User, Gift, Sparkles, Rocket, ArrowRight, ArrowLeft, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";

import { ONBOARDING_KEY } from "./onboardingKey";
export { ONBOARDING_KEY };

interface Slide {
  icon: typeof Music;
  title: TranslationKey;
  body: TranslationKey;
}

const SLIDES: Slide[] = [
  { icon: Music, title: "onbWelcomeTitle", body: "onbWelcomeBody" },
  { icon: LayoutGrid, title: "onbBrowseTitle", body: "onbBrowseBody" },
  { icon: CalendarCheck, title: "onbBookTitle", body: "onbBookBody" },
  { icon: DoorOpen, title: "onbAccessTitle", body: "onbAccessBody" },
  { icon: User, title: "onbAccountTitle", body: "onbAccountBody" },
  { icon: Gift, title: "onbPointsTitle", body: "onbPointsBody" },
  { icon: Sparkles, title: "onbCoachTitle", body: "onbCoachBody" },
  { icon: Rocket, title: "onbReadyTitle", body: "onbReadyBody" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

const OnboardingTour = ({ open, onClose }: Props) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [i, setI] = useState(0);

  if (!open) return null;

  const slide = SLIDES[i];
  const Icon = slide.icon;
  const isLast = i === SLIDES.length - 1;

  const finish = () => {
    try { localStorage.setItem(ONBOARDING_KEY, "seen"); } catch { /* ignore */ }
    setI(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" style={{ paddingTop: "var(--safe-area-top)", paddingBottom: "var(--safe-area-bottom)" }}>
      {/* Ambient glow */}
      <div className="ambient-glow pointer-events-none absolute inset-0" />

      {/* Skip */}
      <div className="relative flex justify-end px-5 pt-4">
        <button onClick={finish} className="flex items-center gap-1 rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {t("onbSkip")} <X size={13} />
        </button>
      </div>

      {/* Slide */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center"
          >
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl gradient-primary shadow-glow">
              <Icon size={44} className="text-primary-foreground" />
            </div>
            <h2 className="mb-3 text-2xl font-bold font-display leading-tight max-w-xs">{t(slide.title)}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-sm">{t(slide.body)}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="relative flex justify-center gap-1.5 pb-6">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`${idx + 1}`}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="relative flex items-center gap-3 px-6 pb-6">
        {i > 0 && (
          <button onClick={() => setI(i - 1)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground" aria-label={t("onbBack")}>
            <ArrowLeft size={18} />
          </button>
        )}
        <button
          onClick={() => {
            if (isLast) { finish(); navigate("/book"); }
            else setI(i + 1);
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98]"
        >
          {isLast ? t("onbStart") : t("onbNext")}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default OnboardingTour;
