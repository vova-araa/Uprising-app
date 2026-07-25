import appleMapsIcon from "@/assets/apple-maps-icon.png";
import { useI18n } from "@/lib/i18n";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { studios } from "@/lib/data";
import {
  Calendar, Clock, User, Navigation, Timer, LogOut, Globe, ChevronRight,
  Layers, Music, Mic, TrendingUp, FileAudio, Loader2, LayoutDashboard,
  Gift, Copy, Users, Check, Crown, CreditCard, XCircle, ExternalLink, Camera, BookOpen, AlertTriangle, Upload, Bell,
  Trash2, Pencil, Info, Star, Video, Sparkles, CalendarPlus, DoorOpen, MapPin
} from "lucide-react";
import { downloadBookingICS } from "@/lib/calendar";
import NukiAccessButton from "@/components/NukiAccessButton";
import AccountAccessSection from "@/components/AccountAccessSection";
import BookingCancelDialog from "@/components/BookingCancelDialog";
import FaultReportDialog from "@/components/FaultReportDialog";
import SubmissionUploadDialog from "@/components/SubmissionUploadDialog";
import ProjectFileUploadDialog from "@/components/ProjectFileUploadDialog";
import ReviewDialog from "@/components/ReviewDialog";
import GiftCardSection from "@/components/GiftCardSection";
import BookingModifyDialog from "@/components/BookingModifyDialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format, differenceInDays, startOfMonth, endOfMonth, isBefore } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { inlineToast as toast } from "@/components/InlineToast";
import { supabase } from "@/integrations/supabase/client";
import { useWebPush } from "@/hooks/useWebPush";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const STUDIO_LAT = 52.1950;
const STUDIO_LNG = 5.4250;

const openAppleMaps = () => {
  window.location.href = `maps://maps.apple.com/?daddr=${STUDIO_LAT},${STUDIO_LNG}&dirflg=d`;
};
const openGoogleMaps = () => {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${STUDIO_LAT},${STUDIO_LNG}`, "_blank");
};

const studioNameMap: Record<string, { nl: string; en: string }> = {
  "studio-1": { nl: "Studio 1", en: "Studio 1" },
  "studio-2": { nl: "Studio 2", en: "Studio 2" },
  "content-room": { nl: "Content Room", en: "Content Room" },
};

const statusSteps = ["received", "mixing", "mastering", "review", "completed"];

const tierConfig: Record<string, { name: string; color: string; bg: string; icon: any }> = {
  basic: { name: "Basic", color: "text-primary", bg: "bg-primary/20", icon: Crown },
  pro: { name: "Pro", color: "text-primary", bg: "bg-primary/20", icon: Crown },
  unlimited: { name: "Unlimited", color: "text-primary", bg: "bg-primary/20", icon: Crown },
  ambassadeur: { name: "Ambassadeur", color: "text-primary", bg: "bg-primary/20", icon: Crown },
};

const AccountPage = () => {
  const { t, lang, setLang } = useI18n();
  const { membershipTiers } = useAppConfig();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const locale = lang === "nl" ? nl : enUS;
  const localizedLang = lang === "nl" ? "nl" : "en";

  const [now, setNow] = useState(new Date());
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"dashboard" | "access" | "projects" | "bookings" | "producer" | "settings">(
    tabParam === "access" || tabParam === "projects" || tabParam === "bookings" || tabParam === "producer" || tabParam === "settings" ? tabParam : "dashboard"
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [walletTxns, setWalletTxns] = useState<{ id: string; amount: number; type: string; note: string | null; expires_at: string | null; created_at: string }[]>([]);
  const [freeHours, setFreeHours] = useState({ studio1: 0, studio2: 0, content: 0 });
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [producerBookings, setProducerBookings] = useState<any[]>([]);
  const [producerLoading, setProducerLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string>("");
  const [showMapDialog, setShowMapDialog] = useState(false);

  const [dbBookings, setDbBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [realStats, setRealStats] = useState({ totalHours: 0, sessionsThisMonth: 0, activeBookings: 0, totalSessions: 0, activeProjects: 0, mixMasterProjects: 0 });
  const [referrals, setReferrals] = useState<any[]>([]);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

  const [subscription, setSubscription] = useState<{
    subscribed: boolean;
    plan?: string;
    product_id?: string;
    price_id?: string;
    subscription_start?: string;
    subscription_end?: string;
    interval?: string;
    all_plans?: Array<{ plan: string; subscription_start: string; subscription_end: string; interval: string }>;
    has_broedplaats?: boolean;
    broedplaats_plan?: string;
  } | null>(null);
  const [profileMembership, setProfileMembership] = useState<string | null>(null);
  const [profileBroedplaats, setProfileBroedplaats] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [subError, setSubError] = useState(false);
  
  const [portalLoading, setPortalLoading] = useState(false);
  const [broedplaatsRsvp, setBroedplaatsRsvp] = useState<Record<string, { attending: boolean; activity: string | null }>>({
    day1: { attending: false, activity: null },
    day2: { attending: false, activity: null },
  });
  const [confirmedDays, setConfirmedDays] = useState<Record<string, boolean>>({});
  const [cancelReason, setCancelReason] = useState("");
  const [cancelStep, setCancelStep] = useState<"idle" | "form" | "confirm">("idle");
  const [adminCancelStep, setAdminCancelStep] = useState<"idle" | "form" | "confirm">("idle");
  const [adminCancelReason, setAdminCancelReason] = useState("");
  const [bpCancelStep, setBpCancelStep] = useState<"idle" | "form" | "confirm">("idle");
  const [bpCancelReason, setBpCancelReason] = useState("");
  const [workshopRsvp, setWorkshopRsvp] = useState(false);
  const [workshopConfirmed, setWorkshopConfirmed] = useState(false);
  const [showUnregisterDialog, setShowUnregisterDialog] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [workshopConfig, setWorkshopConfig] = useState<{ title?: string; description?: string; date?: string; learning_module?: string; start_time?: string; end_time?: string } | null>(null);
  const [weeklyDaysConfig, setWeeklyDaysConfig] = useState<any>(null);
  const [cancelDialogBooking, setCancelDialogBooking] = useState<any>(null);
  const [faultDialogBooking, setFaultDialogBooking] = useState<any>(null);
  const [bookingsFilter, setBookingsFilter] = useState<"upcoming" | "past">("upcoming");
  const [showAllPast, setShowAllPast] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [submissionDialog, setSubmissionDialog] = useState<{ booking: any; kind: "session_video" | "clean_room_photo" } | null>(null);
  const [projectUploadTarget, setProjectUploadTarget] = useState<any | null>(null);
  const [reviewDialogBooking, setReviewDialogBooking] = useState<any | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [pointsBalance, setPointsBalance] = useState(0);
  const [rewardsCatalog, setRewardsCatalog] = useState<{ id: string; points: number; label: string }[]>([]);
  const [redeemingReward, setRedeemingReward] = useState<string | null>(null);
  const [modifyDialogBooking, setModifyDialogBooking] = useState<any>(null);
  const defaultNotifPrefs = { push: true, email: true, bookingReminders: true, promotions: false };
  const [notifPrefs, setNotifPrefs] = useState(defaultNotifPrefs);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      checkSubscription();
      loadCreditBalance();
      loadBookings();
      loadStats();
      loadReferrals();
      loadAvatar();
      loadBroedplaatsRsvp();
      loadWorkshopConfig();
      loadWeeklyDaysConfig();
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
        if (data) setIsAdmin(true);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('account-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadBookings();
        loadStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Auto-refresh workshop data and subscription status every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadWorkshopConfig();
      loadBroedplaatsRsvp();
      checkSubscription();
    }, 60_000);
    return () => clearInterval(interval);
  }, [user]);


  useEffect(() => {
    if (!user || searchParams.get("payment") !== "success") return;
    const autoConfirm = async () => {
      const paymentType = searchParams.get("type");
      const sessionId = searchParams.get("session_id");

      if (sessionId) {
        // Verify payment with Stripe before confirming anything
        try {
          const { data: verifyResult, error } = await supabase.functions.invoke("verify-payment", {
            body: { session_id: sessionId, type: paymentType },
          });

          if (error || !verifyResult?.verified) {
            console.error("Payment verification failed:", error || verifyResult?.error);
            toast.error(t("paymentNotVerified"));
            navigate("/account", { replace: true });
            return;
          }

          // Success messages based on type
          if (verifyResult.type === "membership") {
            toast.success(lang === "nl" ? "Membership geactiveerd! 🎉" : "Membership activated! 🎉");
            // Re-check subscription to update UI immediately
            await checkSubscription();
          } else if (verifyResult.type === "mix-master") {
            toast.success(t("paymentReceivedProject"));
          } else if (verifyResult.type === "producer-session") {
            toast.success(t("paymentReceivedReview"));
          } else if (verifyResult.type === "gift-card") {
            toast.success(lang === "nl" ? "Cadeaubon aangemaakt! 🎁" : "Gift card created! 🎁");
          } else {
            toast.success(t("bookingConfirmed"));
            // Auto-provision Nuki access for studio bookings
            if (verifyResult.booking_id) {
              try {
                await supabase.functions.invoke("nuki-integration?action=auto-provision", {
                  body: { booking_id: verifyResult.booking_id },
                });
              } catch (e) {
                console.log("Nuki auto-provision skipped:", e);
              }
            }
          }
          loadBookings();
        } catch (err) {
          console.error("Verify payment error:", err);
          toast.error(t("paymentNotVerified"));
        }
      } else {
        // No session_id — a member's free booking (already confirmed by the backend).
        // Only confirm one that was *just* created, so we never falsely mark an older,
        // unrelated pending booking as confirmed.
        const { data: pendingBookings, error: pendingErr } = await supabase
          .from("bookings")
          .select("id, studio_id, status, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1);
        if (!pendingErr && pendingBookings && pendingBookings.length > 0) {
          const created = new Date(pendingBookings[0].created_at).getTime();
          const isRecent = Number.isFinite(created) && Date.now() - created < 5 * 60_000;
          if (isRecent) {
            toast.success(t("bookingConfirmed"));
            loadBookings();
          }
        }
      }
      navigate("/account", { replace: true });
    };
    autoConfirm();
  }, [user, searchParams]);

  const loadCreditBalance = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("credit_balance, referral_code, studio1_hours, studio2_hours, content_hours, notification_prefs, whatsapp_opt_in").eq("id", user.id).single();
    const { data: txns } = await supabase
      .from("wallet_transactions")
      .select("id, amount, type, note, expires_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setWalletTxns(txns || []);
    const { data: pointsProfile } = await supabase
      .from("profiles").select("points_balance").eq("id", user.id).single();
    setPointsBalance((pointsProfile as any)?.points_balance || 0);
    supabase.functions.invoke("redeem-points", { body: {} }).then(({ data: shop }) => {
      if (shop?.catalog) setRewardsCatalog(shop.catalog);
      if (typeof shop?.points_balance === "number") setPointsBalance(shop.points_balance);
    });
    if (data) {
      setCreditBalance(data.credit_balance || 0);
      setFreeHours({
        studio1: data.studio1_hours || 0,
        studio2: data.studio2_hours || 0,
        content: data.content_hours || 0,
      });
      if (data.notification_prefs) {
        setNotifPrefs({ ...defaultNotifPrefs, ...(data.notification_prefs as any) });
      }
      setWhatsappOptIn((data as any).whatsapp_opt_in === true);
      if (data.referral_code) {
        setReferralCode(data.referral_code);
      } else {
        const code = "UPRISING-" + Math.random().toString(36).substring(2, 6).toUpperCase();
        await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
        setReferralCode(code);
      }
    }
  };

  const loadBookings = async () => {
    if (!user) return;
    setBookingsLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: true });
    // On a read error, keep whatever bookings we already have on screen instead of
    // wiping the list to an empty "no bookings" state (which would hide a real
    // booking the user still needs to cancel/modify). Realtime re-runs this on every
    // change, so a single transient failure must not blank the UI.
    if (error) {
      console.error("loadBookings failed", error);
      setBookingsLoading(false);
      return;
    }
    setDbBookings(data || []);
    setBookingsLoading(false);
    // Which of these bookings the user already reviewed (to relabel the button).
    const { data: fb } = await supabase.from("booking_feedback").select("booking_id");
    if (fb) setReviewedBookingIds(new Set(fb.map((f: any) => f.booking_id)));
  };

  const loadStats = async () => {
    if (!user) return;
    const { data: allBookings, error: bookingsErr } = await supabase.from("bookings").select("booking_date, duration_hours, status");
    const { data: allProjects, error: projectsErr } = await supabase.from("projects").select("status");
    // Don't zero out an active user's stat tiles on a transient read error.
    if (bookingsErr || projectsErr) {
      console.error("loadStats failed", bookingsErr || projectsErr);
      return;
    }

    // Exclude cancelled bookings from all aggregates so cancelled sessions
    // don't inflate the stat tiles.
    const bookings = (allBookings || []).filter(b => b.status !== "cancelled");
    const projs = allProjects || [];
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    const totalHours = bookings.reduce((sum, b) => sum + (b.duration_hours || 0), 0);
    const sessionsThisMonth = bookings.filter(b => b.booking_date >= monthStart && b.booking_date <= monthEnd).length;
    const activeBookings = bookings.filter(b => b.booking_date >= todayStr && b.status === "confirmed").length;
    const activeProjects = projs.filter(p => p.status !== "completed").length;
    const mixMasterProjects = projs.length;

    setRealStats({
      totalHours,
      sessionsThisMonth,
      activeBookings,
      totalSessions: bookings.length,
      activeProjects,
      mixMasterProjects,
    });
  };

  const loadReferrals = async () => {
    if (!user) return;
    const { data } = await supabase.from("referrals").select("*");
    setReferrals(data || []);
  };

  const loadBroedplaatsRsvp = async () => {
    if (!user) return;
    const { data } = await supabase.from("broedplaats_rsvp").select("*").eq("user_id", user.id);
    if (!data || data.length === 0) return;

    const now = new Date();

    // Calculate start of current week (Monday)
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    // Find the most recent past workshop to check if workshop RSVP is stale
    const todayStr = now.toISOString().split("T")[0];
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    let lastEndedWorkshopDate: Date | null = null;
    try {
      const { data: pastWorkshops } = await (supabase.from as any)("broedplaats_workshops")
        .select("workshop_date, end_time")
        .lte("workshop_date", todayStr)
        .order("workshop_date", { ascending: false })
        .limit(5);
      if (pastWorkshops) {
        const ended = pastWorkshops.find((w: any) => {
          if (w.workshop_date < todayStr) return true;
          return (w.end_time || "23:59") <= currentTime;
        });
        if (ended) {
          const [h, m] = (ended.end_time || "23:59").split(":").map(Number);
          lastEndedWorkshopDate = new Date(ended.workshop_date + "T00:00:00");
          lastEndedWorkshopDate.setHours(h, m, 0, 0);
        }
      }
    } catch {}

    const rsvpState: Record<string, { attending: boolean; activity: string | null }> = {
      day1: { attending: false, activity: null },
      day2: { attending: false, activity: null },
    };
    const confirmedState: Record<string, boolean> = {};
    let wsRsvp = false;
    let wsConfirmed = false;

    for (const row of data) {
      const updatedAt = new Date(row.updated_at);

      if (row.slot_type === "workshop") {
        // If RSVP was made before the last ended workshop, it's stale → auto-delete
        if (lastEndedWorkshopDate && updatedAt < lastEndedWorkshopDate) {
          await supabase.from("broedplaats_rsvp").delete().eq("id", row.id);
          continue;
        }
        wsRsvp = true;
        wsConfirmed = row.confirmed;
      } else {
        // Weekly days: if RSVP was updated before start of this week, it's stale → auto-delete
        if (updatedAt < weekStart) {
          await supabase.from("broedplaats_rsvp").delete().eq("id", row.id);
          continue;
        }
        rsvpState[row.slot_type] = { attending: true, activity: row.activity };
        confirmedState[row.slot_type] = row.confirmed;
      }
    }

    setBroedplaatsRsvp(rsvpState);
    setConfirmedDays(confirmedState);
    setWorkshopRsvp(wsRsvp);
    setWorkshopConfirmed(wsConfirmed);
  };

  const saveBroedplaatsRsvp = async (slotType: string, activity: string | null, confirmed: boolean): Promise<boolean> => {
    if (!user) return false;
    const { data: existing } = await supabase.from("broedplaats_rsvp").select("id").eq("user_id", user.id).eq("slot_type", slotType).maybeSingle();
    const { error } = existing
      ? await supabase.from("broedplaats_rsvp").update({ activity, confirmed, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await supabase.from("broedplaats_rsvp").insert({ user_id: user.id, slot_type: slotType, activity, confirmed });
    if (error) { console.error("[saveBroedplaatsRsvp]", error); return false; }
    return true;
  };

  const deleteBroedplaatsRsvp = async (slotType: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from("broedplaats_rsvp").delete().eq("user_id", user.id).eq("slot_type", slotType);
    if (error) { console.error("[deleteBroedplaatsRsvp]", error); return false; }
    return true;
  };

  const loadWorkshopConfig = async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      // Get upcoming workshops (future dates, or today if end_time hasn't passed)
      const { data: workshops } = await (supabase.from as any)("broedplaats_workshops")
        .select("*")
        .gte("workshop_date", todayStr)
        .order("workshop_date", { ascending: true })
        .limit(5);

      if (workshops && workshops.length > 0) {
        // Find first workshop that hasn't ended yet
        const next = workshops.find((w: any) => {
          if (w.workshop_date > todayStr) return true;
          // Same day: only show if end_time hasn't passed
          return (w.end_time || "23:59") > currentTime;
        });

        if (next) {
          setWorkshopConfig({
            title: next.title,
            description: next.description,
            date: next.workshop_date,
            learning_module: next.learning_module,
            start_time: next.start_time,
            end_time: next.end_time,
          });
        } else {
          setWorkshopConfig(null);
        }
      }
    } catch {}
  };
  const loadWeeklyDaysConfig = async () => {
    try {
      const { data } = await (supabase.from as any)("broedplaats_config")
        .select("config_value")
        .eq("config_key", "weekly_days")
        .maybeSingle();
      if (data) setWeeklyDaysConfig(data.config_value);
    } catch {}
  };


  const loadAvatar = async () => {
    if (!user) return;
    const { data } = await supabase.storage.from("avatars").list(`${user.id}`, { limit: 1, sortBy: { column: "created_at", order: "desc" } });
    if (data && data.length > 0) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(`${user.id}/${data[0].name}`);
      setAvatarUrl(urlData.publicUrl);
    }
  };

  const handleAvatarUpload = async () => {
    if (!user) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploadingAvatar(true);
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) {
        console.error("Avatar upload error:", error);
        toast.error(t("uploadFailed"));
        await supabase.from("error_logs").insert({
          error_message: `Avatar upload failed: ${error.message}`,
          page_url: window.location.href,
          user_id: user.id,
          user_agent: navigator.userAgent,
        });
      } else {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        setAvatarUrl(urlData.publicUrl + "?t=" + Date.now());
        toast.success(t("profilePhotoUpdated"));
      }
      setUploadingAvatar(false);
    };
    input.click();
  };

  const checkSubscription = async () => {
    setSubLoading(true);
    setSubError(false);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      if (data) setSubscription(data);
      // Also check profile for admin-assigned membership/broedplaats
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("membership, broedplaats").eq("id", user.id).single();
        if (profile) {
          setProfileMembership(profile.membership);
          setProfileBroedplaats(profile.broedplaats);
        }
      }
    } catch (err) {
      console.error("Failed to check subscription:", err);
      setSubError(true);
    } finally {
      setSubLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (!error && data?.url) {
        // iOS-safe: same-window navigation (window.open is blocked after await on iOS)
        const { redirectToExternal } = await import("@/lib/redirect");
        redirectToExternal(data.url);
      } else {
        toast.error(t("couldNotOpenPortal"));
      }
    } catch (err) {
      toast.error(t("somethingWentWrong"));
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelAdminMembership = async () => {
    if (!user) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-admin-membership", {
        body: { reason: adminCancelReason },
      });
      if (error) throw error;
      setProfileMembership(null);
      setAdminCancelStep("idle");
      toast.success(t("subscriptionCancelled"));
      checkSubscription();
    } catch (err) {
      toast.error(t("somethingWentWrong"));
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelBroedplaats = async () => {
    if (!user) return;
    setPortalLoading(true);
    try {
      const bpPlan = subscription?.all_plans?.find(p => p.plan.startsWith("broedplaats"));
      if (bpPlan) {
        // Stripe-based: open portal
        await handleManageSubscription();
      } else {
        // Admin-assigned: use edge function
        const { error } = await supabase.functions.invoke("cancel-admin-membership", {
          body: { reason: bpCancelReason, type: "broedplaats" },
        });
        if (error) throw error;
        setProfileBroedplaats(null);
        toast.success(t("subscriptionCancelled"));
        checkSubscription();
      }
      setBpCancelStep("idle");
    } catch (err) {
      toast.error(t("somethingWentWrong"));
    } finally {
      setPortalLoading(false);
    }
  };

  const reloadProjects = async () => {
    setProjectsLoading(true);
    const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (!error && data) setProjects(data);
    setProjectsLoading(false);
  };

  useEffect(() => {
    if ((activeTab === "projects" || activeTab === "dashboard") && user) {
      reloadProjects();
    }
    if (activeTab === "producer" && user) {
      setProducerLoading(true);
      supabase.from("producer_bookings").select("*").order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setProducerBookings(data);
          setProducerLoading(false);
        });
    }
  }, [activeTab, user]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcomingBookings = dbBookings.filter(b => b.booking_date >= todayStr && b.status !== "cancelled");
  const pastBookings = dbBookings.filter(b => b.booking_date < todayStr || b.status === "cancelled");
  const nextBooking = upcomingBookings.length > 0 ? upcomingBookings[0] : null;

  const getCountdown = () => {
    if (!nextBooking) return null;
    const sessionDate = new Date(`${nextBooking.booking_date}T${nextBooking.start_time}:00`);
    const diffMs = sessionDate.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    return { days, hours, minutes, seconds };
  };

  const countdown = getCountdown();

  const handleSignOut = async () => {
    await signOut();
    toast.success(t("signOut"));
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success(t("codeCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiëren mislukt — selecteer en kopieer de code handmatig.");
    }
  };

  const activeReferrals = referrals.filter(r => r.status === "completed");
  const totalDiscount = activeReferrals.length * 50;

  const getSubTier = () => {
    if (subscription?.subscribed && subscription.plan) {
      // Use actual plan from Stripe
      if (tierConfig[subscription.plan]) return subscription.plan;
      return "basic"; // fallback
    }
    // Fallback: admin-assigned membership from profile
    if (profileMembership && tierConfig[profileMembership]) return profileMembership;
    return null;
  };

  const subTier = getSubTier();
  const tierInfo = subTier ? tierConfig[subTier] : null;

  const getStudioName = (studioId: string) => {
    return studioNameMap[studioId]?.[localizedLang] || studioId;
  };

  const tabs = [
    { id: "dashboard" as const, label: t("dashboard"), icon: LayoutDashboard },
    { id: "projects" as const, label: t("projects"), icon: Music },
    { id: "producer" as const, label: "Producer", icon: Mic },
    { id: "bookings" as const, label: t("bookingsTab"), icon: Calendar },
    { id: "access" as const, label: t("access"), icon: Navigation },
    { id: "settings" as const, label: t("settings"), icon: Layers },
  ];

  const webPush = useWebPush();

  const saveNotifPrefs = async (updated: typeof notifPrefs) => {
    const previous = notifPrefs;
    setNotifPrefs(updated);
    if (user) {
      const { error } = await supabase.from("profiles").update({ notification_prefs: updated } as any).eq("id", user.id);
      if (error) {
        setNotifPrefs(previous);
        toast.error("Voorkeur opslaan mislukt — probeer opnieuw.");
        return;
      }
    }
    // Sync web push subscription when push toggle changes in browser
    if (webPush.supported && webPush.configured) {
      if (updated.push && !webPush.subscribed) {
        const ok = await webPush.subscribe();
        if (!ok && Notification.permission === "denied") {
          toast.error("Sta meldingen toe in je browserinstellingen");
        }
      } else if (!updated.push && webPush.subscribed) {
        await webPush.unsubscribe();
      }
    }
    toast.success(t("notificationPrefsSaved"));
  };

  return (
    <div className="min-h-full">
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-2xl font-bold font-display">{t("dashboard")}</h1>
      </div>

      {/* Profile Card */}
      <div className="px-5 mt-2">
        <div className="rounded-2xl card-feature border border-white/5 p-4 flex items-center gap-4" data-toast-section>
          <button onClick={handleAvatarUpload} className="relative shrink-0" disabled={uploadingAvatar}>
            <Avatar className="h-14 w-14">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt="Profile" />
              ) : null}
              <AvatarFallback className="gradient-primary">
                <User size={24} className="text-primary-foreground" />
              </AvatarFallback>
            </Avatar>
            {!avatarUrl && (
              <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary border-2 border-card">
                {uploadingAvatar ? <Loader2 size={10} className="animate-spin text-primary-foreground" /> : <Camera size={10} className="text-primary-foreground" />}
              </div>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold font-display truncate">
              {user?.user_metadata?.full_name || t("welcome")}
            </h2>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-5 mt-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id ? "btn-glow text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-5 mt-4 pb-28">
        {/* ===== DASHBOARD TAB ===== */}
        {activeTab === "dashboard" && (
          <>
            {/* Direct toegang — volgende sessie + deur openen, bovenaan het dashboard */}
            <motion.div variants={item}>
              {nextBooking ? (
                <div className="card-feature rounded-2xl border border-white/5 p-4" data-toast-section>
                  <div className="flex items-center gap-3">
                    <div className="icon-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                      <DoorOpen size={22} className="text-white" strokeWidth={2.1} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                        {lang === "nl" ? "Volgende sessie" : "Next session"}
                      </p>
                      <p className="text-base font-bold font-display leading-tight truncate">{getStudioName(nextBooking.studio_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(nextBooking.booking_date), "EEE d MMM", { locale })} • {nextBooking.start_time} • {nextBooking.duration_hours}u
                      </p>
                    </div>
                    <button onClick={() => setActiveTab("bookings")} aria-label={t("bookingsTab")}
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/70 text-muted-foreground active:scale-95">
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-muted-foreground">
                    <MapPin size={12} className="text-primary" /> Spaceshuttle 6e, Amersfoort
                  </div>

                  {/* Deurtoegang inline — toont de ontgrendelknoppen zodra de sessie actief is */}
                  <NukiAccessButton
                    bookingId={nextBooking.id}
                    bookingDate={nextBooking.booking_date}
                    startTime={nextBooking.start_time}
                    durationHours={nextBooking.duration_hours}
                    status={nextBooking.status}
                  />

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => downloadBookingICS(nextBooking, `${getStudioName(nextBooking.studio_id)} — Uprising Studio`, "Je sessie bij Uprising Studio. Adres: Spaceshuttle 6e, Amersfoort.")}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-secondary/70 py-2.5 text-xs font-semibold text-foreground active:scale-[0.98]">
                      <CalendarPlus size={13} /> {t("addToCalendarBtn")}
                    </button>
                    <button
                      onClick={() => navigate("/spaces")}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-secondary/70 py-2.5 text-xs font-semibold text-foreground active:scale-[0.98]">
                      <Navigation size={13} /> {lang === "nl" ? "Route" : "Directions"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => navigate("/book")}
                  className="card-feature w-full rounded-2xl border border-white/5 p-4 text-left flex items-center gap-3 active:scale-[0.99]">
                  <div className="icon-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                    <CalendarPlus size={22} className="text-white" strokeWidth={2.1} />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold font-display leading-tight">{lang === "nl" ? "Boek je volgende sessie" : "Book your next session"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "nl" ? "Studio, contentruimte of producer — 24/7" : "Studio, content room or producer — 24/7"}</p>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                </button>
              )}
            </motion.div>

            {/* Blocked projects alert */}
            {projects.filter((p: any) => p.staff_notes).map((project: any) => (
              <motion.div key={`blocked-${project.id}`} variants={item} className="rounded-xl bg-warning/10 border border-warning/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-warning" />
                  <h3 className="text-sm font-semibold text-warning">Gepauzeerd — {project.title}</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-1">
                  Dit project is gepauzeerd totdat je de gevraagde bestanden hebt geüpload.
                </p>
                <p className="text-xs text-foreground mb-3">{project.staff_notes}</p>
                <button
                  onClick={() => setProjectUploadTarget(project)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg gradient-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-glow"
                >
                  <Upload size={13} /> Upload bestanden
                </button>
              </motion.div>
            ))}

            {/* Studio Subscription Management */}
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-5" data-toast-section>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-primary" />
                <h3 className="font-semibold font-display text-sm">
                  {t("studioSubscription")}
                </h3>
              </div>

              {subLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              ) : tierInfo ? (
                <div className="space-y-4">
                  {/* Plan info with dates */}
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tierInfo.bg}`}>
                      <tierInfo.icon size={22} className={tierInfo.color} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold font-display text-base">{tierInfo.name}</p>
                      {!subscription?.subscribed && profileMembership ? (
                        <p className="text-xs text-muted-foreground">
                          {t("assignedByAdmin")}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Dates grid */}
                  {subscription?.subscribed ? (
                    <div className="grid grid-cols-2 gap-3">
                        {subscription.subscription_start && (
                          <div className="rounded-lg bg-secondary/50 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                              {t("firstPayment")}
                            </p>
                            <p className="text-sm font-semibold">
                              {format(new Date(subscription.subscription_start), "d MMM yyyy", { locale })}
                            </p>
                          </div>
                        )}
                        {subscription.subscription_end && (
                          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                              {t("nextRenewal")}
                            </p>
                            <p className="text-sm font-semibold text-primary">
                              {format(new Date(subscription.subscription_end), "d MMM yyyy", { locale })}
                            </p>
                          </div>
                        )}
                    </div>
                  ) : profileMembership ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                          {t("startDate")}
                        </p>
                        <p className="text-sm font-semibold">
                          {t("assigned")}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                          {t("endDate")}
                        </p>
                        <p className="text-sm font-semibold">—</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Benefits & Usage */}
                  {(() => {
                    const currentTier = membershipTiers.find(mt => mt.id === subTier);
                    if (!currentTier) return null;
                    const totalActiveBookings = realStats.activeBookings;
                    const usedHoursS1 = freeHours.studio1;
                    const usedHoursS2 = freeHours.studio2;
                    const usedHoursContent = freeHours.content;
                    const maxHours = currentTier.maxHours;
                    const maxBookings = currentTier.maxBookings;
                    const discountPct = Math.round(currentTier.discount * 100);
                    const intervalLabel = subscription?.interval === "year"
                      ? (t("yearlyInterval"))
                      : (t("monthlyInterval"));
                    const price = subscription?.interval === "year" ? currentTier.priceYearly : currentTier.priceMonthly;

                    return (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {t("yourBenefits")}
                        </p>
                        <div className="rounded-lg bg-secondary/30 border border-border p-3 space-y-2.5">
                          {price != null && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{t("price")}</span>
                              <span className="font-semibold">€{price}/{intervalLabel}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t("maxHoursMonth")}</span>
                            <span className="font-semibold">{maxHours >= 999 ? "∞" : maxHours}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t("activeBookings")}</span>
                            <span className="font-semibold">{maxBookings >= 999 ? "∞" : maxBookings}</span>
                          </div>
                          {discountPct > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{t("serviceDiscount")}</span>
                              <span className="font-semibold text-primary">{discountPct}%</span>
                            </div>
                          )}
                        </div>

                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-3">
                          {t("usageThisMonth")}
                        </p>
                        <div className="rounded-lg bg-secondary/30 border border-border p-3 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t("activeBookings")}</span>
                            <span className="font-semibold">{totalActiveBookings} / {maxBookings >= 999 ? "∞" : maxBookings}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Studio 1 {t("hours")}</span>
                            <span className="font-semibold">{usedHoursS1}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Studio 2 {t("hours")}</span>
                            <span className="font-semibold">{usedHoursS2}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Content Room {t("hours")}</span>
                            <span className="font-semibold">{usedHoursContent}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {subscription?.subscribed ? (
                     cancelStep === "idle" ? (
                      subscription?.interval === "year" ? (
                        <div className="space-y-2">
                          <button onClick={handleManageSubscription} disabled={portalLoading}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-medium transition-all hover:bg-secondary/80 active:scale-[0.98]">
                            {portalLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                            {t("manageSubscription")}
                          </button>
                          <p className="text-[11px] text-muted-foreground text-center">
                            {lang === "nl"
                              ? `Jaarlijks abonnement — opzegbaar na ${subscription.subscription_end ? format(new Date(subscription.subscription_end), "d MMMM yyyy", { locale }) : "—"}`
                              : `Yearly subscription — cancellable after ${subscription.subscription_end ? format(new Date(subscription.subscription_end), "d MMMM yyyy", { locale }) : "—"}`}
                          </p>
                        </div>
                      ) : (
                      <div className="space-y-2">
                        <button onClick={handleManageSubscription} disabled={portalLoading}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-medium transition-all hover:bg-secondary/80 active:scale-[0.98]">
                          {portalLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                          {t("manageSubscription")}
                        </button>
                        <button onClick={() => { setCancelStep("form"); setCancelReason(""); }}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/5 active:scale-[0.98]">
                          <XCircle size={16} />
                          {t("cancelSubscription")}
                        </button>
                      </div>
                      )
                    ) : cancelStep === "form" ? (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-3">
                        <p className="text-sm font-semibold text-destructive">
                          {t("whyCancelQuestion")}
                        </p>
                        <div className="space-y-2">
                          {(lang === "nl"
                            ? ["Te duur", "Gebruik het niet genoeg", "Overgestapt naar ander", "Andere reden"]
                            : ["Too expensive", "Not using it enough", "Switched to another", "Other reason"]
                          ).map((reason) => (
                            <button key={reason} onClick={() => setCancelReason(reason)}
                              className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all border ${
                                cancelReason === reason
                                  ? "border-destructive/50 bg-destructive/10 text-destructive font-medium"
                                  : "border-border bg-card hover:bg-secondary/50"
                              }`}>
                              {reason}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setCancelStep("idle")}
                            className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">
                            {t("back")}
                          </button>
                          <button onClick={() => setCancelStep("confirm")} disabled={!cancelReason}
                            className="flex-1 rounded-xl bg-destructive/80 px-4 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-40">
                            {t("next")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-3">
                        <p className="text-sm font-semibold text-destructive">
                          {t("areYouSure")}
                        </p>
                        <div className="rounded-lg bg-card border border-border p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <Calendar size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {lang === "nl"
                                ? `Je abonnement stopt op ${subscription.subscription_end ? format(new Date(subscription.subscription_end), "d MMMM yyyy", { locale }) : "—"}. Tot die datum heb je nog steeds toegang tot alle voordelen van je ${tierInfo.name} plan.`
                                : `Your subscription ends on ${subscription.subscription_end ? format(new Date(subscription.subscription_end), "d MMMM yyyy", { locale }) : "—"}. Until then, you still have access to all benefits of your ${tierInfo.name} plan.`}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <CreditCard size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {lang === "nl"
                                ? "Er worden geen verdere betalingen in rekening gebracht."
                                : "No further payments will be charged."}
                            </p>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">
                          {lang === "nl" ? `Reden: ${cancelReason}` : `Reason: ${cancelReason}`}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setCancelStep("idle")}
                            className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">
                            {t("back")}
                          </button>
                          <button onClick={() => { handleManageSubscription(); setCancelStep("idle"); }} disabled={portalLoading}
                            className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground">
                            {portalLoading ? <Loader2 size={16} className="animate-spin" /> : (t("cancelSubscription"))}
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    adminCancelStep === "idle" ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {t("assignedByAdmin")}
                        </p>
                        <button onClick={() => { setAdminCancelStep("form"); setAdminCancelReason(""); }}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/5 active:scale-[0.98]">
                          <XCircle size={16} />
                          {t("cancelSubscription")}
                        </button>
                      </div>
                    ) : adminCancelStep === "form" ? (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-3">
                        <p className="text-sm font-semibold text-destructive">
                          {t("whyCancelQuestion")}
                        </p>
                        <div className="space-y-2">
                          {(lang === "nl"
                            ? ["Te duur", "Gebruik het niet genoeg", "Overgestapt naar ander", "Andere reden"]
                            : ["Too expensive", "Not using it enough", "Switched to another", "Other reason"]
                          ).map((reason) => (
                            <button key={reason} onClick={() => setAdminCancelReason(reason)}
                              className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all border ${
                                adminCancelReason === reason
                                  ? "border-destructive/50 bg-destructive/10 text-destructive font-medium"
                                  : "border-border bg-card hover:bg-secondary/50"
                              }`}>
                              {reason}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setAdminCancelStep("idle")}
                            className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">
                            {t("back")}
                          </button>
                          <button onClick={() => setAdminCancelStep("confirm")} disabled={!adminCancelReason}
                            className="flex-1 rounded-xl bg-destructive/80 px-4 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-40">
                            {t("next")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-3">
                        <p className="text-sm font-semibold text-destructive">
                          {t("areYouSure")}
                        </p>
                        <div className="rounded-lg bg-card border border-border p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <Calendar size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {lang === "nl"
                                ? "Je abonnement stopt bij de eerstvolgende verlenging. Tot die datum heb je nog steeds toegang tot alle voordelen van je huidige plan."
                                : "Your subscription will end at the next renewal date. Until then, you still have access to all benefits of your current plan."}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <CreditCard size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {lang === "nl"
                                ? "Er worden geen verdere betalingen in rekening gebracht."
                                : "No further payments will be charged."}
                            </p>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">
                          {lang === "nl" ? `Reden: ${adminCancelReason}` : `Reason: ${adminCancelReason}`}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setAdminCancelStep("idle")}
                            className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">
                            {t("back")}
                          </button>
                          <button onClick={handleCancelAdminMembership} disabled={portalLoading}
                            className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground">
                            {portalLoading ? <Loader2 size={16} className="animate-spin" /> : (t("cancelSubscription"))}
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : subError ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Kon je abonnementsstatus niet laden. Controleer je verbinding en probeer opnieuw.
                  </p>
                  <button onClick={() => checkSubscription()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold active:scale-[0.97] transition-transform">
                    <Loader2 size={16} className={subLoading ? "animate-spin" : ""} /> Opnieuw proberen
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("noSubscriptionYet")}
                  </p>
                  <button onClick={() => navigate("/diensten/memberships")}
                    className="w-full flex items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:scale-[0.97] transition-transform">
                    <Crown size={16} />
                    {t("viewPlans")}
                  </button>
                </div>
              )}
            </motion.div>


            {/* Broedplaats Abonnement */}
            <motion.div variants={item} className="rounded-xl bg-card border border-primary/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-primary" />
                <h3 className="font-semibold font-display text-sm">
                  {t("broedplaatsSubscription")}
                </h3>
              </div>

              <div className="space-y-4">
              {(() => {
                const bpPlan = subscription?.all_plans?.find(p => p.plan.startsWith("broedplaats"));
                return profileBroedplaats || bpPlan ? (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                        <Users size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold font-display">{(bpPlan?.plan || profileBroedplaats || "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                        <p className="text-xs text-muted-foreground">
                          {bpPlan ? (t("activeSubscription")) : (t("assignedByAdmin"))}
                        </p>
                      </div>
                    </div>
                    {bpPlan && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-secondary/50 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                            {t("creationDate")}
                          </p>
                          <p className="text-sm font-semibold">
                            {format(new Date(bpPlan.subscription_start), "d MMM yyyy", { locale })}
                          </p>
                        </div>
                        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                            {t("nextPayment")}
                          </p>
                          <p className="text-sm font-semibold text-primary">
                            {format(new Date(bpPlan.subscription_end), "d MMM yyyy", { locale })}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("joinCommunity")}
                  </p>
                );
              })()}

                {profileBroedplaats ? (
                  <>
                {/* Weekly Days */}
                <div data-toast-section>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                    {t("weeklyDays")}
                  </p>
                  {[
                    { id: "day1", configKey: "day1" },
                    { id: "day2", configKey: "day2" },
                  ].map((day) => {
                    const dayConf = weeklyDaysConfig?.[day.configKey];
                    const timeStr = dayConf?.start_time && dayConf?.end_time
                      ? `${dayConf.start_time} – ${dayConf.end_time}`
                      : null;
                    return (
                     <div key={day.id} className="rounded-xl bg-secondary/60 p-3.5 mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{dayConf?.label || day.id}</p>
                          {timeStr && <p className="text-[10px] text-muted-foreground">{timeStr}</p>}
                        </div>
                        {confirmedDays[day.id] ? (
                          <button
                            onClick={async () => {
                              if (isAdmin) {
                                setConfirmedDays((prev) => ({ ...prev, [day.id]: false }));
                                setBroedplaatsRsvp((prev) => ({
                                  ...prev,
                                  [day.id]: { attending: false, activity: null },
                                }));
                                await deleteBroedplaatsRsvp(day.id);
                                toast.info("Afgemeld (admin)");
                              } else {
                                setShowUnregisterDialog(day.id);
                              }
                            }}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold gradient-primary text-primary-foreground shadow-glow"
                          >
                            <Check size={12} />
                            {t("attending")}
                          </button>
                        ) : broedplaatsRsvp[day.id]?.attending ? (
                          <button
                            onClick={() => {
                              setBroedplaatsRsvp((prev) => ({
                                ...prev,
                                [day.id]: { ...prev[day.id], attending: false, activity: null },
                              }));
                            }}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold gradient-primary text-primary-foreground shadow-glow"
                          >
                            {t("attending")}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setBroedplaatsRsvp((prev) => ({
                                ...prev,
                                [day.id]: { ...prev[day.id], attending: true, activity: null },
                              }));
                            }}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-card border border-border text-muted-foreground"
                          >
                            {t("signUp")}
                          </button>
                        )}
                      </div>
                      {broedplaatsRsvp[day.id]?.attending && !confirmedDays[day.id] && (
                        <div className="mt-3 space-y-2">
                          <div className="flex gap-2">
                            {[
                              { id: "studio", label: "Studio" },
                              { id: "content", label: "Content" },
                              { id: "clothing", label: t("clothingLabel") },
                            ].map((act) => {
                              const isSelected = broedplaatsRsvp[day.id]?.activity === act.id;
                              return (
                                <button
                                  key={act.id}
                                  onClick={() => {
                                    setBroedplaatsRsvp((prev) => ({
                                      ...prev,
                                      [day.id]: { ...prev[day.id], activity: act.id },
                                    }));
                                  }}
                                  className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition-all ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-card border border-border text-muted-foreground"
                                  }`}
                                >
                                  {act.label}
                                </button>
                              );
                            })}
                          </div>
                          {broedplaatsRsvp[day.id]?.activity && (
                            <button
                              onClick={async () => {
                                setConfirmedDays((prev) => ({ ...prev, [day.id]: true }));
                                const ok = await saveBroedplaatsRsvp(day.id, broedplaatsRsvp[day.id]?.activity, true);
                                if (!ok) {
                                  setConfirmedDays((prev) => ({ ...prev, [day.id]: false }));
                                  toast.error("Bevestigen mislukt — probeer opnieuw.");
                                  return;
                                }
                                toast.success(`Aanmelding voor ${dayConf?.label || day.id} bevestigd ✓`);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold gradient-primary text-primary-foreground shadow-glow"
                            >
                              <Check size={12} />
                              Bevestig aanmelding
                            </button>
                          )}
                        </div>
                      )}
                      {confirmedDays[day.id] && (
                        <p className="text-[10px] text-primary font-semibold mt-1.5">
                          ✓ Aangemeld — {broedplaatsRsvp[day.id]?.activity === "studio" ? "Studio" : broedplaatsRsvp[day.id]?.activity === "content" ? "Content" : t("clothingLabel")}
                        </p>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* Monthly Workshop */}
                <div data-toast-section>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                    {t("monthlyWorkshop")}
                  </p>
                  <div className="rounded-xl bg-secondary/60 p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 shrink-0 mt-0.5">
                        <BookOpen size={16} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        {workshopConfig?.learning_module ? (
                          <p className="text-sm font-semibold text-primary">
                            📚 {workshopConfig.learning_module}
                          </p>
                        ) : (
                          <p className="text-sm font-semibold">{t("workshopComingSoon")}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {workshopConfig?.date
                            ? `${format(new Date(workshopConfig.date), "d MMMM yyyy", { locale })} • ${workshopConfig.start_time || "14:00"} – ${workshopConfig.end_time || "17:00"}`
                            : t("dateTbd")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const wasRsvp = workshopRsvp;
                        setWorkshopRsvp(!wasRsvp);
                        if (!wasRsvp) {
                          setWorkshopConfirmed(true);
                          const ok = await saveBroedplaatsRsvp("workshop", null, true);
                          if (!ok) {
                            setWorkshopRsvp(false); setWorkshopConfirmed(false);
                            toast.error("Aanmelden mislukt — probeer opnieuw.");
                            return;
                          }
                          toast.success("Aanmelding voor de maandelijkse workshop bevestigd ✓");
                        } else {
                          setWorkshopConfirmed(false);
                          const ok = await deleteBroedplaatsRsvp("workshop");
                          if (!ok) {
                            setWorkshopRsvp(true); setWorkshopConfirmed(true);
                            toast.error("Afmelden mislukt — probeer opnieuw.");
                            return;
                          }
                          toast.info("Afgemeld voor de maandelijkse workshop");
                        }
                      }}
                      className={`w-full mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                        workshopRsvp
                          ? "gradient-primary text-primary-foreground shadow-glow"
                          : "bg-card border border-border text-muted-foreground"
                      }`}
                    >
                      {workshopRsvp && <Check size={12} />}
                      {workshopRsvp ? t("signedUp") : t("signUpForWorkshop")}
                    </button>
                  </div>
                </div>

                {/* Cancel Broedplaats */}
                {(() => {
                  const bpPlanCancel = subscription?.all_plans?.find(p => p.plan.startsWith("broedplaats"));
                  const isStripeBp = !!bpPlanCancel;

                  if (bpCancelStep === "idle") {
                    return (
                      <div className="space-y-2">
                        {isStripeBp && (
                          <button onClick={handleManageSubscription} disabled={portalLoading}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-medium transition-all hover:bg-secondary/80 active:scale-[0.98]">
                            {portalLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                            {t("manageSubscription")}
                          </button>
                        )}
                        <button onClick={() => { setBpCancelStep("form"); setBpCancelReason(""); }}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/5 active:scale-[0.98]">
                          <XCircle size={16} />
                          {t("cancelSubscription")}
                        </button>
                      </div>
                    );
                  } else if (bpCancelStep === "form") {
                    return (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-3">
                        <p className="text-sm font-semibold text-destructive">
                          {t("whyCancelQuestion")}
                        </p>
                        <div className="space-y-2">
                          {(lang === "nl"
                            ? ["Te duur", "Gebruik het niet genoeg", "Overgestapt naar ander", "Andere reden"]
                            : ["Too expensive", "Not using it enough", "Switched to another", "Other reason"]
                          ).map((reason) => (
                            <button key={reason} onClick={() => setBpCancelReason(reason)}
                              className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all border ${
                                bpCancelReason === reason
                                  ? "border-destructive/50 bg-destructive/10 text-destructive font-medium"
                                  : "border-border bg-card hover:bg-secondary/50"
                              }`}>
                              {reason}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setBpCancelStep("idle")}
                            className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">
                            {t("back")}
                          </button>
                          <button onClick={() => setBpCancelStep("confirm")} disabled={!bpCancelReason}
                            className="flex-1 rounded-xl bg-destructive/80 px-4 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-40">
                            {t("next")}
                          </button>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-3">
                        <p className="text-sm font-semibold text-destructive">
                          {t("areYouSure")}
                        </p>
                        <div className="rounded-lg bg-card border border-border p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <Calendar size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {isStripeBp && bpPlanCancel?.subscription_end
                                ? (lang === "nl"
                                  ? `Je Broedplaats abonnement stopt op ${format(new Date(bpPlanCancel.subscription_end), "d MMMM yyyy", { locale })}. Tot die datum heb je nog steeds toegang.`
                                  : `Your Broedplaats subscription ends on ${format(new Date(bpPlanCancel.subscription_end), "d MMMM yyyy", { locale })}. Until then, you still have access.`)
                                : (lang === "nl"
                                  ? "Je Broedplaats abonnement stopt bij de eerstvolgende verlenging. Tot die datum heb je nog steeds toegang."
                                  : "Your Broedplaats subscription will end at the next renewal date. Until then, you still have access.")}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <CreditCard size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {lang === "nl"
                                ? "Er worden geen verdere betalingen in rekening gebracht."
                                : "No further payments will be charged."}
                            </p>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">
                          {lang === "nl" ? `Reden: ${bpCancelReason}` : `Reason: ${bpCancelReason}`}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setBpCancelStep("idle")}
                            className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">
                            {t("back")}
                          </button>
                          <button onClick={handleCancelBroedplaats} disabled={portalLoading}
                            className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground">
                            {portalLoading ? <Loader2 size={16} className="animate-spin" /> : (t("cancelSubscription"))}
                          </button>
                        </div>
                      </div>
                    );
                  }
                })()}
                  </>
                ) : (
                <button onClick={() => navigate("/diensten/broedplaats")}
                  className="w-full flex items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:scale-[0.97] transition-transform">
                  <Users size={16} />
                  {t("viewBroedplaatsPlans")}
                </button>
                )}
              </div>
            </motion.div>

            {/* Referral Section */}
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-5" data-toast-section>
              <div className="flex items-center gap-2 mb-3">
                <Gift size={16} className="text-primary" />
                <h3 className="font-semibold font-display text-sm">
                  {t("shareAndEarn")}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t("shareCodeDesc")}
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-secondary p-3">
                <span className="flex-1 rounded-lg bg-primary px-2.5 py-1.5 font-mono text-sm font-semibold text-primary-foreground min-h-[32px] flex items-center">
                  {referralCode || <Loader2 size={14} className="animate-spin" />}
                </span>
                <button onClick={handleCopyCode} className="flex items-center gap-1 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
              {activeReferrals.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-primary" />
                    <span className="text-xs text-muted-foreground">
                      {activeReferrals.length} {t("activeReferralsLabel")}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-success">
                    €{totalDiscount}/{t("perMonth")} {t("discountActive")}
                  </p>
                </div>
              )}

              {/* Redeem a friend's code (new accounts, two-sided EUR 10 credit) */}
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Code van een vriend? Jullie krijgen allebei €10 tegoed.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    placeholder="UPRISING-XXXX"
                    className="flex-1 rounded-lg bg-secondary border border-border px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={async () => {
                      if (!redeemCode.trim() || redeemLoading) return;
                      setRedeemLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke("redeem-referral", {
                          body: { code: redeemCode.trim() },
                        });
                        if (error || data?.error) {
                          toast.error(data?.error || "Er ging iets mis");
                        } else {
                          toast.success(`€${data.reward} tegoed ontvangen! 🎁`);
                          setRedeemCode("");
                          loadCreditBalance();
                        }
                      } finally {
                        setRedeemLoading(false);
                      }
                    }}
                    disabled={redeemLoading || !redeemCode.trim()}
                    className="rounded-lg bg-primary/20 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
                  >
                    {redeemLoading ? <Loader2 size={14} className="animate-spin" /> : "Verzilveren"}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div variants={item} className="grid grid-cols-2 gap-3">
              {[
                { icon: Clock, label: t("totalHoursLabel"), value: `${realStats.totalHours}h`, color: "text-primary" },
                { icon: Calendar, label: t("thisMonth"), value: realStats.sessionsThisMonth.toString(), color: "text-primary" },
                { icon: Mic, label: t("totalSessions"), value: realStats.totalSessions.toString(), color: "text-primary" },
                { icon: FileAudio, label: "Mix/Master", value: realStats.mixMasterProjects.toString(), color: "text-primary" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-card border border-border p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 mb-2">
                    <stat.icon size={18} className={stat.color} />
                  </div>
                  <p className="text-xl font-bold font-display">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </motion.div>

            {/* Next Session Countdown */}
            {nextBooking && countdown && (
              <motion.div variants={item} className="rounded-xl bg-card border border-primary/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Timer size={16} className="text-primary" />
                  <h3 className="font-semibold font-display text-sm">
                    {t("nextSession")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {getStudioName(nextBooking.studio_id)} • {format(new Date(nextBooking.booking_date), "d MMMM", { locale })} • {nextBooking.start_time}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: countdown.days, label: t("days") },
                    { value: countdown.hours, label: t("hours") },
                    { value: countdown.minutes, label: "min" },
                    { value: countdown.seconds, label: "sec" },
                  ].map((unit) => (
                    <div key={unit.label} className="rounded-xl bg-secondary p-3 text-center">
                      <p className="text-xl font-bold font-display text-primary">{unit.value}</p>
                      <p className="text-[10px] text-muted-foreground">{unit.label}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowMapDialog(true)}
                  className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/20 border border-primary/20 px-4 py-3 text-sm font-medium text-primary active:scale-[0.98] transition-all">
                  <Navigation size={16} />
                  {t("navigateToStudio")}
                </button>
              </motion.div>
            )}

            {/* Map Dialog */}
            {showMapDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowMapDialog(false)}>
                <div className="bg-card border border-border rounded-2xl p-6 mx-5 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-semibold font-display text-center mb-4">
                    {t("navigateWith")}
                  </h3>
                  <button onClick={openAppleMaps}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-medium active:scale-[0.98]">
                    <img src={appleMapsIcon} alt="" className="w-5 h-5 rounded" /> Apple Kaarten
                  </button>
                  <button onClick={openGoogleMaps}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-medium active:scale-[0.98]">
                    <img src="/icons/google-maps.png" alt="" className="w-5 h-5" /> Google Maps
                  </button>
                  <button onClick={() => setShowMapDialog(false)}
                    className="w-full text-sm text-muted-foreground pt-2">
                    {t("cancel")}
                  </button>
                </div>
              </div>
                  )}

            {/* Quick Actions */}
            <motion.div variants={item} className="space-y-2">
              <button onClick={() => navigate("/book")}
                className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 text-left transition-all hover:border-primary/40 active:scale-[0.98]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Calendar size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold">{t("bookStudio")}</span>
                  <p className="text-[10px] text-muted-foreground">{t("planNewSession")}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>

              <button onClick={() => navigate("/mix-master")}
                className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 text-left transition-all hover:border-primary/40 active:scale-[0.98]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Music size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold">Mix & Master</span>
                  <p className="text-[10px] text-muted-foreground">{t("submitAProject")}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </motion.div>

            {/* Tegoed & Toegewezen Uren */}
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Gift size={16} className="text-primary" />
                <h3 className="font-semibold font-display text-sm">
                  {t("creditsAndAssignedHours")}
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 shrink-0">
                    <CreditCard size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{t("creditBalance")}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("creditBalanceDesc")}
                    </p>
                  </div>
                  <span className="text-xl font-bold text-primary font-display">{creditBalance > 0 ? `€${creditBalance}` : "-"}</span>
                </div>
                {walletTxns.length > 0 && (
                  <div className="rounded-xl bg-secondary/40 border border-border p-3 space-y-2">
                    {walletTxns.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-muted-foreground">{tx.note || tx.type}</p>
                          {tx.amount > 0 && tx.expires_at && (
                            <p className="text-[10px] text-muted-foreground/70">
                              geldig t/m {new Date(tx.expires_at).toLocaleDateString("nl-NL")}
                            </p>
                          )}
                        </div>
                        <span className={`ml-3 shrink-0 font-semibold ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
                          {tx.amount > 0 ? "+" : ""}€{Math.abs(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-xl bg-success/5 border border-success/20 p-4">
                  <p className="text-xs font-semibold text-success mb-3 flex items-center gap-1.5">
                    <Gift size={12} />
                    {t("assignedHours")}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-card border border-border p-3 text-center">
                      <p className="text-lg font-bold font-display">{freeHours.studio1 > 0 ? `${freeHours.studio1}h` : "-"}</p>
                      <p className="text-[10px] text-muted-foreground">Studio 1</p>
                    </div>
                    <div className="rounded-lg bg-card border border-border p-3 text-center">
                      <p className="text-lg font-bold font-display">{freeHours.studio2 > 0 ? `${freeHours.studio2}h` : "-"}</p>
                      <p className="text-[10px] text-muted-foreground">Studio 2</p>
                    </div>
                    <div className="rounded-lg bg-card border border-border p-3 text-center">
                      <p className="text-lg font-bold font-display">{freeHours.content > 0 ? `${freeHours.content}h` : "-"}</p>
                      <p className="text-[10px] text-muted-foreground">Content Room</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Uprising Points */}
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-5" data-toast-section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-primary" />
                  <h3 className="font-semibold font-display text-sm">Uprising Points</h3>
                </div>
                <span className="text-xl font-bold text-primary font-display">{pointsBalance} pt</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Verdien punten: sessievideo insturen (+50), ruimte schoon achterlaten met foto (+20),
                feedback na je sessie (+10), vriend aanbrengen (+25).
              </p>
              {rewardsCatalog.length > 0 && (
                <div className="space-y-1.5">
                  {rewardsCatalog.map((reward) => {
                    const affordable = pointsBalance >= reward.points;
                    return (
                      <div key={reward.id} className="flex items-center justify-between rounded-lg bg-secondary/40 border border-border px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold">{reward.label}</p>
                          <p className="text-[10px] text-muted-foreground">{reward.points} punten</p>
                        </div>
                        <button
                          disabled={!affordable || redeemingReward === reward.id}
                          onClick={async () => {
                            setRedeemingReward(reward.id);
                            try {
                              const { data, error } = await supabase.functions.invoke("redeem-points", {
                                body: { reward_id: reward.id },
                              });
                              if (error || data?.error) toast.error(data?.error || "Er ging iets mis");
                              else {
                                toast.success(`${reward.label} toegevoegd! 🎉`);
                                loadCreditBalance();
                              }
                            } finally {
                              setRedeemingReward(null);
                            }
                          }}
                          className="rounded-lg bg-primary/20 px-3 py-1.5 text-[11px] font-semibold text-primary disabled:opacity-40"
                        >
                          {redeemingReward === reward.id ? <Loader2 size={12} className="animate-spin" /> : "Inwisselen"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Settings */}
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-5 space-y-3">
              <h3 className="font-semibold font-display text-sm mb-2">
                {t("settings")}
              </h3>
              <div className="relative">
                <button onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="w-full flex items-center gap-3 rounded-xl bg-secondary p-3 text-left">
                  <Globe size={18} className="text-primary" />
                  <div className="flex-1">
                    <span className="text-sm">{t("language")}</span>
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const labels: Record<string, string> = { nl: "Nederlands", en: "English", de: "Deutsch", fr: "Français", es: "Español", tr: "Türkçe", ar: "العربية", hy: "Հայերեն" };
                        return labels[lang] || lang;
                      })()}
                    </p>
                  </div>
                  <ChevronRight size={14} className={`text-muted-foreground transition-transform ${showLangDropdown ? "rotate-90" : ""}`} />
                </button>
                {showLangDropdown && (
                  <div className="mt-1 rounded-xl bg-card border border-border shadow-lg overflow-hidden z-10">
                    {[
                      { code: "nl", label: "Nederlands", flag: "🇳🇱" },
                      { code: "en", label: "English", flag: "🇬🇧" },
                      { code: "de", label: "Deutsch", flag: "🇩🇪" },
                      { code: "es", label: "Español", flag: "🇪🇸" },
                      { code: "fr", label: "Français", flag: "🇫🇷" },
                      { code: "hy", label: "Հայերեն", flag: "🇦🇲" },
                      { code: "tr", label: "Türkçe", flag: "🇹🇷" },
                      { code: "ar", label: "العربية", flag: "🇲🇦" },
                    ]
                      .sort((a, b) => {
                        if (a.code === lang) return -1;
                        if (b.code === lang) return 1;
                        return 0;
                      })
                      .map((l) => (
                    <button key={l.code}
                      onClick={() => { setLang(l.code as any); setShowLangDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary/50 transition-colors ${
                        lang === l.code ? "bg-primary/20 text-primary font-semibold" : ""
                      }`}>
                      <span>{l.flag}</span>
                      <span>{l.label}</span>
                      {lang === l.code && <Check size={14} className="ml-auto text-primary" />}
                    </button>
                  ))}
                  </div>
                )}
              </div>
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-3 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-left text-destructive">
                <LogOut size={18} />
                <span className="text-sm font-medium">{t("signOut")}</span>
              </button>
            </motion.div>
          </>
        )}

        {/* ===== TOEGANG TAB ===== */}
        {activeTab === "access" && (
          <AccountAccessSection />
        )}

        {activeTab === "projects" && (
          projectsLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : projects.length === 0 ? (
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-8 text-center">
              <FileAudio size={32} className="mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold font-display text-sm mb-1">{t("noProjectsYet")}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t("submitFirstProject")}</p>
              <button onClick={() => navigate("/mix-master")}
                className="rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                {t("submitProject")}
              </button>
            </motion.div>
          ) : (
            projects.map((project) => {
              const currentStep = statusSteps.indexOf(project.status);
              return (
                <motion.div key={project.id} variants={item} className="rounded-xl bg-card border border-border p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold font-display text-base">{project.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(project.created_at), "d MMMM yyyy", { locale })}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      project.status === "received" ? "bg-muted text-muted-foreground" :
                      project.status === "mixing" ? "bg-warning/20 text-warning" :
                      project.status === "mastering" ? "bg-primary/20 text-primary" :
                      project.status === "review" ? "bg-blue-400/20 text-blue-400" :
                      "bg-success/20 text-success"
                    }`}>
                      {t(project.status as any)}
                    </span>
                  </div>
                  {project.style && <p className="text-xs text-muted-foreground mb-3">Stijl: {project.style}</p>}

                  {/* Blocked: admin requested upload/info */}
                  {project.staff_notes && (
                    <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 mt-2 mb-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle size={13} className="text-warning" />
                        <p className="text-[11px] font-semibold text-warning">Actie vereist — upload je bestanden</p>
                      </div>
                      <p className="text-xs text-foreground mb-2.5">{project.staff_notes}</p>
                      <button
                        onClick={() => setProjectUploadTarget(project)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-warning/20 py-2 text-xs font-semibold text-warning"
                      >
                        <Upload size={13} /> Ga naar upload
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1 mt-3">
                    {statusSteps.map((step, i) => (
                      <div key={step} className="flex items-center flex-1">
                        <div className={`h-1.5 w-full rounded-full ${i <= currentStep ? "bg-primary" : "bg-secondary"}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    {statusSteps.map((step) => (
                      <span key={step} className="text-[8px] text-muted-foreground capitalize">{t(step as any)}</span>
                    ))}
                  </div>
                </motion.div>
              );
            })
          )
        )}

        {/* ===== PRODUCER TAB ===== */}
        {activeTab === "producer" && (
          producerLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : producerBookings.length === 0 ? (
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-8 text-center">
              <Music size={32} className="mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold font-display text-sm mb-1">{t("noProducerSessions")}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t("scheduleFirstProducer")}</p>
              <button onClick={() => navigate("/producer-booking")}
                className="rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                {t("bookProducer")}
              </button>
            </motion.div>
          ) : (
            producerBookings.map((pb) => (
              <motion.div key={pb.id} variants={item} className="rounded-xl bg-card border border-border p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold font-display text-sm">{t("producerSession")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(pb.preferred_date), "d MMMM yyyy", { locale })} • {pb.preferred_time}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    pb.status === "pending" ? "bg-warning/20 text-warning" :
                    pb.status === "accepted" ? "bg-success/20 text-success" :
                    "bg-destructive/20 text-destructive"
                  }`}>
                    {pb.status === "pending" ? t("pending") :
                     pb.status === "accepted" ? t("accepted") :
                     t("declined")}
                  </span>
                </div>
                {pb.description && <p className="text-xs text-muted-foreground mt-1">{pb.description}</p>}
              </motion.div>
            ))
          )
        )}

        {/* ===== BOOKINGS TAB ===== */}
        {activeTab === "bookings" && (
          bookingsLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : dbBookings.length === 0 ? (
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-8 text-center">
              <Calendar size={32} className="mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold font-display text-sm mb-1">{t("noBookingsLabel")}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t("scheduleFirstSession")}</p>
              <button onClick={() => navigate("/book")}
                className="rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                {t("bookStudio")}
              </button>
            </motion.div>
          ) : (
            <>
              {/* Segmented filter: upcoming vs history */}
              <div className="flex gap-1 rounded-xl bg-secondary p-1 mb-3">
                <button onClick={() => setBookingsFilter("upcoming")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${bookingsFilter === "upcoming" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {t("upcoming")} ({upcomingBookings.length})
                </button>
                <button onClick={() => setBookingsFilter("past")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${bookingsFilter === "past" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {t("history")} ({pastBookings.length})
                </button>
              </div>
              {bookingsFilter === "upcoming" && upcomingBookings.length === 0 && (
                <div className="rounded-xl bg-card border border-border p-6 text-center">
                  <p className="text-xs text-muted-foreground mb-3">{t("scheduleFirstSession")}</p>
                  <button onClick={() => navigate("/book")} className="rounded-xl gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground">{t("bookStudio")}</button>
                </div>
              )}
              {bookingsFilter === "upcoming" && upcomingBookings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                    {t("upcoming")}
                  </h3>
                  <div className="space-y-2">
                    {upcomingBookings.map((b) => {
                      const isMemberOrGratis = b.session_type === "member" || b.session_type === "gratis";
                      return (
                        <motion.div key={b.id} variants={item}
                          className="rounded-xl bg-card border border-primary/20 p-4" data-toast-section>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-sm">{getStudioName(b.studio_id)}</h4>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(b.booking_date), "d MMMM", { locale })} • {b.start_time} • {b.duration_hours}h
                              </p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${b.status === "confirmed" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                              {b.status === "confirmed" ? t("confirmed") : b.status === "pending_payment" ? t("paymentPending") : t("pending")}
                            </span>
                          </div>

                          {/* Modify (members/free) + cancel (everyone, policy-based refund) */}
                          <div className="flex gap-2 mt-3">
                            {isMemberOrGratis && (
                              <button
                                onClick={() => setModifyDialogBooking(b)}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-xs font-semibold text-foreground transition-all hover:bg-secondary/80"
                              >
                                <Pencil size={13} /> {t("modifyBtn")}
                              </button>
                            )}
                            <button
                              onClick={() => setCancelDialogBooking(b)}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 py-2 text-xs font-semibold text-destructive transition-all hover:bg-destructive/20"
                            >
                              <Trash2 size={13} /> {t("cancel")}
                            </button>
                            <button
                              onClick={() => setFaultDialogBooking(b)}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-warning/10 border border-warning/20 py-2 text-xs font-semibold text-warning transition-all hover:bg-warning/20"
                            >
                              <AlertTriangle size={13} /> {t("reportFaultBtn")}
                            </button>
                          </div>
                          <button
                            onClick={() => downloadBookingICS(b, `${getStudioName(b.studio_id)} — Uprising Studio`, "Je sessie bij Uprising Studio. Adres: Spaceshuttle 6e, Amersfoort.")}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/5 border border-primary/15 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/10"
                          >
                            <CalendarPlus size={13} /> {t("addToCalendarBtn")}
                          </button>

                          <NukiAccessButton
                            bookingId={b.id}
                            bookingDate={b.booking_date}
                            startTime={b.start_time}
                            durationHours={b.duration_hours}
                            status={b.status}
                          />

                          {/* Earn points: session video + clean-room photo (on session day) */}
                          {b.booking_date === format(new Date(), "yyyy-MM-dd") && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => setSubmissionDialog({ booking: b, kind: "session_video" })}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 py-2 text-[11px] font-semibold text-primary"
                              >
                                <Video size={12} /> Sessievideo +50pt
                              </button>
                              <button
                                onClick={() => setSubmissionDialog({ booking: b, kind: "clean_room_photo" })}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-success/10 border border-success/20 py-2 text-[11px] font-semibold text-success"
                              >
                                <Sparkles size={12} /> Schoon +20pt
                              </button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
              {bookingsFilter === "past" && pastBookings.length === 0 && (
                <p className="rounded-xl bg-card border border-border p-6 text-center text-xs text-muted-foreground">{t("history")} — {t("noBookingsLabel")}</p>
              )}
              {bookingsFilter === "past" && pastBookings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                    {t("history")}
                  </h3>
                  <div className="space-y-2">
                    {(showAllPast ? pastBookings : pastBookings.slice(0, 10)).map((b) => {
                      const isRecent = (Date.now() - new Date(b.booking_date).getTime()) < 2 * 86_400_000;
                      return (
                        <motion.div key={b.id} variants={item}
                          className="rounded-xl bg-card border border-border p-4 opacity-70">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm">{getStudioName(b.studio_id)}</h4>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(b.booking_date), "d MMMM", { locale })} • {b.start_time} • {b.duration_hours}h
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">{b.status}</span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => navigate(`/book?studio=${b.studio_id}`)}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-[11px] font-semibold text-foreground"
                            >
                              <Calendar size={12} /> {t("bookAgainBtn")}
                            </button>
                            {isRecent && b.status === "confirmed" && (
                              <button
                                onClick={() => setSubmissionDialog({ booking: b, kind: "session_video" })}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 py-2 text-[11px] font-semibold text-primary"
                              >
                                <Video size={12} /> Video +50pt
                              </button>
                            )}
                            {b.status === "confirmed" && (
                              reviewedBookingIds.has(b.id) ? (
                                <span className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-success/10 border border-success/20 py-2 text-[11px] font-semibold text-success">
                                  <Star size={12} className="fill-success" /> {t("ratedBtn")}
                                </span>
                              ) : (
                                <button
                                  onClick={() => setReviewDialogBooking(b)}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 py-2 text-[11px] font-semibold text-primary"
                                >
                                  <Star size={12} /> {t("rateBtn")}
                                </button>
                              )
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  {pastBookings.length > 10 && (
                    <button
                      onClick={() => setShowAllPast((v) => !v)}
                      className="mt-3 w-full rounded-xl bg-card border border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.99]"
                    >
                      {showAllPast
                        ? t("showLess")
                        : `${t("showMore")} (${pastBookings.length - 10})`}
                    </button>
                  )}
                </div>
              )}
            </>
          )
        )}

        {/* Booking management dialogs */}
        <ReviewDialog
          open={!!reviewDialogBooking}
          onOpenChange={(open) => { if (!open) setReviewDialogBooking(null); }}
          booking={reviewDialogBooking}
          studioName={reviewDialogBooking ? getStudioName(reviewDialogBooking.studio_id) : ""}
          onSubmitted={() => {
            if (reviewDialogBooking) setReviewedBookingIds((prev) => new Set(prev).add(reviewDialogBooking.id));
            toast.success("Bedankt voor je beoordeling! +10 punten.");
          }}
        />
        <SubmissionUploadDialog
          open={!!submissionDialog}
          onOpenChange={(open) => { if (!open) setSubmissionDialog(null); }}
          booking={submissionDialog?.booking}
          kind={submissionDialog?.kind || "session_video"}
          onSubmitted={() => {
            toast.success("Ingestuurd! Je punten volgen na goedkeuring door het team.");
          }}
        />
        <ProjectFileUploadDialog
          open={!!projectUploadTarget}
          onOpenChange={(open) => { if (!open) setProjectUploadTarget(null); }}
          project={projectUploadTarget}
          onUploaded={() => {
            toast.success("Bestanden geüpload — het team gaat verder met je project.");
            reloadProjects();
          }}
        />
        <FaultReportDialog
          open={!!faultDialogBooking}
          onOpenChange={(open) => { if (!open) setFaultDialogBooking(null); }}
          booking={faultDialogBooking}
          onReported={(result) => {
            toast.success(
              result.compensated
                ? `Melding ontvangen — €${result.compensated} compensatie toegekend`
                : "Melding ontvangen, het team is op de hoogte"
            );
            loadCreditBalance();
          }}
        />
        <BookingCancelDialog
          open={!!cancelDialogBooking}
          onOpenChange={(open) => { if (!open) setCancelDialogBooking(null); }}
          booking={cancelDialogBooking}
          onCancelled={() => {
            toast.success("Boeking geannuleerd");
            loadBookings();
            loadStats();
          }}
        />
        <BookingModifyDialog
          open={!!modifyDialogBooking}
          onOpenChange={(open) => { if (!open) setModifyDialogBooking(null); }}
          booking={modifyDialogBooking}
          onModified={() => {
            toast.success("Boeking gewijzigd");
            loadBookings();
            loadStats();
          }}
        />
        {activeTab === "settings" && (
          <>
            <motion.div variants={item}>
              <GiftCardSection onRedeemed={loadCreditBalance} />
            </motion.div>
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={16} className="text-primary" />
                <h3 className="font-semibold font-display text-sm">{t("notificationPrefs")}</h3>
              </div>
              <div className="space-y-4">
                {[
                  { key: "push", label: t("pushNotifications"), desc: t("pushNotificationsDesc") },
                  { key: "email", label: t("emailNotifications"), desc: t("emailNotificationsDesc") },
                  { key: "bookingReminders", label: t("bookingReminders"), desc: t("bookingRemindersDesc") },
                  { key: "promotions", label: t("promotions"), desc: t("promotionsDesc") },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => saveNotifPrefs({ ...notifPrefs, [item.key]: !notifPrefs[item.key as keyof typeof notifPrefs] })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        notifPrefs[item.key as keyof typeof notifPrefs] ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        notifPrefs[item.key as keyof typeof notifPrefs] ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                ))}

                {/* WhatsApp reminders opt-in */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <span className="text-success">✓</span> WhatsApp-herinneringen
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sessie-reminders op WhatsApp (via ons zakelijke nummer). Zorg dat je telefoonnummer klopt.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!user) return;
                      const next = !whatsappOptIn;
                      setWhatsappOptIn(next);
                      const { error } = await supabase.from("profiles").update({ whatsapp_opt_in: next }).eq("id", user.id);
                      if (error) {
                        setWhatsappOptIn(!next);
                        toast.error("Opslaan mislukt — probeer opnieuw.");
                        return;
                      }
                      toast.success(next ? "WhatsApp-herinneringen aan" : "WhatsApp-herinneringen uit");
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${whatsappOptIn ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ${whatsappOptIn ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Language */}
            <motion.div variants={item} className="rounded-xl bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe size={16} className="text-primary" />
                <h3 className="font-semibold font-display text-sm">{t("language")}</h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { code: "nl", label: "NL" },
                  { code: "en", label: "EN" },
                  { code: "de", label: "DE" },
                  { code: "fr", label: "FR" },
                  { code: "es", label: "ES" },
                  { code: "tr", label: "TR" },
                  { code: "ar", label: "AR" },
                  { code: "hy", label: "HY" },
                ].map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code as any)}
                    className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                      lang === l.code ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Sign Out */}
            <motion.div variants={item}>
              <button onClick={signOut}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/5 active:scale-[0.98]">
                <LogOut size={16} />
                {t("signOut")}
              </button>
            </motion.div>
          </>
        )}
      </motion.div>
      {/* Unregister confirmation dialog */}
      {showUnregisterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-6">
          <div className="animate-fade-in rounded-2xl card-premium border border-border p-6 max-w-sm w-full space-y-4" data-toast-section>
            <h3 className="font-display font-semibold text-base">Weet je het zeker?</h3>
            <p className="text-sm text-muted-foreground">
              Je kan je maar 1x aanmelden voor deze dag. Als je je afmeldt, kun je je niet opnieuw inschrijven.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUnregisterDialog(null)}
                className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium"
              >
                Annuleren
              </button>
              <button
                onClick={async () => {
                  const dayId = showUnregisterDialog;
                  const prevConfirmed = confirmedDays[dayId];
                  const prevRsvp = broedplaatsRsvp[dayId];
                  setConfirmedDays((prev) => ({ ...prev, [dayId]: false }));
                  setBroedplaatsRsvp((prev) => ({
                    ...prev,
                    [dayId]: { attending: false, activity: null },
                  }));
                  setShowUnregisterDialog(null);
                  const ok = await deleteBroedplaatsRsvp(dayId);
                  if (!ok) {
                    setConfirmedDays((prev) => ({ ...prev, [dayId]: prevConfirmed }));
                    setBroedplaatsRsvp((prev) => ({ ...prev, [dayId]: prevRsvp }));
                    toast.error("Afmelden mislukt — probeer opnieuw.");
                    return;
                  }
                  toast.info("Je bent afgemeld");
                }}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground"
              >
                Afmelden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountPage;
