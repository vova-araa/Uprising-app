import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Mail, Lock, User, Loader2, ArrowRight, UserPlus, LogIn } from "lucide-react";
import { inlineToast as toast } from "@/components/InlineToast";
import logoUprising from "@/assets/logo-uprising.png";

interface AuthGateDialogProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  allowGuest?: boolean;
  onGuestContinue?: (name: string, email: string) => void;
  context?: "booking" | "membership" | "service";
}

const AuthGateDialog = ({
  open,
  onClose,
  onAuthenticated,
  context = "booking",
}: AuthGateDialogProps) => {
  const { t, lang } = useI18n();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"choose" | "login" | "register">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const contextMessages: Record<string, { nl: string; en: string }> = {
    booking: {
      nl: "Log in om je boeking te voltooien",
      en: "Log in to complete your booking",
    },
    membership: {
      nl: "Voor memberships moet je een account aanmaken",
      en: "An account is required for memberships",
    },
    service: {
      nl: "Maak een account aan om een aanvraag te doen",
      en: "Create an account to submit a request",
    },
  };

  const benefits = lang === "nl"
    ? ["Je boekingen beheren", "Studio uren bekijken", "Memberships gebruiken", "Facturen terugvinden"]
    : ["Manage your bookings", "View studio hours", "Use memberships", "Find your invoices"];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(t("fillAllFields"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("invalid") || msg.includes("credentials")) {
          toast.error(t("invalidEmailOrPassword"));
        } else if (msg.includes("not confirmed")) {
          toast.error(t("confirmEmailFirst"));
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success(t("loggedIn"));
      onAuthenticated();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error(t("fillAllFields"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("passwordMinLength"));
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error(t("passwordNeedsUppercase"));
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error(t("passwordNeedsNumber"));
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      toast.error(t("passwordNeedsSpecial"));
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await signUp(email, password, fullName);
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("already")) {
          toast.error(t("emailAlreadyInUse"));
        } else {
          toast.error(error.message);
        }
        return;
      }
      const hasSession = data?.session != null;
      if (hasSession) {
        toast.success(t("accountCreatedWelcome"));
        onAuthenticated();
      } else {
        toast.success(t("accountCreatedCheckEmail"));
      }
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (error) toast.error((error as any).message || "Google sign-in failed");
  };

  const handleAppleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
    if (error) toast.error((error as any).message || "Apple sign-in failed");
  };

  const resetState = () => {
    setMode("choose");
    setEmail("");
    setPassword("");
    setFullName("");
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetState(); } }}>
      <DialogContent className="max-w-sm mx-auto p-0 rounded-2xl border-border bg-card overflow-hidden" data-toast-section>
        {/* Header */}
        <div className="p-6 pb-4 text-center">
          <img src={logoUprising} alt="Uprising" className="h-8 mx-auto mb-4 opacity-80" />
          <h2 className="text-lg font-bold font-display">
            {contextMessages[context]?.[lang === "nl" ? "nl" : "en"]}
          </h2>
          {mode === "choose" && (
            <div className="mt-3 text-left">
              <p className="text-xs text-muted-foreground mb-2">
                {t("withAccountYouCan")}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 space-y-3">
          {mode === "choose" && (
            <>
              <button
                onClick={() => setMode("login")}
                className="w-full flex items-center justify-center gap-2 rounded-xl gradient-primary py-3 font-semibold text-primary-foreground active:scale-[0.98]"
              >
                <LogIn size={18} />
                {t("loginTab")}
              </button>
              <button
                onClick={() => setMode("register")}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-3 font-semibold text-foreground hover:bg-secondary active:scale-[0.98]"
              >
                <UserPlus size={18} />
                {t("createAccount")}
              </button>

              {/* Social Login */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{t("or")}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button type="button" onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-card border border-border py-3 text-sm font-semibold hover:bg-secondary/50 transition-colors active:scale-[0.98]">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t("continueWithGoogle")}
              </button>

              <button type="button" onClick={handleAppleLogin}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-card border border-border py-3 text-sm font-semibold hover:bg-secondary/50 transition-colors active:scale-[0.98]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                {t("continueWithApple")}
              </button>
            </>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("password")}
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl gradient-primary py-3 font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><LogIn size={18} /> {t("loginTab")}</>}
              </button>
              <button type="button" onClick={() => setMode("choose")} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
                ← {t("back")}
              </button>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordMinCharsShort")}
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl gradient-primary py-3 font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><UserPlus size={18} /> {t("createAccount")}</>}
              </button>
              <button type="button" onClick={() => setMode("choose")} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
                ← {t("back")}
              </button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthGateDialog;
