import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Types for config values
export interface StudioConfig {
  id: string;
  nameKey: string;
  descKey: string;
  titleNl?: string;
  titleEn?: string;
  descNl?: string;
  descEn?: string;
  imageUrl?: string;
  pricePerHour: number;
  equipment: string[];
  features?: { nl: string; en: string }[];
  capacity?: number;
  availability?: string;
  size?: string;
}

export interface MembershipTier {
  id: string;
  name: string;
  maxHours: number;
  maxBookings: number;
  priceMonthly: number | null;
  priceYearly: number | null;
  discount: number;
  desc: { nl: string; en: string };
}

export interface BroedplaatsPlan {
  id: string;
  name: string;
  priceMonthly: number;
}

export interface BookingRules {
  min_duration: number;
  max_duration: number;
  extras: { id: string; labelKey: string; price: number }[];
}

export interface MixMasterPricing {
  basePrice: number;
  proDiscount: number;
  unlimitedDiscount: number;
}

export interface ProducerPricing {
  depositAmount: number;
}

export interface HomepageSection {
  id: string;
  visible: boolean;
  sort: number;
}

export interface QuickAction {
  labelKey: string;
  icon: string;
  path: string;
  visible: boolean;
}

export interface HeroContent {
  titleNl: string;
  titleEn: string;
  subtitleKey: string;
  ctaPath: string;
  ctaLabelKey: string;
}

export interface FeatureFlags {
  maintenance_mode: boolean;
  booking_enabled: boolean;
  mix_master_enabled: boolean;
  producer_sessions_enabled: boolean;
  memberships_enabled: boolean;
  broedplaats_enabled: boolean;
  content_requests_enabled: boolean;
  ai_assistant_enabled: boolean;
  referrals_enabled: boolean;
  print_shop_visible: boolean;
  status_bar_visible: boolean;
}

export interface ServiceCategory {
  id: string;
  visible: boolean;
  sort: number;
}

export interface ServiceConfig {
  id: string;
  nameKey: string;
  titleNl: string;
  titleEn: string;
  descNl: string;
  descEn: string;
  priceNl: string;
  priceEn: string;
  requestOnly: boolean;
  icon: string;
  imageUrl: string;
}

export interface AnnouncementBanner {
  visible: boolean;
  message: string;
  type: string;
  link: string;
  dismissible: boolean;
}

export interface SupportInfo {
  email: string;
  phone: string;
  address: string;
  openingHours: string;
  googleMapsUrl: string;
}

interface AppConfigContextType {
  studios: StudioConfig[];
  membershipTiers: MembershipTier[];
  broedplaatsPlans: BroedplaatsPlan[];
  bookingRules: BookingRules;
  mixMasterPricing: MixMasterPricing;
  producerPricing: ProducerPricing;
  homepageSections: HomepageSection[];
  quickActions: QuickAction[];
  heroContent: HeroContent;
  featureFlags: FeatureFlags;
  servicesConfig: ServiceConfig[];
  servicesCategories: ServiceCategory[];
  announcementBanner: AnnouncementBanner;
  supportInfo: SupportInfo;
  studioDisplayNames: Record<string, string>;
  printShop: any;
  loading: boolean;
  refresh: () => Promise<void>;
  getConfigRaw: (key: string) => any;
}

const defaultFeatureFlags: FeatureFlags = {
  maintenance_mode: false,
  booking_enabled: true,
  mix_master_enabled: true,
  producer_sessions_enabled: true,
  memberships_enabled: true,
  broedplaats_enabled: true,
  content_requests_enabled: true,
  ai_assistant_enabled: true,
  referrals_enabled: true,
  print_shop_visible: true,
  status_bar_visible: true,
};

const defaultBookingRules: BookingRules = {
  min_duration: 2,
  max_duration: 12,
  extras: [
    { id: "mix-master", labelKey: "mixMasterService", price: 150 },
    { id: "photographer", labelKey: "photographer", price: 0 },
    { id: "session-recap", labelKey: "sessionRecapAddon", price: 49 },
    { id: "bts-pack", labelKey: "btsPackAddon", price: 35 },
    { id: "session-photos", labelKey: "sessionPhotosAddon", price: 40 },
  ],
};

const defaultHeroContent: HeroContent = {
  titleNl: "YOUR VISION, OUR CRAFT",
  titleEn: "YOUR VISION, OUR CRAFT",
  subtitleKey: "heroSubtitle",
  ctaPath: "/book?type=studio",
  ctaLabelKey: "bookStudio",
};

const defaultBanner: AnnouncementBanner = {
  visible: false,
  message: "",
  type: "info",
  link: "",
  dismissible: true,
};

const AppConfigContext = createContext<AppConfigContextType | null>(null);

export const AppConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [configMap, setConfigMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      const { data, error } = await (supabase.from as any)("app_config")
        .select("config_key, config_value, is_active")
        .eq("is_active", true);
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const row of (data || [])) {
        map[row.config_key] = row.config_value;
      }
      setConfigMap(map);
    } catch (err) {
      console.error("Failed to load app config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const get = (key: string, fallback: any = null) => configMap[key] ?? fallback;

  const value: AppConfigContextType = {
    studios: get("studios", []),
    membershipTiers: get("membership_tiers", []),
    broedplaatsPlans: get("broedplaats_plans", []),
    bookingRules: get("booking_rules", defaultBookingRules),
    mixMasterPricing: get("mix_master_pricing", { basePrice: 150, proDiscount: 0.1, unlimitedDiscount: 0.2 }),
    producerPricing: get("producer_pricing", { depositAmount: 350 }),
    homepageSections: get("homepage_sections", []),
    quickActions: get("quick_actions", []),
    heroContent: get("hero_content", defaultHeroContent),
    featureFlags: { ...defaultFeatureFlags, ...get("feature_flags", {}) },
    servicesConfig: get("services", []),
    servicesCategories: get("services_categories", []),
    announcementBanner: { ...defaultBanner, ...get("announcement_banner", {}) },
    supportInfo: get("support_info", { email: "", phone: "", address: "", openingHours: "24/7", googleMapsUrl: "" }),
    studioDisplayNames: get("studio_display_names", {}),
    printShop: get("print_shop", {}),
    loading,
    refresh: loadConfig,
    getConfigRaw: get,
  };

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
};

export const useAppConfig = () => {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppConfig must be used within AppConfigProvider");
  return ctx;
};
