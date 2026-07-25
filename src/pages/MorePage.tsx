import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Globe, Bell, HelpCircle, Info, Shield, FileText, LogOut, ChevronRight, Settings, Megaphone, Building2, Handshake, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useLabelAccess } from "@/hooks/useLabelAccess";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useOnboarding } from "@/components/AppShell";
import SEO from "@/components/SEO";

const WEBSITE_URL = "https://uprisingstudio.nl";

const MorePage = () => {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const { isLabelManager } = useLabelAccess();
  const { supportInfo } = useAppConfig();
  const { openTour } = useOnboarding();

  const openHelp = () => {
    if (supportInfo?.email) {
      window.location.href = `mailto:${supportInfo.email}`;
    } else {
      window.open(WEBSITE_URL, "_blank", "noopener");
    }
  };

  const menuItems = [
    {
      icon: Globe,
      label: t("language"),
      value: lang === "nl" ? "Nederlands" : "English",
      action: () => setLang(lang === "nl" ? "en" : "nl"),
    },
    { icon: Compass, label: t("onbMenuItem"), action: () => openTour() },
    { icon: Bell, label: t("notifications"), action: () => navigate("/account?tab=settings") },
    { icon: HelpCircle, label: t("help"), action: openHelp },
    { icon: Info, label: t("about"), action: () => window.open(WEBSITE_URL, "_blank", "noopener") },
    { icon: Shield, label: t("privacy"), action: () => navigate("/privacy") },
    { icon: FileText, label: t("terms"), action: () => navigate("/terms") },
  ];

  const shortcuts = [
    isLabelManager && { icon: Building2, label: "Label Dashboard", desc: lang === "nl" ? "Uren-pot, artiesten, boeken & facturen" : "Hours pool, artists, bookings & invoices", action: () => navigate("/label") },
    isAdmin && { icon: Settings, label: "Admin Dashboard", desc: lang === "nl" ? "Boekingen, leden, financiën & meer" : "Bookings, members, finance & more", action: () => navigate("/admin") },
    user && { icon: Megaphone, label: "Content Coach", desc: lang === "nl" ? "Post-ideeën, captions & releaseplannen op maat" : "Personal post ideas, captions & release plans", action: () => navigate("/coach") },
    user && { icon: Handshake, label: "Collab Board", desc: lang === "nl" ? "Vind een zanger, producer, beatmaker of engineer" : "Find a singer, producer, beatmaker or engineer", action: () => navigate("/collab") },
  ].filter(Boolean) as { icon: any; label: string; desc: string; action: () => void }[];

  return (
    <div className="min-h-full px-5 pt-6 lg:max-w-2xl lg:mx-auto lg:px-8 pb-28">
      <SEO title={`${t("settings")} — Uprising Studio`} description="Instellingen, taal, help en meer bij Uprising Studio." path="/more" />
      <h1 className="text-2xl font-bold font-display mb-6">{t("settings")}</h1>

      {shortcuts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="h-4 w-1 rounded-full accent-bar" />
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{lang === "nl" ? "Sneltoegang" : "Quick access"}</h2>
          </div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2.5">
            {shortcuts.map((s, i) => (
              <button key={i} onClick={s.action}
                className="group flex items-center gap-3.5 rounded-2xl card-feature border border-white/5 p-3.5 text-left transition-all hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.99]">
                <div className="icon-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
                  <s.icon size={19} className="text-white" strokeWidth={2.1} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-bold font-display">{s.label}</span>
                  <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{s.desc}</span>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </button>
            ))}
          </motion.div>
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-4 w-1 rounded-full accent-bar" />
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{lang === "nl" ? "Voorkeuren" : "Preferences"}</h2>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl card-feature border border-white/5 overflow-hidden"
      >
        {menuItems.map((menuItem, i) => (
          <button
            key={i}
            onClick={menuItem.action}
            className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] border-b border-white/5 last:border-b-0"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12">
              <menuItem.icon size={17} className="text-primary" />
            </div>
            <span className="flex-1 text-sm font-medium">{menuItem.label}</span>
            {"value" in menuItem && menuItem.value && (
              <span className="text-xs text-muted-foreground mr-1">{menuItem.value}</span>
            )}
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </motion.div>

      {user ? (
        <button
          onClick={async () => { await signOut(); navigate("/auth"); }}
          className="mt-6 flex w-full items-center gap-4 rounded-2xl bg-destructive/10 border border-destructive/20 px-5 py-4 text-left transition-colors hover:bg-destructive/20"
        >
          <LogOut size={20} className="text-destructive" />
          <span className="text-sm font-semibold text-destructive">{t("logout")}</span>
        </button>
      ) : (
        <button
          onClick={() => navigate("/auth")}
          className="mt-6 flex w-full items-center gap-4 rounded-2xl btn-glow px-5 py-4 text-left text-primary-foreground active:scale-[0.99]"
        >
          <LogOut size={20} />
          <span className="text-sm font-bold">{t("loginTab")}</span>
        </button>
      )}
    </div>
  );
};

export default MorePage;
