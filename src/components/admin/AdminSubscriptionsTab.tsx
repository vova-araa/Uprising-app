import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ChevronRight, DollarSign, Users, TrendingUp,
  RefreshCw, Crown, ArrowLeft, ExternalLink, Download,
  Calendar, CheckCircle2, XCircle, Clock, AlertTriangle,
  CreditCard, BarChart3, Search, Filter
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { inlineToast as toast } from "@/components/InlineToast";

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface SubMember {
  subscription_id?: string;
  email: string;
  name: string;
  product_name: string;
  amount: number;
  interval: string;
  status: string;
  subscription_end: string | null;
  created: string | null;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  source?: string;
}

interface SubDetail {
  subscription: any;
  customer: any;
  product: any;
  price: any;
  invoices: any[];
  total_paid: number;
  months_paid: number;
  events: any[];
}

const AdminSubscriptionsTab = () => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<SubMember[]>([]);
  const [canceledMembers, setCanceledMembers] = useState<SubMember[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [canceledCount, setCanceledCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "admin" | "canceled">("all");

  // Detail view
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { loadSubscriptions(); }, []);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-subscriptions");
      if (error) throw error;
      setMembers(data.all_members || []);
      setCanceledMembers(data.canceled_members || []);
      setMonthlyRevenue(data.monthly_revenue || 0);
      setActiveCount(data.active_count || 0);
      setCanceledCount(data.canceled_count || 0);
    } catch {
      toast.error("Abonnementen laden mislukt");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (subscriptionId: string) => {
    setSelectedSub(subscriptionId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        `admin-subscriptions?subscription_id=${subscriptionId}`,
        { method: "GET" }
      );
      if (error) throw error;
      setDetail(data);
    } catch {
      toast.error("Details laden mislukt");
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  // Detail view
  if (selectedSub) {
    return (
      <div className="space-y-4" data-toast-section>
        <button
          onClick={() => { setSelectedSub(null); setDetail(null); }}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft size={14} /> Terug naar overzicht
        </button>

        {detailLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : detail ? (
          <>
            {/* Header card */}
            <div className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold">{detail.customer.name || detail.customer.email}</h2>
                  <p className="text-[10px] text-muted-foreground">{detail.customer.email}</p>
                </div>
                <span className={`text-[9px] font-semibold rounded-full px-2.5 py-1 ${
                  detail.subscription.status === "active" ? "bg-success/20 text-success" :
                  detail.subscription.status === "canceled" ? "bg-destructive/20 text-destructive" :
                  "bg-warning/20 text-warning"
                }`}>
                  {detail.subscription.status === "active" ? "Actief" :
                   detail.subscription.status === "canceled" ? "Opgezegd" : detail.subscription.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  <p className="text-[9px] text-muted-foreground">Product</p>
                  <p className="text-xs font-bold">{detail.product.name}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  <p className="text-[9px] text-muted-foreground">Bedrag</p>
                  <p className="text-xs font-bold">€{detail.price.amount}/{detail.price.interval === "month" ? "mnd" : "jaar"}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  <p className="text-[9px] text-muted-foreground">Totaal betaald</p>
                  <p className="text-xs font-bold text-success">€{detail.total_paid.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2.5">
                  <p className="text-[9px] text-muted-foreground">Maanden betaald</p>
                  <p className="text-xs font-bold">{detail.months_paid}</p>
                </div>
              </div>

              {/* Subscription details */}
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Aangemaakt</span>
                  <span className="font-medium">{format(new Date(detail.subscription.created), "d MMM yyyy", { locale: nl })}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Huidige periode</span>
                  <span className="font-medium">
                    {format(new Date(detail.subscription.current_period_start), "d MMM", { locale: nl })} – {format(new Date(detail.subscription.current_period_end), "d MMM yyyy", { locale: nl })}
                  </span>
                </div>
                {detail.subscription.cancel_at_period_end && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-destructive font-semibold">⚠️ Stopt na huidige periode</span>
                  </div>
                )}
                {detail.subscription.canceled_at && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Opgezegd op</span>
                    <span className="font-medium text-destructive">{format(new Date(detail.subscription.canceled_at), "d MMM yyyy HH:mm", { locale: nl })}</span>
                  </div>
                )}
                {detail.subscription.trial_end && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Proefperiode tot</span>
                    <span className="font-medium">{format(new Date(detail.subscription.trial_end), "d MMM yyyy", { locale: nl })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Invoices / Payment History */}
            <div className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard size={14} className="text-primary" />
                  Betaalgeschiedenis ({detail.invoices.length} facturen)
                </h3>
              </div>
              <div className="divide-y divide-border">
                {detail.invoices.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Geen facturen gevonden</p>
                ) : (
                  detail.invoices.map((inv: any) => (
                    <div key={inv.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                        inv.status === "paid" ? "bg-success/20" :
                        inv.status === "open" ? "bg-warning/20" : "bg-destructive/20"
                      }`}>
                        {inv.status === "paid" ? <CheckCircle2 size={12} className="text-success" /> :
                         inv.status === "open" ? <Clock size={12} className="text-warning" /> :
                         <XCircle size={12} className="text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{inv.number || inv.id.slice(0, 20)}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {inv.created ? format(new Date(inv.created), "d MMM yyyy HH:mm", { locale: nl }) : "—"}
                          {inv.period_start && inv.period_end && (
                            <> • Periode: {format(new Date(inv.period_start), "d MMM", { locale: nl })} – {format(new Date(inv.period_end), "d MMM yyyy", { locale: nl })}</>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold">€{inv.amount_paid.toFixed(2)}</p>
                        <span className={`text-[8px] font-semibold rounded-full px-1.5 py-0.5 ${
                          inv.status === "paid" ? "bg-success/20 text-success" :
                          inv.status === "open" ? "bg-warning/20 text-warning" :
                          "bg-destructive/20 text-destructive"
                        }`}>
                          {inv.status === "paid" ? "Betaald" : inv.status === "open" ? "Open" : inv.status}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {inv.hosted_invoice_url && (
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                            <ExternalLink size={10} className="text-muted-foreground" />
                          </a>
                        )}
                        {inv.invoice_pdf && (
                          <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                            <Download size={10} className="text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Event Timeline */}
            <div className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 size={14} className="text-primary" />
                  Tijdlijn
                </h3>
              </div>
              <div className="px-4 py-3">
                <div className="relative">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                  {detail.events.map((evt: any, i: number) => (
                    <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                      <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                        evt.type === "created" ? "bg-primary/20" :
                        evt.type === "payment_success" ? "bg-success/20" :
                        evt.type === "payment_pending" ? "bg-warning/20" :
                        "bg-destructive/20"
                      }`}>
                        {evt.type === "created" ? <Calendar size={10} className="text-primary" /> :
                         evt.type === "payment_success" ? <CheckCircle2 size={10} className="text-success" /> :
                         evt.type === "payment_pending" ? <Clock size={10} className="text-warning" /> :
                         <XCircle size={10} className="text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-xs font-semibold">{evt.description}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {evt.date ? format(new Date(evt.date), "d MMM yyyy HH:mm", { locale: nl }) : "—"}
                          {evt.amount ? ` • €${evt.amount.toFixed(2)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-6">Geen details gevonden</p>
        )}
      </div>
    );
  }

  // Filter & search
  const displayMembers = filterType === "canceled"
    ? canceledMembers
    : members.filter(m => {
        if (filterType === "active") return m.status === "active";
        if (filterType === "admin") return m.source === "admin" || m.status === "admin_assigned";
        return true;
      });

  const filtered = displayMembers.filter(m =>
    !searchQuery ||
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const yearlyRevenue = monthlyRevenue * 12;

  return (
    <div className="space-y-4" data-toast-section>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold font-display">💳 Actieve Abonnementen</h2>
          <p className="text-[10px] text-muted-foreground">Overzicht van alle abonnementen en inkomsten</p>
        </div>
        <button onClick={loadSubscriptions} className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={12} /> Vernieuw
        </button>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/20">
              <DollarSign size={12} className="text-success" />
            </div>
            <p className="text-[9px] text-muted-foreground">Maandomzet</p>
          </div>
          <p className="text-lg font-bold text-success">€{monthlyRevenue.toFixed(0)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
              <TrendingUp size={12} className="text-primary" />
            </div>
            <p className="text-[9px] text-muted-foreground">Jaarprognose</p>
          </div>
          <p className="text-lg font-bold text-primary">€{yearlyRevenue.toFixed(0)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
              <Users size={12} className="text-primary" />
            </div>
            <p className="text-[9px] text-muted-foreground">Actief</p>
          </div>
          <p className="text-lg font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/20">
              <XCircle size={12} className="text-destructive" />
            </div>
            <p className="text-[9px] text-muted-foreground">Opgezegd</p>
          </div>
          <p className="text-lg font-bold text-destructive">{canceledCount}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek op naam, e-mail of product..."
            className="w-full rounded-xl bg-card border border-border pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { id: "all" as const, label: "Alles", count: members.length },
            { id: "active" as const, label: "Actief", count: members.filter(m => m.status === "active").length },
            { id: "admin" as const, label: "Toegewezen", count: members.filter(m => m.source === "admin" || m.status === "admin_assigned").length },
            { id: "canceled" as const, label: "Opgezegd", count: canceledCount },
          ]).map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-all ${
                filterType === f.id
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Subscription List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Geen abonnementen gevonden</p>
        ) : (
          filtered.map((m, i) => (
            <motion.div key={m.subscription_id || m.email + i} variants={item}>
              <button
                onClick={() => m.subscription_id ? loadDetail(m.subscription_id) : null}
                disabled={!m.subscription_id}
                className="w-full rounded-xl bg-card border border-border p-3 flex items-center gap-3 text-left hover:bg-secondary/30 transition-colors disabled:opacity-70 disabled:cursor-default"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                  m.status === "active" ? "bg-success/20" :
                  m.status === "canceled" ? "bg-destructive/20" :
                  "bg-primary/20"
                }`}>
                  <Crown size={14} className={
                    m.status === "active" ? "text-success" :
                    m.status === "canceled" ? "text-destructive" :
                    "text-primary"
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{m.name}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{m.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                      {m.product_name}
                    </span>
                    {m.cancel_at_period_end && (
                      <span className="text-[8px] bg-warning/20 text-warning rounded-full px-1.5 py-0.5 font-semibold flex items-center gap-0.5">
                        <AlertTriangle size={8} /> Stopt binnenkort
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold">€{m.amount}</p>
                  <p className="text-[9px] text-muted-foreground">/{m.interval === "month" ? "mnd" : "jaar"}</p>
                  {m.created && (
                    <p className="text-[8px] text-muted-foreground mt-0.5">
                      Sinds {format(new Date(m.created), "MMM yyyy", { locale: nl })}
                    </p>
                  )}
                </div>
                {m.subscription_id && (
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                )}
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminSubscriptionsTab;
