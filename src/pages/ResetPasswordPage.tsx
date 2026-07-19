import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import uprisingLogo from "@/assets/uprising-logo.png";
import { inlineToast as toast } from "@/components/InlineToast";
import { useNavigate } from "react-router-dom";

const ResetPasswordPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setIsRecovery(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error(t("passwordsDontMatch")); return; }
    if (password.length < 8) { toast.error(t("passwordMinLength")); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast.success(t("passwordSuccess"));
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      toast.error(err.message || t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl bg-card border border-border pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground";

  if (!isRecovery) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <img src={uprisingLogo} alt="Uprising Studio" className="h-16 w-16 rounded-2xl object-contain mb-4 mx-auto" />
          <h1 className="text-2xl font-bold font-display mb-2">{t("invalidLink")}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t("invalidLinkDesc")}</p>
          <button onClick={() => navigate("/")} className="rounded-xl gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow">
            {t("backToLogin")}
          </button>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center">
          <CheckCircle size={48} className="text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-display mb-2">{t("passwordUpdated")}</h1>
          <p className="text-sm text-muted-foreground">{t("redirecting")}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={uprisingLogo} alt="Uprising Studio" className="h-16 w-16 rounded-2xl object-contain mb-4" />
          <h1 className="text-2xl font-bold font-display">{t("newPassword")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("enterNewPassword")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" data-toast-section>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={t("newPassword")} required minLength={6} className={inputClass} />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirmPassword")} required minLength={6} className={inputClass} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] disabled:opacity-60">
            {loading ? <Loader2 size={18} className="animate-spin" /> : (<>{t("updatePasswordBtn")}<ArrowRight size={16} /></>)}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
