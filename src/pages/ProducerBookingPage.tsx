import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { redirectToExternal } from "@/lib/redirect";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, Calendar, Clock, Loader2, CreditCard, AlertTriangle, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { inlineToast as toast } from "@/components/InlineToast";
import AuthGateDialog from "@/components/AuthGateDialog";
import { format } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const BASE_PRICE = 350;

const timeOptions = Array.from({ length: 14 }, (_, i) => {
  const h = i + 9;
  return `${h.toString().padStart(2, "0")}:00`;
});

const ProducerBookingPage = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const locale = lang === "nl" ? nl : enUS;

  const [date, setDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memberTier, setMemberTier] = useState<string | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkMembership = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data?.subscribed) {
          setMemberTier(data.plan || "basic");
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("membership").eq("id", user.id).single();
        if (profile?.membership) setMemberTier(profile.membership);
      } catch {}
    };
    checkMembership();
  }, [user]);


  const discount = memberTier === "unlimited" ? 0.2 : memberTier === "pro" ? 0.1 : 0;
  const finalPrice = Math.round(BASE_PRICE * (1 - discount));

  const handleSubmit = async () => {
    if (!user) {
      setShowAuthGate(true);
      return;
    }
    if (!date) {
      toast.error(t("selectDate"));
      return;
    }
    if (!time) {
      toast.error(t("preferredTime"));
      return;
    }

    setIsLoading(true);
    try {
      const { error: bookingError } = await (supabase as any).from("producer_bookings").insert({
        user_id: user.id,
        preferred_date: format(date, "yyyy-MM-dd"),
        preferred_time: time,
        description,
        status: "pending",
      });

      if (bookingError) throw bookingError;

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          booking_data: {
            type: "producer-session",
            date: format(date, "yyyy-MM-dd"),
            time,
            amount: finalPrice,
          },
        },
      });

      if (error) throw error;
      if (data?.url) {
        redirectToExternal(data.url);
      } else {
        throw new Error("No checkout URL");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t("paymentCreateError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <AuthGateDialog
        open={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        onAuthenticated={() => { setShowAuthGate(false); }}
        context="service"
      />
      <div className="glass hairline-top sticky top-0 z-40 border-b border-border px-5 py-4" style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label={lang === "nl" ? "Terug" : "Back"} className="p-1 -ml-1">
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 className="text-lg font-bold font-display">{t("bookProducerSession")}</h1>
            <p className="text-xs text-muted-foreground">
              {discount > 0 ? (
                <><span className="line-through">€{BASE_PRICE}</span> <span className="text-primary font-semibold">€{finalPrice}</span></>
              ) : (
                <>€{BASE_PRICE}</>
              )} {t("perSingle")}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5 pb-28" data-toast-section>
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <CreditCard size={18} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                {lang === "nl" ? `Vooruitbetaling van €${finalPrice}` : `Prepayment of €${finalPrice}`}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "nl"
                  ? "Bij het boeken van een producer sessie betaal je het volledige bedrag vooraf. De producer beoordeelt je aanvraag en bevestigt of wijst af."
                  : "When booking a producer session, you pay the full amount upfront. The producer will review your request and confirm or decline."}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "nl"
                ? `Bij afwijzing ontvang je €${finalPrice} tegoed op je account, die je kunt gebruiken voor een nieuwe sessie op een ander moment.`
                : `If declined, you'll receive €${finalPrice} credit on your account, which you can use for a new session at a different time.`}
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("preferredDate")}</label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 text-left transition-all hover:border-primary/30",
                !date && "text-muted-foreground"
              )}>
                <Calendar size={18} className="text-primary" />
                {date ? format(date, "EEEE d MMMM yyyy", { locale }) : t("selectDate")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="single" selected={date} onSelect={(d) => { setDate(d); setCalendarOpen(false); }} disabled={(d) => d < new Date()} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("preferredTime")}</label>
          <div className="grid grid-cols-4 gap-2">
            {timeOptions.map((timeOpt) => (
              <button key={timeOpt} onClick={() => setTime(timeOpt)}
                className={`flex items-center justify-center gap-1 rounded-xl py-3 text-sm font-semibold transition-all ${
                  time === timeOpt
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "bg-card border border-border hover:border-primary/30"
                }`}>
                <Clock size={12} />
                {timeOpt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">{t("describeProjectProducer")}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={t("genreReferencesGoal")}
            className="w-full rounded-xl bg-card border border-border p-4 text-sm resize-none h-28 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
        </div>

        {date && time ? (
          <button onClick={handleSubmit} disabled={isLoading}
            className="w-full rounded-xl gradient-primary text-primary-foreground shadow-glow p-4 text-left transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50">
            {isLoading ? (
              <div className="flex items-center justify-center py-2"><Loader2 size={20} className="animate-spin text-primary-foreground" /></div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-foreground/80">{t("producerSessionTitle")}</p>
                    <p className="font-semibold">{date ? format(date, "d MMMM", { locale }) : ""} · {time}</p>
                    <p className="text-xs text-primary-foreground/80">€{finalPrice} {t("prepaymentLabel")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">€{finalPrice}</p>
                    <p className="text-xs font-medium mt-1">{t("continueBtn")} →</p>
                  </div>
                </div>
                {discount > 0 && (
                  <p className="text-[10px] text-primary-foreground font-semibold mt-2 flex items-center justify-center gap-1">
                    <Crown size={10} /> {lang === "nl" ? `${discount * 100}% member korting` : `${discount * 100}% member discount`}
                  </p>
                )}
              </>
            )}
          </button>
        ) : (
          <button disabled
            className="w-full rounded-xl bg-secondary p-4 text-sm font-semibold text-muted-foreground disabled:opacity-70">
            {lang === "nl" ? "Kies eerst een datum & tijd" : "Pick a date & time first"}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProducerBookingPage;
