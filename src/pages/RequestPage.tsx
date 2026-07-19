import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Send, ChevronLeft, Check, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { inlineToast as toast } from "@/components/InlineToast";
import AuthGateDialog from "@/components/AuthGateDialog";

const RequestPage = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedType = searchParams.get("type") || "";

  const serviceTypes = [
    { id: "photography", label: t("photographyContent") },
    { id: "clothing", label: t("customClothing") },
    { id: "merch", label: t("merchManagement") },
    { id: "business", label: t("business") },
    { id: "other", label: t("other") },
  ];

  const [selectedType, setSelectedType] = useState(preselectedType);
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      setShowAuthGate(true);
      return;
    }
    if (!selectedType) {
      toast.error(t("selectServiceType"));
      return;
    }
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t("invalidEmailFormat"));
      return;
    }
    if (!description.trim()) {
      toast.error(t("descriptionRequired"));
      return;
    }

    setIsLoading(true);
    try {
      if (user) {
        await (supabase as any).from("content_requests").insert({
          user_id: user.id,
          request_type: selectedType,
          description: `${t("nameLabel")}: ${name}\nEmail: ${email}\n${t("phoneNumber")}: ${phone}\n${t("budgetIndication")}: ${budget}\n\n${description}`,
          preferred_date: preferredDate || null,
          location_preference: null,
        });
      }

      await supabase.functions.invoke("send-service-request", {
        body: { type: selectedType, name, email, phone, description, budget, preferred_date: preferredDate },
      });

      setSubmitted(true);
      toast.success(t("requestSent"));
    } catch (err) {
      console.error(err);
      toast.error(t("somethingWentWrongRetry"));
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-full px-5 pt-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-card border border-border p-8 text-center mt-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full gradient-primary mb-4">
            <Check size={28} className="text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold font-display mb-2">{t("requestSent")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("requestReceivedDesc")}</p>
          <button onClick={() => navigate("/")}
            className="w-full rounded-xl gradient-primary py-3 font-semibold text-primary-foreground active:scale-[0.98]">
            {t("backToHome")}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <AuthGateDialog
        open={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        onAuthenticated={() => { setShowAuthGate(false); }}
        context="service"
      />
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-xl" style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-lg font-bold font-display">{t("requestService")}</h1>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5 pb-28" data-toast-section>
        <div>
          <label className="text-sm font-medium mb-2 block">{t("serviceType")} *</label>
          <div className="space-y-2">
            {serviceTypes.map((type) => (
              <button key={type.id} onClick={() => setSelectedType(type.id)}
                className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  selectedType === type.id ? "border-primary shadow-glow" : "border-border hover:border-primary/30"
                }`}>
                <div className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  selectedType === type.id ? "gradient-primary" : "border-2 border-muted-foreground/30"
                }`}>
                  {selectedType === type.id && <Check size={12} className="text-primary-foreground" />}
                </div>
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("nameLabel")} *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-card border border-border p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            placeholder={t("fullName")} />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">E-mail *</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
            className="w-full rounded-xl bg-card border border-border p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            placeholder="email@voorbeeld.nl" />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("phoneNumber")}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
            className="w-full rounded-xl bg-card border border-border p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            placeholder="+31 6 12345678" />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("descriptionOfRequest")} *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl bg-card border border-border p-4 text-sm resize-none h-28 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            placeholder={t("describeWhatYouNeed")} />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("budgetIndication")}</label>
          <input value={budget} onChange={(e) => setBudget(e.target.value)}
            className="w-full rounded-xl bg-card border border-border p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            placeholder="€200 - €2500" />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("preferredDate")}</label>
          <input value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} type="date"
            className="w-full rounded-xl bg-card border border-border p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
        </div>
      </div>

      <div
        className="fixed left-0 right-0 z-40 pb-2"
        style={{
          bottom: "var(--bottom-nav-total-offset)",
          paddingLeft: "calc(var(--safe-area-left) + 1.25rem)",
          paddingRight: "calc(var(--safe-area-right) + 1.25rem)",
        }}
      >
        <button onClick={handleSubmit} disabled={isLoading}
          className="w-full rounded-xl gradient-primary py-4 text-center font-bold text-primary-foreground active:scale-[0.98] shadow-glow flex items-center justify-center gap-2 disabled:opacity-50">
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : (
            <>
              <Send size={16} />
              {t("sendRequest")}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RequestPage;
