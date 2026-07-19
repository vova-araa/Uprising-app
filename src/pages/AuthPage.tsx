import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Loader2, Phone, Globe, ChevronDown } from "lucide-react";
import logoUprising from "@/assets/logo-uprising.png";
import { inlineToast as toast } from "@/components/InlineToast";

type LangPref = "nl" | "en";
type View = "auth" | "forgot";

const COUNTRY_CODES = [
  { code: "+31", flag: "🇳🇱", label: "NL" },
  { code: "+32", flag: "🇧🇪", label: "BE" },
  { code: "+49", flag: "🇩🇪", label: "DE" },
  { code: "+44", flag: "🇬🇧", label: "UK" },
  { code: "+33", flag: "🇫🇷", label: "FR" },
  { code: "+1", flag: "🇺🇸", label: "US" },
  { code: "+34", flag: "🇪🇸", label: "ES" },
  { code: "+39", flag: "🇮🇹", label: "IT" },
  { code: "+48", flag: "🇵🇱", label: "PL" },
  { code: "+90", flag: "🇹🇷", label: "TR" },
  { code: "+212", flag: "🇲🇦", label: "MA" },
];

const AuthPage = ({ embedded }: { embedded?: boolean }) => {
  const navigate = embedded ? undefined : useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { t, lang, setLang } = useI18n();

  // Redirect to home if already logged in (only when on /auth route directly)
  useEffect(() => {
    if (user && navigate) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);
  const [isLogin, setIsLogin] = useState(true);
  const [view, setView] = useState<View>("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+31");
  const [showCountryCodes, setShowCountryCodes] = useState(false);
  const [phone, setPhone] = useState("");
  const [langPref, setLangPref] = useState<LangPref>(lang as LangPref);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("rememberMe") !== "false");

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success(t("resetLinkSent"));
    } catch (err: any) {
      toast.error(err.message || t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const triggerError = (msg: string) => {
    setLoginError(msg);
    setShakeForm(true);
    setTimeout(() => setShakeForm(false), 600);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");
    // Client-side validation
    if (!email.trim() || !password.trim()) {
      triggerError(t("fillAllFieldsRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      triggerError(t("invalidEmailFormat"));
      return;
    }
    if (!isLogin) {
      if (!fullName.trim()) {
        triggerError(t("nameRequired"));
        return;
      }
      if (!phone.trim()) {
        triggerError(t("phoneRequired"));
        return;
      }
      if (password.length < 8) {
        triggerError(t("passwordMinLength"));
        return;
      }
      if (!/[A-Z]/.test(password)) {
        triggerError(t("passwordNeedsUppercase"));
        return;
      }
      if (!/[0-9]/.test(password)) {
        triggerError(t("passwordNeedsNumber"));
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        triggerError(t("passwordNeedsSpecial"));
        return;
      }
    }
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          const msg = error.message?.toLowerCase() || "";
          if (msg.includes("invalid login credentials") || msg.includes("invalid") && msg.includes("credentials")) {
            triggerError(lang === "nl"
              ? "Onjuist e-mailadres of wachtwoord. Controleer je gegevens en probeer opnieuw."
              : "Incorrect email or password. Please check your details and try again.");
          } else if (msg.includes("not confirmed") || msg.includes("email not confirmed")) {
            triggerError(lang === "nl"
              ? "Je e-mailadres is nog niet bevestigd. Controleer je inbox en klik op de bevestigingslink."
              : "Your email is not confirmed yet. Please check your inbox and click the confirmation link.");
          } else if (msg.includes("too many requests") || msg.includes("rate limit")) {
            triggerError(lang === "nl"
              ? "Te veel pogingen. Wacht even en probeer het opnieuw."
              : "Too many attempts. Please wait a moment and try again.");
          } else {
            triggerError(error.message || t("loginFailed"));
          }
          return;
        }
        // Login success — clear any leftover inline error, store prefs, redirect
        setLoginError("");
        localStorage.setItem("rememberMe", rememberMe ? "true" : "false");
        if (!rememberMe) {
          sessionStorage.setItem("loggedInThisSession", "true");
        }
        toast.success(t("welcomeBack"));
        // Navigate handled by useEffect watching `user`
      } else {
        setLang(langPref);
        const { data, error } = await signUp(email, password, fullName);
        if (error) {
          const msg = error.message?.toLowerCase() || "";
          // signup error handled below
          if (msg.includes("already") || msg.includes("already been registered") || msg.includes("already registered") || msg.includes("user already registered")) {
            triggerError(lang === "nl"
              ? "Dit e-mailadres is al in gebruik. Probeer in te loggen."
              : "This email is already registered. Try logging in instead.");
          } else if (msg.includes("password") && msg.includes("weak")) {
            triggerError(lang === "nl"
              ? "Wachtwoord is te zwak. Gebruik minimaal 6 tekens, een hoofdletter en een cijfer."
              : "Password is too weak. Use at least 6 characters, an uppercase letter and a number.");
          } else if (msg.includes("rate limit") || msg.includes("too many")) {
            triggerError(lang === "nl"
              ? "Te veel pogingen. Wacht even en probeer het opnieuw."
              : "Too many attempts. Please wait a moment and try again.");
          } else if (msg.includes("not allowed") || msg.includes("signup") || msg.includes("disabled")) {
            triggerError(lang === "nl"
              ? "Registratie is momenteel niet beschikbaar. Neem contact op met de beheerder."
              : "Registration is currently unavailable. Please contact the administrator.");
          } else {
            triggerError(lang === "nl"
              ? `Registratie mislukt: ${error.message}`
              : `Registration failed: ${error.message}`);
          }
          return;
        }

        // Detect "silent duplicate" — Supabase returns success but empty identities when user already exists
        const identities = data?.user?.identities;
        if (identities && identities.length === 0) {
          triggerError(lang === "nl"
            ? "Dit e-mailadres is al in gebruik. Probeer in te loggen."
            : "This email is already registered. Try logging in instead.");
          return;
        }

        const hasSession = data?.session != null;

        // Try to update phone number on the profile
        try {
          const currentUser = data?.user;
          if (currentUser) {
            const fullPhone = phone ? `${countryCode}${phone.replace(/^0+/, "")}` : null;
            await (supabase as any).from("profiles").update({ phone: fullPhone }).eq("id", currentUser.id);
          }
        } catch { /* profile update is best-effort */ }

        setLoginError("");

        if (hasSession) {
          toast.success(t("accountCreatedWelcome"));
        } else {
          toast.success(lang === "nl"
            ? "Account aangemaakt! Controleer je e-mail om je account te bevestigen."
            : "Account created! Check your email to confirm your account.");
        }
      }
    } catch (err: any) {
      triggerError(err.message || t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl bg-card border border-border pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground";
  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  if (view === "forgot") {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4">
              <img src={logoUprising} alt="Uprising Studio" className="h-16 w-16 object-contain" />
            </div>
            <h1 className="text-2xl font-bold font-display">{t("forgotPassword")}</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">{t("enterEmailReset")}</p>
          </div>

          {resetSent ? (
            <div className="text-center space-y-4">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-5">
                <Mail size={24} className="text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">{t("checkInbox")}</p>
              </div>
              <button onClick={() => { setView("auth"); setResetSent(false); }} className="text-sm text-primary font-semibold">
                {t("backToLogin")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-3" data-toast-section>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required className={inputClass} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] disabled:opacity-60">
                {loading ? <Loader2 size={18} className="animate-spin" /> : (<>{t("sendResetLink")}<ArrowRight size={16} /></>)}
              </button>
              <button type="button" onClick={() => setView("auth")} className="w-full text-center text-sm text-primary font-semibold py-2">
                {t("backToLogin")}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4">
            <img src={logoUprising} alt="Uprising Studio" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold font-display">Uprising Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("yourCreativePlatform")}</p>
        </div>

        <div className="flex rounded-xl bg-secondary p-1 mb-6">
          <button onClick={() => { setIsLogin(true); setLoginError(""); }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            {t("loginTab")}
          </button>
          <button onClick={() => { setIsLogin(false); setLoginError(""); }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${!isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            {t("signUpTab")}
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className={`space-y-3 ${shakeForm ? "animate-shake" : ""}`} data-toast-section>
          {loginError && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive font-medium text-center">
              {loginError}
            </motion.div>
          )}
          {!isLogin && (
            <>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setLoginError(""); }}
                  placeholder={`${t("fullNamePlaceholder")} *`} required={!isLogin} className={inputClass} />
              </div>

              <div className="relative flex gap-0">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                <div className="relative">
                  <button type="button" onClick={() => setShowCountryCodes(!showCountryCodes)}
                    className="flex items-center gap-1 rounded-l-xl bg-card border border-border border-r-0 pl-11 pr-2 py-3.5 text-sm font-medium hover:bg-secondary/50 transition-colors">
                    <span>{selectedCountry.flag}</span>
                    <span className="text-muted-foreground text-xs">{selectedCountry.code}</span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>
                  {showCountryCodes && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                      {COUNTRY_CODES.map((c) => (
                        <button key={c.code} type="button" onClick={() => { setCountryCode(c.code); setShowCountryCodes(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/50 transition-colors ${countryCode === c.code ? "bg-primary/10 text-primary font-semibold" : ""}`}>
                          <span>{c.flag}</span><span>{c.label}</span><span className="text-muted-foreground ml-auto">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s\-]/g, ""))}
                  placeholder={`${t("phoneNumberPlaceholder")} *`} required
                  className="flex-1 rounded-r-xl bg-card border border-border border-l-0 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
              </div>

              <div className="relative">
                <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <div className="flex rounded-xl bg-card border border-border overflow-hidden">
                  <button type="button" onClick={() => setLangPref("nl")}
                    className={`flex-1 py-3.5 text-sm font-semibold transition-all pl-11 ${langPref === "nl" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    Nederlands
                  </button>
                  <button type="button" onClick={() => setLangPref("en")}
                    className={`flex-1 py-3.5 text-sm font-semibold transition-all ${langPref === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    English
                  </button>
                </div>
              </div>
            </>
          )}
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setLoginError(""); }} placeholder="E-mail" required className={inputClass} />
          </div>
          <div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                placeholder={t("password")} required minLength={6} className={inputClass} />
            </div>
            {!isLogin && (
              <ul className="mt-1.5 ml-1 space-y-0.5 text-[10px] text-muted-foreground">
                <li className={password.length >= 8 ? "text-success" : ""}>{t("minChars")}</li>
                <li className={/[A-Z]/.test(password) ? "text-success" : ""}>{t("minUppercase")}</li>
                <li className={/[0-9]/.test(password) ? "text-success" : ""}>{t("minNumber")}</li>
                <li className={/[^A-Za-z0-9]/.test(password) ? "text-success" : ""}>{t("minSpecial")}</li>
              </ul>
            )}
          </div>

          {isLogin && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <button type="button" onClick={() => setRememberMe(!rememberMe)}
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${rememberMe ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                  {rememberMe && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className="text-xs text-muted-foreground">{t("rememberMe")}</span>
              </label>
              <button type="button" onClick={() => setView("forgot")} className="text-xs text-primary font-semibold hover:underline">
                {t("forgotPasswordQ")}
              </button>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] disabled:opacity-60">
            {loading ? <Loader2 size={18} className="animate-spin" /> : (
              <>{isLogin ? t("loginTab") : t("createAccount")}<ArrowRight size={16} /></>
            )}
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t("or")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button type="button" onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
              if (error) toast.error(error.message || "Google sign-in failed");
            }}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-card border border-border py-3.5 text-sm font-semibold hover:bg-secondary/50 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t("continueWithGoogle")}
          </button>

          <button type="button" onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
              if (error) toast.error(error.message || "Apple sign-in failed");
            }}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-card border border-border py-3.5 text-sm font-semibold hover:bg-secondary/50 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {t("continueWithApple")}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AuthPage;
