import { useState } from "react";
import { Gift, Loader2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { redirectToExternal } from "@/lib/redirect";
import { inlineToast as toast } from "@/components/InlineToast";

const PRESETS = [25, 50, 100];

const GiftCardSection = ({ onRedeemed }: { onRedeemed?: () => void }) => {
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [buying, setBuying] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const buy = async () => {
    const amt = custom ? parseInt(custom, 10) : amount;
    if (!amt || amt < 5 || amt > 500) { toast.error("Kies een bedrag tussen €5 en €500"); return; }
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gift-card", {
        body: { amount: amt, recipient_email: recipient.trim() || null, message: message.trim() || null },
      });
      if (error || data?.error) throw new Error(data?.error || "Aanmaken mislukt");
      if (data?.url) redirectToExternal(data.url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBuying(false);
    }
  };

  const redeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-gift-card", { body: { code: redeemCode.trim() } });
      if (error || data?.error) throw new Error(data?.error || "Inwisselen mislukt");
      toast.success(`€${data.amount} tegoed toegevoegd! 🎁`);
      setRedeemCode("");
      onRedeemed?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="rounded-xl bg-card border border-border p-5 space-y-4" data-toast-section>
      <div className="flex items-center gap-2">
        <Gift size={16} className="text-primary" />
        <h3 className="font-semibold font-display text-sm">Cadeaubonnen</h3>
      </div>

      {/* Redeem */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Heb je een cadeaubon-code?</p>
        <div className="flex items-center gap-2">
          <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder="GIFT-XXXX-XXXX"
            className="flex-1 rounded-lg bg-secondary border border-border px-3 py-2 text-sm font-mono" />
          <button onClick={redeem} disabled={redeeming || !redeemCode.trim()}
            className="rounded-lg bg-primary/20 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50 flex items-center gap-1">
            {redeeming ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />} Inwisselen
          </button>
        </div>
      </div>

      {/* Buy */}
      {!expanded ? (
        <button onClick={() => setExpanded(true)} className="w-full rounded-lg bg-secondary py-2.5 text-sm font-semibold text-foreground">
          Cadeaubon kopen →
        </button>
      ) : (
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground">Cadeaubon kopen</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => { setAmount(p); setCustom(""); }}
                className={`rounded-lg py-2 text-sm font-semibold ${!custom && amount === p ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>€{p}</button>
            ))}
            <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} placeholder="€.." inputMode="numeric"
              className="rounded-lg bg-secondary border border-border px-2 py-2 text-sm text-center" />
          </div>
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="E-mail ontvanger (optioneel)"
            className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Persoonlijk bericht (optioneel)"
            className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setExpanded(false)} className="flex-1 rounded-lg bg-secondary py-2.5 text-sm font-medium">Terug</button>
            <button onClick={buy} disabled={buying} className="flex-1 rounded-lg gradient-primary py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50">
              {buying ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />} Kopen — €{custom || amount}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftCardSection;
