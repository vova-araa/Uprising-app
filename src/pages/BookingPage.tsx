import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { redirectToExternal } from "@/lib/redirect";
import { useI18n } from "@/lib/i18n";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronDown, Check, Clock, MapPin, Sparkles, Crown, Loader2, Star,
  Sliders, Music, Minus, Plus, ToggleLeft, ToggleRight, FileText, CheckSquare, ShieldCheck,
  Camera, Image, Shirt, Package, ChevronRight, Gift, Users, Building2,
  GraduationCap, Flame, Rocket
} from "lucide-react";
import { generateTimeSlots } from "@/lib/data";
import { computeStudioPricing, DEFAULT_OFFPEAK, DEFAULT_LASTMINUTE, lastMinuteDiscountPct, type OffPeakConfig, type LastMinuteConfig } from "../../supabase/functions/_shared/pricing";
import { format, addMonths, subMonths, isSameDay, isBefore, startOfDay } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import studioAImg from "@/assets/studio-a.webp";
import studioBImg from "@/assets/studio-b.webp";
import contentRoomImg from "@/assets/content-room-2.webp";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { inlineToast as toast } from "@/components/InlineToast";
import AuthGateDialog from "@/components/AuthGateDialog";
import PageLoader from "@/components/PageLoader";
import SEO from "@/components/SEO";

const studioImages: Record<string, string> = {
  "studio-1": studioAImg,
  "studio-2": studioBImg,
  "content-room": contentRoomImg,
};

const BookingPage = () => {
  const { t, lang } = useI18n();
  const localizedLang = lang === "nl" ? "nl" : "en";
  const navigate = useNavigate();
  const { user } = useAuth();
  const config = useAppConfig();
  const [searchParams] = useSearchParams();

  // Config-driven values
  const studios = config.studios;
  const extras = config.bookingRules.extras;
  const MIN_DURATION = config.bookingRules.min_duration;
  const MAX_DURATION_DEFAULT = config.bookingRules.max_duration;
  const TIER_LIMITS: Record<string, { maxHours: number; maxBookings: number }> = {};
  for (const tier of config.membershipTiers) {
    TIER_LIMITS[tier.id] = { maxHours: tier.maxHours, maxBookings: tier.maxBookings };
  }
  const memberships = config.membershipTiers.map(tier => ({
    name: tier.name,
    icon: tier.id === "basic" ? Sparkles : tier.id === "pro" ? Star : tier.id === "unlimited" ? Crown : Building2,
    desc: tier.desc,
    priceMonthly: tier.priceMonthly,
    priceYearly: tier.priceYearly,
    priceLabel: tier.priceMonthly === null ? { nl: "Op aanvraag", en: "On request" } : undefined,
    color: "text-primary",
    bg: "bg-primary/20",
  }));
  const preselectedStudio = searchParams.get("studio");
  const preselectedType = searchParams.get("type");
  const [step, setStep] = useState(preselectedStudio ? 2 : preselectedType === "studio" ? 1 : 0);
  const [selectedStudio, setSelectedStudio] = useState<string | null>(preselectedStudio);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [photographerDescription, setPhotographerDescription] = useState("");
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateContext, setAuthGateContext] = useState<"booking" | "membership">("booking");
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [pendingUpgrade, setPendingUpgrade] = useState<{ planKey: string; planName: string; kind: "upgrade" | "downgrade" } | null>(null);

  const [isMember, setIsMember] = useState(false);
  const [memberTier, setMemberTier] = useState<string | null>(null);
  const [broedplaatsTier, setBroedplaatsTier] = useState<string | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);
  const [memberHoursUsed, setMemberHoursUsed] = useState(0);
  const [memberUpcomingCount, setMemberUpcomingCount] = useState(0);
  const [creditStudio1Hours, setCreditStudio1Hours] = useState(0);
  const [creditStudio2Hours, setCreditStudio2Hours] = useState(0);
  const [creditContentHours, setCreditContentHours] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistJoining, setWaitlistJoining] = useState(false);
  useEffect(() => { setWaitlistJoined(false); }, [selectedDate, selectedStudio]);

  const creditHoursMap: Record<string, number> = {
    "studio-1": creditStudio1Hours,
    "studio-2": creditStudio2Hours,
    "content-room": creditContentHours,
  };
  const creditHours = selectedStudio ? (creditHoursMap[selectedStudio] || 0) : 0;
  const tierLimits = TIER_LIMITS[memberTier?.toLowerCase() || "basic"] || TIER_LIMITS.basic;
  const remainingMemberHours = isMember && tierLimits.maxHours < 999 ? Math.max(0, tierLimits.maxHours - memberHoursUsed) : MAX_DURATION_DEFAULT;
  const totalFreeHours = isMember ? remainingMemberHours : creditHours;
  const maxDuration = isMember ? Math.min(MAX_DURATION_DEFAULT, remainingMemberHours) : MAX_DURATION_DEFAULT;
  const canBook = !isMember || memberUpcomingCount < tierLimits.maxBookings;

  useEffect(() => {
    if (!user) {
      setMemberLoading(false);
      return;
    }
    const checkMembership = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data?.subscribed) {
          setIsMember(true);
          setHasStripeSubscription(true);
          setMemberTier(data.studio_plan || data.plan || "basic");
          if (data.broedplaats_plan) {
            setBroedplaatsTier(data.broedplaats_plan);
          }
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("membership, broedplaats, membership_override")
          .eq("id", user.id)
          .single();

        if (!data?.subscribed && profile?.membership) {
          setIsMember(true);
          setMemberTier(profile.membership);
        }
        // Apply override tier for limits
        if ((profile as any)?.membership_override) {
          setMemberTier((profile as any).membership_override);
        }

        if (!data?.broedplaats_plan && profile?.broedplaats) {
          setBroedplaatsTier(profile.broedplaats);
        }
      } catch (err) {
        console.error("Failed to check subscription:", err);
      } finally {
        setMemberLoading(false);
      }
    };
    checkMembership();
  }, [user]);

  // Clean up pending_payment bookings when returning from cancelled Stripe
  // payment. Goes through cancel-booking so any applied wallet credit is
  // refunded instead of silently lost.
  useEffect(() => {
    if (!user || searchParams.get("payment") !== "cancelled") return;
    const cleanup = async () => {
      const { data: pending } = await supabase
        .from("bookings")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending_payment");
      for (const b of pending || []) {
        await supabase.functions.invoke("cancel-booking", { body: { booking_id: b.id } });
      }
      navigate("/book", { replace: true });
    };
    cleanup();
  }, [user, searchParams]);

  // Fetch credit hours from profile
  useEffect(() => {
    if (!user) return;
    const fetchCredits = async () => {
      const { data: profile } = await supabase.from("profiles").select("studio1_hours, studio2_hours, content_hours, credit_balance").eq("id", user.id).single();
      if (profile) {
        setCreditStudio1Hours((profile as any).studio1_hours || 0);
        setCreditStudio2Hours((profile as any).studio2_hours || 0);
        setCreditContentHours(profile.content_hours || 0);
        setWalletBalance(Number((profile as any).credit_balance || 0));
      }
    };
    fetchCredits();
  }, [user]);

  // Fetch member usage (hours this month + upcoming bookings)
  useEffect(() => {
    if (!isMember || !user) return;
    const fetchUsage = async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const monthStart = `${year}-${month}-01`;
      const nextMonth = now.getMonth() + 2 > 12
        ? `${year + 1}-01-01`
        : `${year}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;
      const todayStr = now.toISOString().split("T")[0];

      const [{ data: monthBookings }, { data: upcomingBookings }] = await Promise.all([
        supabase.from("bookings").select("duration_hours").eq("user_id", user.id).eq("status", "confirmed").eq("session_type", "member").gte("booking_date", monthStart).lt("booking_date", nextMonth),
        supabase.from("bookings").select("id").eq("user_id", user.id).eq("status", "confirmed").eq("session_type", "member").gte("booking_date", todayStr),
      ]);

      const hoursUsed = (monthBookings || []).reduce((sum, b) => sum + (b.duration_hours || 0), 0);
      setMemberHoursUsed(hoursUsed);
      setMemberUpcomingCount((upcomingBookings || []).length);
    };
    fetchUsage();
  }, [isMember, user]);

  const [bookedHours, setBookedHours] = useState<Set<number>>(new Set());
  const [monthBookedMap, setMonthBookedMap] = useState<Record<string, Set<number>>>({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const fetchBookedSlots = useCallback(async () => {
    if (!selectedStudio || !selectedDate) {
      setBookedHours(new Set());
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    // Use security-definer RPC so we see ALL bookings (not just our own under RLS)
    const { data, error } = await supabase.rpc("get_booking_availability", {
      target_date: dateStr,
      target_studio_id: selectedStudio,
    });
    if (error) {
      console.error("[fetchBookedSlots]", error);
      setBookedHours(new Set());
      return;
    }
    const occupied = new Set<number>();
    (data || []).forEach((b: any) => {
      const startH = parseInt(b.start_time.split(":")[0]);
      for (let i = 0; i < b.duration_hours; i++) occupied.add(startH + i);
    });
    setBookedHours(occupied);
  }, [selectedStudio, selectedDate]);

  useEffect(() => {
    fetchBookedSlots();
  }, [fetchBookedSlots]);

  // Fetch all bookings for visible calendar month (used for date-level indicators)
  const fetchMonthBookings = useCallback(async () => {
    if (!selectedStudio) { setMonthBookedMap({}); return; }
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    // Fetch each date via RPC in parallel so we get full visibility regardless of RLS
    const dateStrs: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      dateStrs.push(format(new Date(y, m, d), "yyyy-MM-dd"));
    }
    const results = await Promise.all(
      dateStrs.map((ds) =>
        supabase.rpc("get_booking_availability", { target_date: ds, target_studio_id: selectedStudio })
          .then((r) => ({ ds, rows: r.data || [] }))
      )
    );
    const map: Record<string, Set<number>> = {};
    results.forEach(({ ds, rows }) => {
      (rows as any[]).forEach((b) => {
        const startH = parseInt(b.start_time.split(":")[0]);
        if (!map[ds]) map[ds] = new Set<number>();
        for (let i = 0; i < b.duration_hours; i++) map[ds].add(startH + i);
      });
    });
    setMonthBookedMap(map);
  }, [selectedStudio, calendarMonth]);

  useEffect(() => { fetchMonthBookings(); }, [fetchMonthBookings]);

  // Real-time subscription for booking changes
  useEffect(() => {
    if (!selectedStudio || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const channel = supabase
      .channel(`bookings-${selectedStudio}-${dateStr}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `studio_id=eq.${selectedStudio}`,
        },
        () => {
          fetchBookedSlots();
          fetchMonthBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedStudio, selectedDate, fetchBookedSlots, fetchMonthBookings]);

  const timeSlots = useMemo(() => {
    const base = generateTimeSlots();
    const now = new Date();
    const isToday = selectedDate && isSameDay(selectedDate, now);
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    return base.map((slot) => {
      const h = parseInt(slot.time.split(":")[0]);
      let available = true;
      let booked = false;

      // If today, hide slots whose start time has already passed
      if (isToday && (h < currentHour || (h === currentHour && currentMin > 0))) {
        available = false;
      }

      // Check against booked hours
      if (available) {
        for (let i = 0; i < selectedDuration; i++) {
          if (bookedHours.has(h + i)) { available = false; booked = true; break; }
        }
      }

      return { ...slot, available, booked };
    });
  }, [bookedHours, selectedDuration, selectedDate]);
  const locale = lang === "nl" ? nl : enUS;
  const studio = studios.find((s) => s.id === selectedStudio);
  const paidHours = isMember ? 0 : (creditHours > 0 ? Math.max(0, selectedDuration - creditHours) : selectedDuration);
  const offPeakCfg: OffPeakConfig = { ...DEFAULT_OFFPEAK, ...(config.getConfigRaw("offpeak_pricing") || {}) };
  const studioPricing = studio && selectedDate && selectedTime
    ? computeStudioPricing(
        studio.pricePerHour,
        format(selectedDate, "yyyy-MM-dd"),
        selectedTime,
        selectedDuration,
        selectedDuration - paidHours,
        offPeakCfg,
      )
    : { total: studio ? paidHours * studio.pricePerHour : 0, fullPrice: studio ? paidHours * studio.pricePerHour : 0, discount: 0, paidHours, offPeakHours: 0 };
  // Last-minute deal beats off-peak when bigger (never stacked)
  const lastMinuteCfg: LastMinuteConfig = { ...DEFAULT_LASTMINUTE, ...(config.getConfigRaw("lastminute_pricing") || {}) };
  const nowForLm = new Date();
  const lmPct = studio && selectedDate && selectedTime
    ? lastMinuteDiscountPct(selectedTime, format(selectedDate, "yyyy-MM-dd") === format(nowForLm, "yyyy-MM-dd"), nowForLm.getHours() * 60 + nowForLm.getMinutes(), lastMinuteCfg)
    : 0;
  const lmTotal = lmPct > 0 ? Math.round(studioPricing.fullPrice * (1 - lmPct / 100) * 100) / 100 : studioPricing.total;
  const useLastMinute = lmPct > 0 && lmTotal < studioPricing.total;
  const studioPrice = useLastMinute ? lmTotal : studioPricing.total;
  const offPeakDiscount = useLastMinute ? 0 : studioPricing.discount;
  const lastMinuteDiscount = useLastMinute ? Math.round((studioPricing.fullPrice - lmTotal) * 100) / 100 : 0;
  const extrasPrice = selectedExtras.reduce((sum, eId) => {
    const ex = extras.find((e) => e.id === eId);
    return sum + (ex?.price || 0);
  }, 0);
  const totalPrice = Math.round((studioPrice + extrasPrice) * 100) / 100;
  const walletApplied = useWallet && totalPrice > 0 ? Math.min(walletBalance, totalPrice) : 0;
  const dueNow = totalPrice - walletApplied;


  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [calendarMonth]);

  const stepTitles = [
    t("whatToBook"),
    t("chooseService"),
    t("chooseDate"),
    t("timeDuration"),
    t("reviewBooking"),
  ];
  const totalSteps = 5;

  const toggleExtra = (extraId: string) => {
    setSelectedExtras((prev) =>
      prev.includes(extraId) ? prev.filter((e) => e !== extraId) : [...prev, extraId]
    );
  };

  const handleMembershipCheckout = async (planName: string) => {
    if (!user) {
      setAuthGateContext("membership");
      setShowAuthGate(true);
      return;
    }
    setMembershipLoading(planName);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          plan: planName.toLowerCase(),
          interval: yearly ? "year" : "quarter",
          referral_code: referralCode || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.url) {
        redirectToExternal(data.url);
      } else {
        toast.error(t("paymentLinkFailed"));
      }
    } catch (err: any) {
      console.error("Membership checkout error:", err);
      toast.error(t("somethingWentWrongRetry"));
    } finally {
      setMembershipLoading(null);
    }
  };

  const handleUpgrade = async (targetPlan: string) => {
    if (!user) return;
    setUpgradeLoading(targetPlan);
    try {
      const { data, error } = await supabase.functions.invoke("update-subscription", {
        body: { target_plan: targetPlan },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.action === "upgrade") {
        toast.success(lang === "nl"
          ? `Geüpgraded naar ${targetPlan}! Het resterende bedrag is direct afgeschreven.`
          : `Upgraded to ${targetPlan}! The prorated amount has been charged.`);
        // Refresh membership state
        setMemberTier(targetPlan.startsWith("broedplaats") ? memberTier : targetPlan);
        if (targetPlan.startsWith("broedplaats")) setBroedplaatsTier(targetPlan);
      } else if (data?.action === "downgrade") {
        const endDate = data.effective_date ? new Date(data.effective_date).toLocaleDateString(lang === "nl" ? "nl-NL" : "en-US") : "";
        toast.success(lang === "nl"
          ? `Downgrade naar ${targetPlan} gepland. Gaat in op ${endDate}.`
          : `Downgrade to ${targetPlan} scheduled. Effective ${endDate}.`);
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      toast.error(t("somethingWentWrongRetry"));
    } finally {
      setUpgradeLoading(null);
    }
  };

  const handlePayment = async () => {
    if (!user) {
      setAuthGateContext("booking");
      setShowAuthGate(true);
      return;
    }
    if (!selectedStudio || !selectedDate || !selectedTime) {
      toast.error(t("fillAllFields"));
      return;
    }

    setIsLoading(true);
    try {
      // Pre-flight availability check to avoid confusing "freeze" on confirm
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data: existing } = await supabase
        .from("bookings")
        .select("start_time, duration_hours")
        .eq("studio_id", selectedStudio)
        .eq("booking_date", dateStr)
        .in("status", ["pending", "confirmed", "pending_payment"]);
      const reqStart = parseInt(selectedTime.split(":")[0]) * 60 + parseInt(selectedTime.split(":")[1] || "0");
      const reqEnd = reqStart + selectedDuration * 60;
      const conflict = (existing || []).some((b: any) => {
        const s = parseInt(b.start_time.split(":")[0]) * 60 + parseInt(b.start_time.split(":")[1] || "0");
        const e = s + b.duration_hours * 60;
        return reqStart < e && reqEnd > s;
      });
      if (conflict) {
        toast.error(lang === "nl"
          ? "Dit tijdslot is helaas al geboekt. Kies een ander tijdstip."
          : "This time slot is already booked. Please pick another time.");
        await fetchBookedSlots();
        setSelectedTime(null);
        setStep(3);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-booking", {
        body: {
          studio_id: selectedStudio,
          booking_date: dateStr,
          start_time: selectedTime,
          duration_hours: selectedDuration,
          extras: selectedExtras,
          photographer_notes: selectedExtras.includes("photographer") ? photographerDescription : undefined,
          use_wallet: useWallet && walletApplied > 0,
        },
      });

      // Parse server-side error body (FunctionsHttpError keeps it in error.context.Response)
      let serverError: string | null = null;
      if (error && (error as any).context) {
        try {
          const ctx = (error as any).context;
          const body = typeof ctx?.json === "function" ? await ctx.json() : ctx;
          if (body?.error) serverError = body.error;
        } catch { /* ignore parse errors */ }
      }
      if (!serverError && data?.error) serverError = data.error;

      if (serverError) {
        toast.error(serverError);
        await fetchBookedSlots();
        if (/tijdslot|time slot|beschikbaar|available/i.test(serverError)) {
          setSelectedTime(null);
          setStep(3);
        }
        return;
      }

      if (error) throw error;

      if (data?.url) {
        redirectToExternal(data.url);
      } else if (data?.success) {
        toast.success(t("sessionBooked"));
        navigate("/account?tab=bookings");
      } else {
        console.error("Unexpected response from create-booking:", data);
        toast.error(t("paymentLinkFailed"));
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(t("paymentError"));
    } finally {
      setIsLoading(false);
    }
  };

  const getEndTime = () => {
    if (!selectedTime) return "";
    const startHour = parseInt(selectedTime.split(":")[0]);
    const endHour = (startHour + selectedDuration) % 24;
    return `${endHour.toString().padStart(2, "0")}:00`;
  };

  if (memberLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-full bg-background" data-toast-section>
      <SEO title="Boek een ruimte of sessie — Uprising Studio" description="Reserveer direct een muziekstudio, contentruimte of creatieve sessie bij Uprising Studio in Amersfoort." path="/book" />
      <AuthGateDialog
        open={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        onAuthenticated={() => setShowAuthGate(false)}
        context={authGateContext}
      />
      {/* Confirm subscription upgrade/downgrade before charging the card */}
      {pendingUpgrade && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm px-6" onClick={() => !upgradeLoading && setPendingUpgrade(null)}>
          <div className="animate-fade-in rounded-2xl card-premium border border-border p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Crown size={18} className="text-primary" />
              <h3 className="font-display font-semibold text-base">
                {pendingUpgrade.kind === "upgrade"
                  ? (lang === "nl" ? `Upgraden naar ${pendingUpgrade.planName}?` : `Upgrade to ${pendingUpgrade.planName}?`)
                  : (lang === "nl" ? `Downgraden naar ${pendingUpgrade.planName}?` : `Downgrade to ${pendingUpgrade.planName}?`)}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {pendingUpgrade.kind === "upgrade"
                ? (lang === "nl"
                    ? "Het verrekende bedrag voor de rest van je termijn wordt direct van je kaart afgeschreven."
                    : "The prorated amount for the rest of your term will be charged to your card right away.")
                : (lang === "nl"
                    ? "De downgrade gaat in aan het einde van je huidige termijn. Tot die tijd houd je je huidige plan."
                    : "The downgrade takes effect at the end of your current term. Until then you keep your current plan.")}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPendingUpgrade(null)} disabled={!!upgradeLoading}
                className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium disabled:opacity-60">
                {lang === "nl" ? "Annuleren" : "Cancel"}
              </button>
              <button
                onClick={async () => {
                  const target = pendingUpgrade.planKey;
                  await handleUpgrade(target);
                  setPendingUpgrade(null);
                }}
                disabled={!!upgradeLoading}
                className="flex-1 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60">
                {upgradeLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {lang === "nl" ? "Bevestigen" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-xl" style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}>
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button onClick={() => {
              const prev = step - 1;
              if (prev === 0) {
                setSelectedStudio(null);
                setSelectedDate(null);
                setSelectedTime(null);
                setSelectedDuration(2);
                setSelectedExtras([]);
                setPhotographerDescription("");
                setRulesAccepted(false);
              }
              if (prev === 1) {
                setSelectedStudio(null);
                setSelectedDate(null);
                setSelectedTime(null);
                setSelectedDuration(2);
                setSelectedExtras([]);
                setPhotographerDescription("");
              }
              if (prev === 2) {
                setSelectedTime(null);
                setSelectedExtras([]);
                setPhotographerDescription("");
              }
              setStep(prev);
            }} aria-label={lang === "nl" ? "Terug" : "Back"} className="p-1 -ml-1">
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-display">{stepTitles[step]}</h1>
              {isMember && (
                <span className="flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                  <Crown size={10} /> Member
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("step")} {step + 1} {t("of")} {totalSteps}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "gradient-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 ? (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {/* Direct booking services */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-5 w-1 rounded-full gradient-primary" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("bookDirectly")}
                  </h2>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="w-full flex items-center gap-4 rounded-2xl bg-card border border-border p-4 text-left transition-all hover:border-primary/30 active:scale-[0.99]"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20">
                    <MapPin size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold font-display text-base">{t("studioSession")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("bookRecordingRoom")}</p>
                    {isMember ? (
                      <p className="text-sm font-bold text-success mt-1 flex items-center gap-1"><Crown size={12} /> {t("included")}</p>
                    ) : (
                      <p className="text-sm font-bold text-primary mt-1">{t("fromPerHour")}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                </button>

                <button
                  onClick={() => { setSelectedStudio("content-room"); setTimeout(() => setStep(2), 200); }}
                  className="w-full flex items-center gap-4 rounded-2xl bg-card border border-border p-4 text-left transition-all hover:border-primary/30 active:scale-[0.99]"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20">
                    <Camera size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold font-display text-base">Content Room</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("photoVideoProduction")}</p>
                    {isMember ? (
                      <p className="text-sm font-bold text-success mt-1 flex items-center gap-1"><Crown size={12} /> {t("included")}</p>
                    ) : (
                      <p className="text-sm font-bold text-primary mt-1">{t("fromContentPerHour")}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                </button>

                <button
                  onClick={() => navigate("/mix-master")}
                  className="w-full flex items-center gap-4 rounded-2xl bg-card border border-border p-4 text-left transition-all hover:border-primary/30 active:scale-[0.99]"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20">
                    <Sliders size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold font-display text-base">Mix & Master</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("professionalMixMaster")}</p>
                    {isMember && memberTier === "unlimited" ? (
                      <p className="text-sm font-bold text-primary mt-1">€120 {t("perTrack")} <span className="text-[10px] text-success font-semibold">(-20%)</span></p>
                    ) : isMember && memberTier === "pro" ? (
                      <p className="text-sm font-bold text-primary mt-1">€135 {t("perTrack")} <span className="text-[10px] text-success font-semibold">(-10%)</span></p>
                    ) : (
                      <p className="text-sm font-bold text-primary mt-1">€150 {t("perTrack")}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                </button>

                <button
                  onClick={() => navigate("/producer-booking")}
                  className="w-full flex items-center gap-4 rounded-2xl bg-card border border-border p-4 text-left transition-all hover:border-primary/30 active:scale-[0.99]"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20">
                    <Music size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold font-display text-base">{t("producerSession")}</h3>
                      <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[9px] font-semibold text-warning">
                        {t("onRequest")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("workWithProducer")}</p>
                    {isMember && memberTier === "unlimited" ? (
                      <p className="text-sm font-bold text-primary mt-1">€280 {t("perSingle")} <span className="text-[10px] text-success font-semibold">(-20%)</span></p>
                    ) : isMember && memberTier === "pro" ? (
                      <p className="text-sm font-bold text-primary mt-1">€315 {t("perSingle")} <span className="text-[10px] text-success font-semibold">(-10%)</span></p>
                    ) : (
                      <p className="text-sm font-bold text-primary mt-1">€350 {t("perSingle")}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                </button>
              </div>

              {/* On request services */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-1 rounded-full bg-warning" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("onRequest")}
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "photography", icon: Image, name: { nl: "Fotografie", en: "Photography" }, route: "/request?type=photography" },
                    { id: "clothing", icon: Shirt, name: { nl: "Kleding", en: "Clothing" }, route: "/request?type=clothing" },
                    { id: "merch", icon: Package, name: { nl: "Merchandise", en: "Merchandise" }, route: "/request?type=merch" },
                  ].map((svc) => (
                    <button key={svc.id} onClick={() => navigate(svc.route)}
                      className="group flex flex-col items-center gap-2 rounded-2xl bg-card border border-border p-4 text-center transition-all hover:border-warning/30 active:scale-[0.98]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                        <svc.icon size={20} className="text-warning" />
                      </div>
                      <span className="text-xs font-semibold font-display">{svc.name[localizedLang]}</span>
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-medium text-warning">
                        {t("onRequest")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Memberships */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full gradient-primary" />
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Producer Memberships</h2>
                  </div>
                  {!isMember && (
                    <button onClick={() => { setYearly(!yearly); setContractAccepted(false); }}
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
                  )}
                </div>

                {!isMember && (
                  <div
                    id="membership-terms-panel"
                    className="mb-3 rounded-xl bg-primary/20 border border-primary/30 overflow-hidden">

                    {/* Collapsible header */}
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
                          {!yearly && !termsOpen && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {lang === "nl"
                                ? "⚡ Minimum 3 maanden commitment"
                                : "⚡ Minimum 3-month commitment"}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronDown size={16} className={`text-primary transition-transform duration-200 ${termsOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Collapsible content */}
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
                        <div className="text-[10px] text-muted-foreground leading-relaxed space-y-2 max-h-48 overflow-y-auto pr-1">
                          <p className="font-semibold text-foreground/80">
                            {t("article1Title")}
                          </p>
                          <p>
                            {lang === "nl"
                              ? yearly
                                ? "1.1 Door het afsluiten van een jaarabonnement gaat de klant (hierna: \"Abonnee\") een bindende overeenkomst aan met Uprising Studio, gevestigd te Amersfoort, Spaceshuttle 6e (hierna: \"Uprising Studio\"), voor een vaste periode van twaalf (12) opeenvolgende kalendermaanden, ingaande op de datum van eerste betaling."
                                : "1.1 Door het afsluiten van een 3-maanden membership gaat de klant (hierna: \"Abonnee\") een bindende overeenkomst aan met Uprising Studio, gevestigd te Amersfoort, Spaceshuttle 6e (hierna: \"Uprising Studio\"), voor een vaste periode van drie (3) opeenvolgende kalendermaanden, ingaande op de datum van eerste betaling."
                              : yearly
                                ? "1.1 By subscribing to an annual plan, the customer (\"Subscriber\") enters into a binding agreement with Uprising Studio, located at Spaceshuttle 6e, Amersfoort (\"Uprising Studio\"), for a fixed period of twelve (12) consecutive calendar months, commencing on the date of first payment."
                                : "1.1 By subscribing to a 3-month plan, the customer (\"Subscriber\") enters into a binding agreement with Uprising Studio, located at Spaceshuttle 6e, Amersfoort (\"Uprising Studio\"), for a fixed period of three (3) consecutive calendar months, commencing on the date of first payment."}
                          </p>
                          <p>
                            {lang === "nl"
                              ? "1.2 Het abonnement wordt na afloop van de initiële periode stilzwijgend verlengd met perioden van telkens één (1) maand, tenzij schriftelijk opgezegd met inachtneming van een opzegtermijn van dertig (30) dagen vóór het einde van de lopende periode."
                              : "1.2 After the initial period, the subscription will be tacitly renewed for periods of one (1) month, unless cancelled in writing with thirty (30) days notice before the end of the current period."}
                          </p>
                          <p className="font-semibold text-foreground/80">
                            {t("article2Title")}
                          </p>
                          <p>
                            {lang === "nl"
                              ? yearly
                                ? "2.1 De Abonnee verplicht zich tot maandelijkse betaling van het overeengekomen abonnementstarief gedurende de volledige contractperiode van twaalf (12) maanden."
                                : "2.1 De Abonnee verplicht zich tot maandelijkse betaling van het overeengekomen abonnementstarief gedurende de volledige contractperiode van drie (3) maanden."
                              : yearly
                                ? "2.1 The Subscriber commits to monthly payment of the agreed subscription fee for the full contract period of twelve (12) months."
                                : "2.1 The Subscriber commits to monthly payment of the agreed subscription fee for the full contract period of three (3) months."}
                          </p>
                          <p>
                            {lang === "nl"
                              ? "2.2 Tussentijdse opzegging ontslaat de Abonnee niet van de betalingsverplichting over de resterende maanden van de contractperiode."
                              : "2.2 Early termination does not release the Subscriber from payment obligations for the remaining months."}
                          </p>
                          <p className="font-semibold text-foreground/80">
                            {lang === "nl" ? "Artikel 3 — Toepasselijk Recht" : "Article 3 — Applicable Law"}
                          </p>
                          <p>
                            {lang === "nl"
                              ? "Op deze overeenkomst is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement Midden-Nederland."
                              : "This agreement is governed by Dutch law. Disputes shall be submitted to the competent court in the Central Netherlands district."}
                          </p>
                        </div>
                        <button onClick={() => setContractAccepted(!contractAccepted)} className="flex items-center gap-2 mt-3">
                          <div className={`flex h-5 w-5 items-center justify-center rounded ${contractAccepted ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"}`}>
                            {contractAccepted && <CheckSquare size={14} />}
                          </div>
                          <span className="text-xs font-medium">
                            {t("agreeTerms")}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}

                <div className="space-y-3">
                  {memberships.map((plan) => {
                    const planKey = plan.name.toLowerCase();
                    const hasCustomPrice = "priceLabel" in plan && plan.priceLabel;
                    const price = hasCustomPrice ? (plan as any).priceLabel[localizedLang] : (yearly ? plan.priceYearly : plan.priceMonthly);
                    const priceDisplay = hasCustomPrice ? price : `€${price}/${t("perMonth")}`;
                    const isCurrentPlan = isMember && memberTier === planKey;
                    const studioOrder: Record<string, number> = { basic: 1, pro: 2, unlimited: 3 };
                    const isUpgradeOption = isMember && memberTier && !hasCustomPrice && studioOrder[planKey] > (studioOrder[memberTier] || 0);
                    const isDowngradeOption = isMember && memberTier && !hasCustomPrice && studioOrder[planKey] < (studioOrder[memberTier] || 0);
                    const isDisabled = !isMember && !contractAccepted && !hasCustomPrice;
                    const isButtonLoading = membershipLoading === plan.name || upgradeLoading === planKey;

                    return (
                      <button key={plan.name}
                        onClick={() => {
                          if (hasCustomPrice) {
                            navigate("/request?type=business");
                          } else if (isCurrentPlan) {
                            // Already on this plan
                          } else if (hasStripeSubscription && isMember && (isUpgradeOption || isDowngradeOption)) {
                            setPendingUpgrade({ planKey, planName: plan.name, kind: isUpgradeOption ? "upgrade" : "downgrade" });
                          } else {
                            handleMembershipCheckout(plan.name);
                          }
                        }}
                        disabled={isCurrentPlan || !!membershipLoading || !!upgradeLoading}
                        className={`w-full flex items-center gap-4 rounded-2xl bg-card border p-4 text-left transition-all active:scale-[0.99] ${
                          isCurrentPlan ? "border-success/50 bg-success/5" : "border-border hover:border-primary/30"
                        }`}
                      >

                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isCurrentPlan ? "bg-success/20" : plan.bg}`}>
                          {isButtonLoading ? <Loader2 size={22} className="animate-spin text-muted-foreground" /> : <plan.icon size={22} className={isCurrentPlan ? "text-success" : plan.color} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold font-display text-base">{plan.name}</h3>
                            {isCurrentPlan && (
                              <span className="rounded-full bg-success/20 px-2 py-0.5 text-[9px] font-bold text-success">
                                {t("currentPlan")}
                              </span>
                            )}
                            {hasCustomPrice && (
                              <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[9px] font-semibold text-warning">
                                {t("onRequest")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{plan.desc[localizedLang]}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {hasCustomPrice ? null : (
                              <p className={`text-sm font-bold ${isCurrentPlan ? "text-success" : plan.color}`}>{priceDisplay}</p>
                            )}
                            {!isMember && yearly && plan.priceMonthly && plan.priceYearly && (
                              <span className="text-xs text-muted-foreground line-through">€{plan.priceMonthly}/{t("perMonth")}</span>
                            )}
                          </div>
                          {!isMember && yearly && plan.priceMonthly && plan.priceYearly && (
                            <p className="text-[10px] text-success mt-0.5">
                              {t("savingsPerYear")} €{(plan.priceMonthly - plan.priceYearly) * 12}/{t("yearLabel")}
                            </p>
                          )}
                          {hasStripeSubscription && isUpgradeOption && (
                            <p className="text-[10px] text-primary font-semibold mt-1">
                              {t("upgradeDesc")}
                            </p>
                          )}
                          {hasStripeSubscription && isDowngradeOption && (
                            <p className="text-[10px] text-muted-foreground font-medium mt-1">
                              {t("downgradeDesc")}
                            </p>
                          )}
                        </div>
                        {!isCurrentPlan && <ChevronRight size={18} className="text-muted-foreground shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Broedplaats */}
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-1 rounded-full gradient-primary" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("creativeHub")}
                  </h2>
                </div>
                <div className="space-y-3">
                  {[
                    { name: { nl: "Scholieren", en: "Students" }, icon: GraduationCap, desc: { nl: "Creatieve ontwikkeling voor scholieren", en: "Creative development for students" }, price: 45, plan: "broedplaats-students" },
                    { name: { nl: "Broedplaats", en: "Creative Hub" }, icon: Flame, desc: { nl: "Community & vaste broedplaats dagen", en: "Community & fixed hub days" }, price: 70, plan: "broedplaats" },
                    { name: { nl: "Broedplaats Plus", en: "Creative Hub Plus" }, icon: Rocket, desc: { nl: "Extra voordelen & ondersteuning", en: "Extra benefits & support" }, price: 150, plan: "broedplaats-plus" },
                  ].map((plan) => {
                    const isCurrentBroedplaats = broedplaatsTier === plan.plan;
                    const broedplaatsOrder: Record<string, number> = { "broedplaats-students": 1, broedplaats: 2, "broedplaats-plus": 3 };
                    const isUpgradeBP = broedplaatsTier && broedplaatsOrder[plan.plan] > (broedplaatsOrder[broedplaatsTier] || 0);
                    const isDowngradeBP = broedplaatsTier && broedplaatsOrder[plan.plan] < (broedplaatsOrder[broedplaatsTier] || 0);
                    const isButtonLoading = membershipLoading === plan.plan || upgradeLoading === plan.plan;

                    return (
                      <button key={plan.name.nl}
                        onClick={() => {
                          if (isCurrentBroedplaats) return;
                          // User already has a broedplaats tier — must go via upgrade/downgrade flow to avoid duplicate Stripe subscriptions
                          if (broedplaatsTier) {
                            if (hasStripeSubscription && (isUpgradeBP || isDowngradeBP)) {
                              handleUpgrade(plan.plan);
                            } else {
                              toast.error(lang === "nl"
                                ? "Je hebt al een broedplaats abonnement. Neem contact op om te wisselen."
                                : "You already have a broedplaats subscription. Contact us to switch.");
                            }
                          } else {
                            handleMembershipCheckout(plan.plan);
                          }
                        }}
                        disabled={isCurrentBroedplaats || !!membershipLoading || !!upgradeLoading}
                        className={`w-full flex items-center gap-4 rounded-2xl bg-card border p-4 text-left transition-all active:scale-[0.99] ${
                          isCurrentBroedplaats ? "border-success/50 bg-success/5" : "border-border hover:border-primary/30"
                        } ${(membershipLoading || upgradeLoading) && !isCurrentBroedplaats ? "opacity-60" : ""}`}
                      >
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isCurrentBroedplaats ? "bg-success/20" : "bg-primary/20"}`}>
                          {isButtonLoading ? <Loader2 size={22} className="animate-spin text-primary" /> : <plan.icon size={22} className={isCurrentBroedplaats ? "text-success" : "text-primary"} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold font-display text-base">{plan.name[localizedLang]}</h3>
                            {isCurrentBroedplaats && (
                              <span className="rounded-full bg-success/20 px-2 py-0.5 text-[9px] font-bold text-success">
                                {t("currentPlan")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{plan.desc[localizedLang]}</p>
                          <p className={`text-sm font-bold mt-1 ${isCurrentBroedplaats ? "text-success" : "text-primary"}`}>€{plan.price}/{t("perMonth")}</p>
                        </div>
                        {!isCurrentBroedplaats && <ChevronRight size={18} className="text-muted-foreground shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : step === 1 ? (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
              {studios.filter(s => s.id !== "content-room").map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStudio(s.id);
                    setTimeout(() => setStep(2), 200);
                  }}
                  className={`w-full rounded-xl border p-0 overflow-hidden text-left transition-all ${
                    selectedStudio === s.id ? "border-primary shadow-glow" : "border-border hover:border-primary/30"
                  } active:scale-[0.99]`}
                >
                  <img src={studioImages[s.id]} alt={t(s.nameKey as any)} className="h-36 w-full object-cover" loading="lazy" decoding="async" width={400} height={144} />
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold font-display text-lg">{t(s.nameKey as any)}</h3>
                      {selectedStudio === s.id && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-primary">
                          <Check size={14} className="text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t(s.descKey as any)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {isMember ? (
                        <span className="text-sm font-bold text-success">{t("free")}</span>
                      ) : (
                        <span className="text-sm font-bold text-primary">€{s.pricePerHour}/{t("perHr")}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>
          ) : step === 2 ? (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} aria-label={lang === "nl" ? "Vorige maand" : "Previous month"} className="p-2 rounded-lg bg-card border border-border">
                  <ChevronLeft size={16} />
                </button>
                <h3 className="font-semibold font-display capitalize">
                  {format(calendarMonth, "MMMM yyyy", { locale })}
                </h3>
                <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} aria-label={lang === "nl" ? "Volgende maand" : "Next month"} className="p-2 rounded-lg bg-card border border-border">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {(lang === "nl"
                  ? ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]
                  : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
                ).map((day) => (
                  <div key={day} className="py-2 text-xs font-semibold text-muted-foreground">{day}</div>
                ))}

                {calendarDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const isPast = isBefore(day, startOfDay(new Date()));
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayBooked = monthBookedMap[dayKey];
                  // Check if any start hour fits the selected duration without overlap
                  let hasAvail = true;
                  if (dayBooked && dayBooked.size > 0) {
                    hasAvail = false;
                    for (let h = 0; h <= 24 - selectedDuration; h++) {
                      let ok = true;
                      for (let k = 0; k < selectedDuration; k++) {
                        if (dayBooked.has(h + k)) { ok = false; break; }
                      }
                      if (ok) { hasAvail = true; break; }
                    }
                  }
                  const fullyBooked = !isPast && !hasAvail;
                  const partiallyBooked = !isPast && hasAvail && dayBooked && dayBooked.size > 0;
                  return (
                    <button
                      key={`day-${i}`}
                      disabled={isPast || fullyBooked}
                      onClick={() => {
                        setSelectedDate(day);
                        setTimeout(() => setStep(3), 300);
                      }}
                      className={`group relative flex flex-col items-center rounded-xl py-2.5 transition-all ${
                        isSelected ? "gradient-primary text-primary-foreground"
                          : isPast ? "text-muted-foreground/30 cursor-not-allowed"
                          : fullyBooked ? "bg-destructive/15 border border-destructive/50 text-destructive/70 cursor-not-allowed line-through"
                          : isToday ? "bg-secondary border border-primary/30"
                          : "bg-card border border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="text-sm font-bold">{format(day, "d")}</span>
                      {partiallyBooked && (
                        <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full transition-all group-hover:h-2 group-hover:w-2 ${isSelected ? "bg-primary-foreground/80" : "bg-warning"}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Calendar legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-warning" />
                  {lang === "nl" ? "Deels geboekt" : "Partially booked"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-destructive/20 border border-destructive/50" />
                  {lang === "nl" ? "Vol" : "Fully booked"}
                </div>
              </div>

            </motion.div>

          ) : step === 3 ? (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              {/* Duration stepper */}
              <div>
                <h3 className="font-semibold font-display text-sm mb-3">
                  {t("howManyHours")}
                </h3>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setSelectedDuration(Math.max(MIN_DURATION, selectedDuration - 1))}
                    disabled={selectedDuration <= MIN_DURATION}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-card border border-border hover:border-primary/30 disabled:opacity-30 transition-all"
                  >
                    <Minus size={20} />
                  </button>
                  <div className="text-center min-w-[80px]">
                    <span className="text-4xl font-bold font-display text-primary">{selectedDuration}</span>
                    <p className="text-xs text-muted-foreground mt-1">{t("hours")}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDuration(Math.min(maxDuration, selectedDuration + 1))}
                    disabled={selectedDuration >= maxDuration}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-card border border-border hover:border-primary/30 disabled:opacity-30 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                {!isMember && studio && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    {selectedDuration} × €{studio.pricePerHour} = <span className="font-bold text-primary">€{selectedDuration * studio.pricePerHour}</span>
                  </p>
                )}
                {isMember && tierLimits.maxHours < 999 && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {memberHoursUsed}/{tierLimits.maxHours} {t("hours")} {t("usedThisMonth")} · {t("hoursRemaining")}: <span className="font-semibold text-primary">{remainingMemberHours}h</span>
                  </p>
                )}
                {!isMember && creditHours > 0 && (
                  <div className="mt-3 rounded-lg bg-success/10 border border-success/20 p-3 text-center">
                    <p className="text-xs font-semibold text-success">
                      {creditHours} {t("freeHoursAvailable")}
                      {selectedDuration > creditHours && (
                        <span className="text-muted-foreground font-normal">
                          {" · "}{selectedDuration - creditHours}h × €{studio?.pricePerHour || 0} = <span className="text-primary font-semibold">€{(selectedDuration - creditHours) * (studio?.pricePerHour || 0)}</span>
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {isMember && !canBook && (
                  <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
                    <p className="text-xs font-semibold text-destructive">
                      {lang === "nl"
                        ? `Je hebt al ${tierLimits.maxBookings} actieve boeking${tierLimits.maxBookings > 1 ? "en" : ""}. Wacht tot je sessie voorbij is.`
                        : `You already have ${tierLimits.maxBookings} active booking${tierLimits.maxBookings > 1 ? "s" : ""}. Wait until your session is done.`}
                    </p>
                  </div>
                )}
                {isMember && remainingMemberHours < MIN_DURATION && tierLimits.maxHours < 999 && (
                  <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
                    <p className="text-xs font-semibold text-destructive">
                      {lang === "nl"
                        ? "Je hebt niet genoeg uren over deze maand om te boeken."
                        : "You don't have enough hours remaining this month to book."}
                    </p>
                  </div>
                )}
              </div>

              {/* Start time */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold font-display text-sm">
                    {t("startTime")}
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-card border border-border" />
                      {lang === "nl" ? "Vrij" : "Free"}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-destructive/20 border border-destructive/50" />
                      {lang === "nl" ? "Bezet" : "Booked"}
                    </div>
                  </div>
                </div>
                {bookedHours.size > 0 && (
                  <div className="mb-3 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-[11px] text-destructive font-medium text-center">
                    {lang === "nl"
                      ? "Tijden in rood zijn al geboekt en niet beschikbaar."
                      : "Times shown in red are already booked and unavailable."}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={slot.id}
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`relative flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-all ${
                          isSelected ? "gradient-primary text-primary-foreground shadow-glow"
                            : slot.available ? "bg-card border border-border hover:border-primary/30"
                            : slot.booked ? "bg-destructive/15 border border-destructive/50 text-destructive line-through cursor-not-allowed"
                            : "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                        }`}
                      >
                        <Clock size={12} />
                        {slot.time}
                      </button>
                    );
                  })}
                </div>

                {/* Waitlist: day fully booked → get a push the moment a slot frees up */}
                {user && selectedDate && timeSlots.length > 0 && timeSlots.every((s) => !s.available) && (
                  <button
                    disabled={waitlistJoined || waitlistJoining}
                    onClick={async () => {
                      if (!selectedStudio || waitlistJoined || waitlistJoining) return;
                      setWaitlistJoining(true);
                      const { error } = await supabase.from("booking_waitlist").insert({
                        user_id: user.id,
                        studio_id: selectedStudio,
                        booking_date: format(selectedDate, "yyyy-MM-dd"),
                      });
                      setWaitlistJoining(false);
                      if (error && !error.message.includes("duplicate")) {
                        toast.error(lang === "nl" ? "Er ging iets mis" : "Something went wrong");
                      } else {
                        setWaitlistJoined(true);
                        toast.success(lang === "nl"
                          ? "Je staat op de wachtlijst — je krijgt direct bericht als er een plek vrijkomt!"
                          : "You're on the waitlist — we'll notify you the moment a slot frees up!");
                      }
                    }}
                    className={`mt-3 w-full rounded-xl border py-3 text-sm font-semibold transition-all disabled:opacity-70 ${waitlistJoined ? "bg-success/10 border-success/30 text-success" : "bg-primary/10 border-primary/30 text-primary active:scale-[0.98]"}`}
                  >
                    {waitlistJoining
                      ? (lang === "nl" ? "Bezig…" : "Joining…")
                      : waitlistJoined
                      ? (lang === "nl" ? "✓ Op de wachtlijst" : "✓ On the waitlist")
                      : (lang === "nl" ? "🔔 Zet me op de wachtlijst voor deze dag" : "🔔 Join the waitlist for this day")}
                  </button>
                )}
                {/* Logged-out visitors hit a dead-end on a full day — offer login + waitlist */}
                {!user && selectedDate && timeSlots.length > 0 && timeSlots.every((s) => !s.available) && (
                  <button
                    onClick={() => { setAuthGateContext("booking"); setShowAuthGate(true); }}
                    className="mt-3 w-full rounded-xl border border-primary/30 bg-primary/10 py-3 text-sm font-semibold text-primary active:scale-[0.98] transition-all"
                  >
                    {lang === "nl" ? "🔔 Log in om je op de wachtlijst te zetten" : "🔔 Log in to join the waitlist"}
                  </button>
                )}
              </div>


              {/* Extras */}
              <div>
                <h3 className="font-semibold font-display text-sm mb-3">{t("addExtras")}</h3>
                <div className="space-y-2">
                  {extras.map((extra) => {
                    const isSelected = selectedExtras.includes(extra.id);
                    return (
                      <div key={extra.id} className="space-y-2">
                        <button
                          onClick={() => {
                            toggleExtra(extra.id);
                            if (extra.id === "photographer" && isSelected) {
                              setPhotographerDescription("");
                            }
                          }}
                          className={`flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-all ${
                            isSelected ? "border-primary shadow-glow" : "border-border hover:border-primary/30"
                          }`}
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSelected ? "gradient-primary" : "bg-secondary"}`}>
                            {extra.id === "photographer" ? (
                              <Camera size={18} className={isSelected ? "text-primary-foreground" : "text-secondary-foreground"} />
                            ) : (
                              <Sparkles size={18} className={isSelected ? "text-primary-foreground" : "text-secondary-foreground"} />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">{t(extra.labelKey as any)}</h3>
                            <p className="text-xs text-muted-foreground">{extra.price > 0 ? `€${extra.price}` : t("freeOnRequest")}</p>
                          </div>
                          {isSelected && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-primary">
                              <Check size={14} className="text-primary-foreground" />
                            </div>
                          )}
                        </button>
                        {extra.id === "photographer" && isSelected && (
                          <div className="ml-14 space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                              {t("photographerNeeds")}
                            </label>
                            <textarea
                              value={photographerDescription}
                              onChange={(e) => setPhotographerDescription(e.target.value)}
                              placeholder={t("photographerPlaceholder")}
                              className="flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Session summary + proceed to review */}
              {selectedTime && (
                <button
                  onClick={() => setStep(4)}
                  className="w-full rounded-xl bg-card border border-primary/30 p-4 text-left transition-all hover:border-primary active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("sessionLabel")}</p>
                      <p className="font-semibold">{selectedTime} - {getEndTime()}</p>
                      <p className="text-xs text-muted-foreground">{selectedDuration} {t("hours")}</p>
                    </div>
                    <div className="text-right">
                      {isMember && extrasPrice === 0 ? (
                        <p className="text-xl font-bold text-success">{t("free")}</p>
                      ) : (
                        <p className="text-xl font-bold text-primary">€{totalPrice}</p>
                      )}
                      <p className="text-xs text-primary font-medium mt-1">{t("continueLabel")}</p>
                    </div>
                  </div>
                </button>
              )}
            </motion.div>
          ) : step === 4 ? (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                {studio && (
                  <img src={studioImages[studio.id]} alt={t(studio.nameKey as any)} className="h-36 w-full object-cover" loading="lazy" decoding="async" width={400} height={144} />
                )}
                <div className="p-5 space-y-4">
                  <h3 className="text-xl font-bold font-display">{t("bookingDetails")}</h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin size={16} className="text-primary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("location")}</p>
                        <p className="font-medium">{studio ? t(studio.nameKey as any) : ""}</p>
                        <p className="text-xs text-muted-foreground">Spaceshuttle 6e, Amersfoort</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock size={16} className="text-primary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("date")} & {t("time")}</p>
                        <p className="font-medium">{selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale }) : ""}</p>
                        <p className="font-medium">{selectedTime} - {getEndTime()} ({selectedDuration} {t("hours")})</p>
                      </div>
                    </div>
                    {selectedExtras.length > 0 && (
                      <div className="flex items-start gap-3">
                        <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t("extras")}</p>
                          <p className="font-medium">
                            {selectedExtras.map((e) => {
                              const ex = extras.find((x) => x.id === e);
                              return ex ? `${t(ex.labelKey as any)}${ex.price > 0 ? ` (€${ex.price})` : ''}` : e;
                            }).join(", ")}
                          </p>
                          {selectedExtras.includes("photographer") && photographerDescription && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{photographerDescription}"</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    {!isMember && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{studio ? t(studio.nameKey as any) : ""} ({selectedDuration}h)</span>
                        <span>€{studioPrice}</span>
                      </div>
                    )}
                    {selectedExtras.map((eId) => {
                      const ex = extras.find((x) => x.id === eId);
                      if (!ex) return null;
                      return (
                        <div key={eId} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t(ex.labelKey as any)}</span>
                          <span>{ex.price > 0 ? `€${ex.price}` : t("onRequest")}</span>
                        </div>
                      );
                    })}
                    {offPeakDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-success">{t("offPeakDiscount")} ({studioPricing.offPeakHours}u)</span>
                        <span className="text-success">-€{offPeakDiscount}</span>
                      </div>
                    )}
                    {lastMinuteDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-success">⚡ {lang === "nl" ? "Last-minute korting" : "Last-minute deal"} ({lmPct}%)</span>
                        <span className="text-success">-€{lastMinuteDiscount}</span>
                      </div>
                    )}
                    {walletBalance > 0 && totalPrice > 0 && (
                      <button
                        onClick={() => setUseWallet(!useWallet)}
                        className="flex w-full items-center justify-between text-sm py-1"
                      >
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <div className={`flex h-5 w-5 items-center justify-center rounded ${useWallet ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"}`}>
                            {useWallet && <Check size={14} />}
                          </div>
                          {lang === "nl" ? `Tegoed gebruiken (€${walletBalance})` : `Use credit (€${walletBalance})`}
                        </span>
                        {walletApplied > 0 && <span className="text-success">-€{walletApplied}</span>}
                      </button>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="font-semibold">{t("total")}</span>
                      {isMember && extrasPrice === 0 ? (
                        <span className="text-2xl font-bold text-success">{t("free")}</span>
                      ) : (
                        <span className="text-2xl font-bold text-primary">€{dueNow}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* House Rules */}
              <div className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground mb-2">
                      {t("houseRules")}
                    </p>
                    <div className="text-[10px] text-muted-foreground leading-relaxed space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      <p>{lang === "nl"
                        ? "1. Behandel alle apparatuur met zorg. Schade door onzorgvuldig gebruik wordt doorberekend."
                        : "1. Handle all equipment with care. Damage due to careless use will be charged."}</p>
                      <p>{lang === "nl"
                        ? "2. Roken, alcohol en drugs zijn ten strengste verboden in de studio. Buiten roken mag alleen op de aangegeven plekken."
                        : "2. Smoking, alcohol and drugs are strictly prohibited in the studio. Outdoor smoking only in designated areas."}</p>
                      <p>{lang === "nl"
                        ? "3. Laat de ruimte schoon en opgeruimd achter na je sessie."
                        : "3. Leave the space clean and tidy after your session."}</p>
                      <p>{lang === "nl"
                        ? "4. Maximaal 6 personen in Studio 1, en maximaal 4 personen in de overige ruimtes, tenzij anders besproken."
                        : "4. Maximum 6 people in Studio 1, and maximum 4 people in other spaces, unless otherwise discussed."}</p>
                      <p>{lang === "nl"
                        ? "5. Eten en drinken niet bij de apparatuur."
                        : "5. Food and drinks not near the equipment."}</p>
                      <p>{lang === "nl"
                        ? "6. Ga met zorg om met het geluid van de speakers en houd rekening met andere sessies."
                        : "6. Handle speaker volume with care and be considerate of other sessions."}</p>
                      <p>{lang === "nl"
                        ? "7. Sluit alle lichten en apparatuur af aan het einde van de sessie."
                        : "7. Turn off all lights and equipment at the end of your session."}</p>
                      <p>{lang === "nl"
                        ? "8. De apparatuur hoort niet verplaatst te worden, tenzij anders besproken."
                        : "8. Equipment should not be moved unless otherwise discussed."}</p>
                      <p>{lang === "nl"
                        ? "9. Uprising Studio is niet aansprakelijk voor persoonlijke bezittingen."
                        : "9. Uprising Studio is not liable for personal belongings."}</p>
                      <p>{lang === "nl"
                        ? "10. Volg ten alle tijden de aanwijzingen van het personeel op."
                        : "10. Follow staff instructions at all times."}</p>
                    </div>
                    <button onClick={() => setRulesAccepted(!rulesAccepted)}
                      className="flex items-center gap-2 mt-3">
                      <div className={`flex h-5 w-5 items-center justify-center rounded ${rulesAccepted ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"}`}>
                        {rulesAccepted && <Check size={14} />}
                      </div>
                      <span className="text-xs font-medium">
                        {t("agreeHouseRules")}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pay button */}
              <button
                disabled={isLoading || !rulesAccepted || (isMember && !canBook) || (isMember && remainingMemberHours < selectedDuration && tierLimits.maxHours < 999)}
                onClick={handlePayment}
                className="w-full rounded-xl gradient-primary py-4 text-center font-bold text-primary-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-glow flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (isMember && extrasPrice === 0) || dueNow === 0 ? (
                  t("confirm")
                ) : (
                  `${t("pay")} — €${dueNow}`
                )}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BookingPage;
