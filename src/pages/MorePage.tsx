import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Globe, Bell, HelpCircle, Info, Shield, FileText, LogOut, ChevronRight, Settings, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";

const MorePage = () => {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminRole();

  const menuItems = [
    {
      icon: Globe,
      label: t("language"),
      value: lang === "nl" ? "Nederlands" : "English",
      action: () => setLang(lang === "nl" ? "en" : "nl"),
    },
    { icon: Bell, label: t("notifications"), action: () => {} },
    { icon: HelpCircle, label: t("help"), action: () => {} },
    { icon: Info, label: t("about"), action: () => {} },
    { icon: Shield, label: t("privacy"), action: () => navigate("/privacy") },
    { icon: FileText, label: t("terms"), action: () => navigate("/terms") },
  ];

  return (
    <div className="min-h-full px-5 pt-6">
      <h1 className="text-2xl font-bold font-display mb-6">{t("settings")}</h1>

      {user && (
        <button onClick={() => navigate("/coach")}
          className="w-full flex items-center gap-4 rounded-xl bg-primary/10 border border-primary/20 px-5 py-4 text-left mb-4 transition-colors hover:bg-primary/20">
          <Megaphone size={20} className="text-primary" />
          <div className="flex-1">
            <span className="block text-sm font-semibold text-primary">Content Coach</span>
            <span className="block text-[11px] text-muted-foreground">
              {lang === "nl" ? "Post-ideeën, captions & releaseplannen op maat" : "Personal post ideas, captions & release plans"}
            </span>
          </div>
          <ChevronRight size={16} className="text-primary" />
        </button>
      )}

      {isAdmin && (
        <button onClick={() => navigate("/admin")}
          className="w-full flex items-center gap-4 rounded-xl bg-primary/10 border border-primary/20 px-5 py-4 text-left mb-4 transition-colors hover:bg-primary/20">
          <Settings size={20} className="text-primary" />
          <span className="flex-1 text-sm font-semibold text-primary">Admin Dashboard</span>
          <ChevronRight size={16} className="text-primary" />
        </button>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl bg-card border border-border overflow-hidden"
      >
        {menuItems.map((menuItem, i) => (
          <button
            key={i}
            onClick={menuItem.action}
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/50 border-b border-border last:border-b-0"
          >
            <menuItem.icon size={20} className="text-primary shrink-0" />
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
          className="mt-6 flex w-full items-center gap-4 rounded-xl bg-destructive/10 border border-destructive/20 px-5 py-4 text-left transition-colors hover:bg-destructive/20"
        >
          <LogOut size={20} className="text-destructive" />
          <span className="text-sm font-medium text-destructive">{t("logout")}</span>
        </button>
      ) : (
        <button
          onClick={() => navigate("/auth")}
          className="mt-6 flex w-full items-center gap-4 rounded-xl bg-primary/10 border border-primary/20 px-5 py-4 text-left transition-colors hover:bg-primary/20"
        >
          <LogOut size={20} className="text-primary" />
          <span className="text-sm font-medium text-primary">{t("loginTab")}</span>
        </button>
      )}
    </div>
  );
};

export default MorePage;
