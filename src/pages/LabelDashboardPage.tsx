import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Building2, Clock, Users, Plus, Loader2, CalendarDays, FileText, Download,
  ChevronRight, Mic, X, Check, TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabelAccess } from "@/hooks/useLabelAccess";
import { inlineToast as toast } from "@/components/InlineToast";
import { PageSkeleton } from "@/components/PageSkeleton";
import SEO from "@/components/SEO";

interface Label {
  id: string; name: string; hours_balance: number; default_rate: number; contact_email: string | null;
}
interface Artist { id: string; name: string; user_id: string | null; active: boolean; }
interface Booking { id: string; studio_id: string; booking_date: string; start_time: string; duration_hours: number; status: string; label_artist_id: string | null; }
interface Invoice { id: string; invoice_number: string; hours: number; total: number; status: string; term: string | null; created_at: string; pdf_path: string | null; }

const STUDIOS = [
  { id: "studio-1", label: "Studio 1" },
  { id: "studio-2", label: "Studio 2" },
  { id: "content-room", label: "Content Room" },
];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);
const studioName = (id: string) => STUDIOS.find((s) => s.id === id)?.label || id;

const LabelDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { labelId, loading: accessLoading } = useLabelAccess();
  const [label, setLabel] = useState<Label | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBook, setShowBook] = useState(false);
  const [showAddArtist, setShowAddArtist] = useState(false);
  const [newArtist, setNewArtist] = useState("");
  const [addingArtist, setAddingArtist] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!labelId) return;
    const [labelRes, artistsRes, bookingsRes, ledgerRes, invoicesRes] = await Promise.all([
      supabase.from("labels").select("id, name, hours_balance, default_rate, contact_email").eq("id", labelId).single(),
      supabase.from("label_artists").select("*").eq("label_id", labelId).eq("active", true).order("name"),
      supabase.from("bookings").select("id, studio_id, booking_date, start_time, duration_hours, status, label_artist_id").eq("label_id", labelId).order("booking_date", { ascending: false }).limit(50),
      supabase.from("label_hour_transactions").select("artist_id, hours, type").eq("label_id", labelId).eq("type", "usage"),
      supabase.from("label_invoices").select("id, invoice_number, hours, total, status, term, created_at, pdf_path").eq("label_id", labelId).order("created_at", { ascending: false }),
    ]);
    setLabel(labelRes.data as Label);
    setArtists((artistsRes.data as Artist[]) || []);
    setBookings((bookingsRes.data as Booking[]) || []);
    setInvoices((invoicesRes.data as Invoice[]) || []);
    // Per-artist hours used (usage rows are negative)
    const map = new Map<string, number>();
    for (const tx of (ledgerRes.data as { artist_id: string | null; hours: number }[]) || []) {
      const key = tx.artist_id || "none";
      map.set(key, (map.get(key) || 0) + Math.abs(Number(tx.hours)));
    }
    setUsage(map);
    setLoading(false);
  }, [labelId]);

  useEffect(() => { if (labelId) load(); else if (!accessLoading) setLoading(false); }, [labelId, accessLoading, load]);

  const addArtist = async () => {
    if (!labelId || !newArtist.trim() || addingArtist) return;
    setAddingArtist(true);
    const { error } = await supabase.from("label_artists").insert({ label_id: labelId, name: newArtist.trim() });
    setAddingArtist(false);
    if (error) toast.error("Toevoegen mislukt");
    else { toast.success("Artiest toegevoegd"); setNewArtist(""); setShowAddArtist(false); load(); }
  };

  const downloadInvoice = async (invoiceId: string) => {
    if (downloadingId) return;
    // Open the tab synchronously (inside the click) so mobile/Safari popup
    // blockers don't kill it after the await.
    const tab = window.open("", "_blank");
    setDownloadingId(invoiceId);
    const { data, error } = await supabase.functions.invoke("label-invoice", { body: { action: "get_pdf", invoice_id: invoiceId } });
    setDownloadingId(null);
    if (error || data?.error || !data?.url) {
      if (tab) tab.close();
      toast.error(data?.error || "Geen PDF beschikbaar");
    } else if (tab) {
      tab.location.href = data.url;
    } else {
      // Popup was blocked before we could open — fall back to same-tab.
      window.location.href = data.url;
    }
  };

  const cancelLabelBooking = async (bookingId: string) => {
    if (cancellingId) return;
    if (!window.confirm("Sessie annuleren? De uren gaan terug naar de pot.")) return;
    setCancellingId(bookingId);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-booking", { body: { booking_id: bookingId } });
      if (error || data?.error) {
        toast.error(data?.error || "Annuleren mislukt — probeer opnieuw.");
        return;
      }
      toast.success("Geannuleerd — uren terug in de pot");
      load();
    } finally {
      setCancellingId(null);
    }
  };

  const { upcoming, past } = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      upcoming: bookings.filter((b) => b.status === "confirmed" && b.booking_date >= today),
      past: bookings.filter((b) => b.status !== "confirmed" || b.booking_date < today),
    };
  }, [bookings]);

  if (accessLoading || loading) return <PageSkeleton />;

  if (!labelId || !label) {
    return (
      <div className="min-h-full flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <Building2 size={40} className="mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Geen label aan dit account gekoppeld. Neem contact op met Uprising Studio.</p>
        </div>
      </div>
    );
  }

  const artistName = (id: string | null) => (id ? artists.find((a) => a.id === id)?.name : null) || "—";
  const lowBalance = label.hours_balance <= 5;

  return (
    <div className="min-h-full pb-28">
      <SEO title={`${label.name} — Label Dashboard`} description="Beheer je studio-uren, artiesten en facturen." path="/label" />
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary shadow-glow">
            <Building2 size={22} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display">{label.name}</h1>
            <p className="text-xs text-muted-foreground">Label dashboard</p>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* Pool balance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`card-premium rounded-2xl border p-5 ${lowBalance ? "border-warning/40" : "border-border"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock size={13} /> Uren in de pot</p>
              <p className={`text-4xl font-bold font-display mt-1 ${lowBalance ? "text-warning" : "text-primary"}`}>{label.hours_balance}<span className="text-lg text-muted-foreground"> uur</span></p>
            </div>
            <button onClick={() => setShowBook(true)}
              className="rounded-xl gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground flex items-center gap-2 active:scale-[0.97]">
              <CalendarDays size={16} /> Boeken
            </button>
          </div>
          {lowBalance && <p className="mt-3 text-xs text-warning">Bijna op — Uprising Studio kan een nieuwe termijn factureren.</p>}
        </motion.div>

        {/* Per-artist usage */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5"><Users size={15} className="text-primary" /> Verbruik per artiest</h2>
            <button onClick={() => setShowAddArtist(true)} className="text-xs font-semibold text-primary flex items-center gap-1"><Plus size={13} /> Artiest</button>
          </div>
          {artists.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-xl bg-card border border-border p-4">Nog geen artiesten. Voeg er een toe om sessies te boeken.</p>
          ) : (
            <div className="space-y-1.5">
              {artists.map((a) => {
                const used = usage.get(a.id) || 0;
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl card-premium border border-border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 shrink-0"><Mic size={15} className="text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingDown size={11} /> {used} uur gebruikt</p>
                    </div>
                  </div>
                );
              })}
              {(usage.get("none") || 0) > 0 && (
                <div className="flex items-center gap-3 rounded-xl bg-card border border-border p-3 opacity-70">
                  <div className="flex-1"><p className="text-sm">Niet toegewezen</p></div>
                  <p className="text-[11px] text-muted-foreground">{usage.get("none")} uur</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Upcoming sessions */}
        <section>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CalendarDays size={15} className="text-primary" /> Komende sessies</h2>
          {upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-xl bg-card border border-border p-4">Geen komende sessies.</p>
          ) : (
            <div className="space-y-1.5">
              {upcoming.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl bg-card border border-primary/20 p-3">
                  <div>
                    <p className="text-sm font-semibold">{studioName(b.studio_id)} · {artistName(b.label_artist_id)}</p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(b.booking_date), "d MMM", { locale: nl })} • {b.start_time} • {b.duration_hours}u</p>
                  </div>
                  <button onClick={() => cancelLabelBooking(b.id)} disabled={cancellingId === b.id}
                    className="text-xs font-semibold text-destructive disabled:opacity-50">
                    {cancellingId === b.id ? "Bezig…" : "Annuleer"}</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Invoices */}
        {invoices.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FileText size={15} className="text-primary" /> Facturen</h2>
            <div className="space-y-1.5">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-xl card-premium border border-border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{inv.invoice_number}</p>
                    <p className="text-[11px] text-muted-foreground">{inv.hours}u • €{Number(inv.total).toFixed(2)} • <span className={inv.status === "paid" ? "text-success" : inv.status === "sent" ? "text-primary" : "text-muted-foreground"}>{inv.status}</span></p>
                  </div>
                  {inv.pdf_path && (
                    <button onClick={() => downloadInvoice(inv.id)} disabled={downloadingId === inv.id} className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
                      {downloadingId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Past sessions */}
        {past.length > 0 && (
          <details className="rounded-xl bg-card border border-border p-3">
            <summary className="text-sm font-semibold cursor-pointer">Historie ({past.length})</summary>
            <div className="mt-2 space-y-1">
              {past.slice(0, 20).map((b) => (
                <div key={b.id} className="flex items-center justify-between text-xs text-muted-foreground py-1">
                  <span>{studioName(b.studio_id)} · {artistName(b.label_artist_id)}</span>
                  <span>{format(new Date(b.booking_date), "d MMM", { locale: nl })} • {b.duration_hours}u • {b.status}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {showBook && <BookSheet label={label} artists={artists} onClose={() => setShowBook(false)} onBooked={() => { setShowBook(false); load(); }} />}
      {showAddArtist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-6" onClick={() => setShowAddArtist(false)}>
          <div className="animate-fade-in rounded-2xl card-premium border border-border p-5 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold">Artiest toevoegen</h3>
            <input value={newArtist} onChange={(e) => setNewArtist(e.target.value)} placeholder="Naam artiest" autoFocus
              className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" onKeyDown={(e) => e.key === "Enter" && addArtist()} />
            <div className="flex gap-2">
              <button onClick={() => setShowAddArtist(false)} className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium">Terug</button>
              <button onClick={addArtist} disabled={!newArtist.trim() || addingArtist} className="flex-1 rounded-xl gradient-primary py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50">
                {addingArtist && <Loader2 size={14} className="animate-spin" />} Toevoegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BookSheet = ({ label, artists, onClose, onBooked }: { label: Label; artists: Artist[]; onClose: () => void; onBooked: () => void }) => {
  const [studio, setStudio] = useState("studio-1");
  const [artistId, setArtistId] = useState(artists[0]?.id || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dateOptions = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { value: format(d, "yyyy-MM-dd"), label: format(d, "EEE d MMM", { locale: nl }) };
  });

  const book = async () => {
    if (!date || !time) { setError("Kies datum en tijd"); return; }
    if (duration > label.hours_balance) { setError("Niet genoeg uren in de pot"); return; }
    setLoading(true); setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("label-book", {
        body: { label_id: label.id, artist_id: artistId || null, studio_id: studio, booking_date: date, start_time: time, duration_hours: duration },
      });
      if (fnErr || data?.error) throw new Error(data?.error || "Boeken mislukt");
      toast.success("Sessie geboekt! 🎙️");
      onBooked();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="animate-slide-up rounded-2xl card-premium border border-border p-5 max-w-sm w-full space-y-3 mb-4 sm:mb-0 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-base">Sessie boeken</h3>
          <button onClick={onClose} className="p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground">{label.hours_balance} uur beschikbaar in de pot</p>

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Artiest</label>
          {artists.length === 0 ? (
            <p className="text-xs text-warning">Voeg eerst een artiest toe.</p>
          ) : (
            <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm">
              {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Ruimte</label>
          <div className="grid grid-cols-3 gap-2">
            {STUDIOS.map((s) => (
              <button key={s.id} onClick={() => setStudio(s.id)}
                className={`rounded-lg py-2 text-xs font-semibold ${studio === s.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{s.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Datum</label>
          <select value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm">
            <option value="">Kies een datum</option>
            {dateOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Starttijd</label>
          <div className="grid grid-cols-6 gap-1.5">
            {HOURS.map((h) => (
              <button key={h} onClick={() => setTime(h)}
                className={`rounded-lg py-1.5 text-[11px] font-medium ${time === h ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{h}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Duur: {duration} uur</label>
          <input type="range" min={2} max={12} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
        </div>

        {error && <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">{error}</div>}

        <button onClick={book} disabled={loading || artists.length === 0}
          className="w-full rounded-xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Boek {duration}u uit de pot
        </button>
      </div>
    </div>
  );
};

export default LabelDashboardPage;
