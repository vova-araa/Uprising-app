import { useState, useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, Minus, Clock, X, Loader2, Calendar as CalendarIcon, MapPin, Trash2, Users, Pencil, Link, Copy, Check, UserPlus, Phone, Mail, Home
} from "lucide-react";
import { format, addMonths, subMonths, addDays, startOfWeek, isSameDay, startOfDay } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import { inlineToast as toast } from "@/components/InlineToast";
import { studios } from "@/lib/data";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const GRID_ROOMS = [
  { id: "studio-1", label: "S1", color: "hsl(var(--primary))" },
  { id: "studio-2", label: "S2", color: "hsl(var(--primary) / 0.75)" },
  { id: "content-room", label: "CR", color: "hsl(var(--success))" },
];

const AdminCalendarPage = () => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const locale = lang === "nl" ? nl : enUS;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");

  // Week bookings for week view
  const [weekBookings, setWeekBookings] = useState<any[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [monthBookings, setMonthBookings] = useState<any[]>([]);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  // New booking form
  const [showForm, setShowForm] = useState(false);
  const [gridQuickBook, setGridQuickBook] = useState(false);
  const [formStudio, setFormStudio] = useState(studios[0].id);
  const [formTime, setFormTime] = useState("10:00");
  const [formDuration, setFormDuration] = useState(2);
  const [formNotes, setFormNotes] = useState("");
  const [showNotesField, setShowNotesField] = useState(false);
  const [formPaid, setFormPaid] = useState<"betaald" | "gratis" | "member">("betaald");
  const [submitting, setSubmitting] = useState(false);

  // Edit/detail booking
  const [editBooking, setEditBooking] = useState<any | null>(null);
  const [editDuration, setEditDuration] = useState(2);
  const [editNotes, setEditNotes] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editPaid, setEditPaid] = useState<"betaald" | "gratis" | "member">("betaald");
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Payment link
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const handleGenerateAndCopyLink = async (bookingId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setGeneratingLinkId(bookingId);
    try {
      const { data: linkData } = await supabase.functions.invoke("create-admin-payment-link", {
        body: { booking_id: bookingId },
      });
      if (linkData?.url) {
        await navigator.clipboard.writeText(linkData.url);
        setCopiedLinkId(bookingId);
        toast.success(lang === "nl" ? "Betaallink gekopieerd!" : "Payment link copied!");
        setTimeout(() => setCopiedLinkId(null), 3000);
      } else {
        toast.error(linkData?.error || "Error");
      }
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setGeneratingLinkId(null);
    }
  };

  // Customer picker
  const [customers, setCustomers] = useState<{ id: string; email: string; full_name: string | null }[]>([]);
  const [formCustomerId, setFormCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");

  // New client form
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientCity, setNewClientCity] = useState("");
  const [newClientPostalCode, setNewClientPostalCode] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const resetNewClientForm = () => {
    setShowNewClientForm(false);
    setNewClientName("");
    setNewClientEmail("");
    setNewClientPhone("");
    setNewClientAddress("");
    setNewClientCity("");
    setNewClientPostalCode("");
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim() || !newClientEmail.trim()) {
      toast.error(lang === "nl" ? "Naam en e-mail zijn verplicht" : "Name and email are required");
      return;
    }
    setCreatingClient(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-client", {
        body: {
          full_name: newClientName.trim(),
          email: newClientEmail.trim(),
          phone: newClientPhone.trim() || undefined,
          address: newClientAddress.trim() || undefined,
          city: newClientCity.trim() || undefined,
          postal_code: newClientPostalCode.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.user_id) {
        // Add to customers list and select
        const newCustomer = { id: data.user_id, email: newClientEmail.trim(), full_name: newClientName.trim() };
        setCustomers(prev => [newCustomer, ...prev]);
        setFormCustomerId(data.user_id);
        setCustomerSearch(newClientName.trim());
        resetNewClientForm();
        toast.success(
          data.existing
            ? (lang === "nl" ? "Bestaande klant gevonden en bijgewerkt" : "Existing client found and updated")
            : (lang === "nl" ? "Nieuwe klant aangemaakt!" : "New client created!")
        );
      }
    } catch (err: any) {
      console.error("Create client error:", err);
      toast.error(err.message || "Error");
    } finally {
      setCreatingClient(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const checkRole = async () => {
      const [adminRes, staffRes] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as const }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "staff" as const }),
      ]);
      setIsAdmin(adminRes.data === true || staffRes.data === true);
    };
    checkRole();
  }, [user]);

  const refreshBookings = async () => {
    if (!selectedDate) return;
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", dateStr)
      .in("status", ["pending", "confirmed"])
      .order("start_time", { ascending: true });
    if (!error) {
      setBookings(data || []);
      // Fetch profile names for list view
      const userIds = [...new Set((data || []).map((b: any) => b.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        const map: Record<string, string> = { ...profiles };
        (profs || []).forEach((p: any) => { map[p.id] = p.full_name || "?"; });
        setProfiles(map);
      }
    }
    setLoading(false);
  };

  // Week start (Monday)
  const weekStart = useMemo(() => {
    return startOfWeek(selectedDate, { weekStartsOn: 1 });
  }, [selectedDate]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Date strip: today first on the left, then 90 days ahead. Past days are reachable via the chevron arrows.
  const extendedDates = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 91 }, (_, i) => addDays(today, i));
  }, []);

  const refreshWeekBookings = async () => {
    setWeekLoading(true);
    const startStr = format(weekDates[0], "yyyy-MM-dd");
    const endStr = format(weekDates[6], "yyyy-MM-dd");
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .gte("booking_date", startStr)
      .lte("booking_date", endStr)
      .in("status", ["pending", "confirmed"])
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    setWeekBookings(data || []);

    const userIds = [...new Set((data || []).map((b: any) => b.user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p.full_name || "?"; });
      setProfiles(map);
    }

    setWeekLoading(false);
  };

  // Fetch bookings for week view
  useEffect(() => {
    if (viewMode !== "week" || !isAdmin) return;
    refreshWeekBookings();
  }, [viewMode, weekStart, isAdmin]);

  // Fetch bookings for selected date (list view)
  useEffect(() => {
    if (!selectedDate || !isAdmin) return;
    refreshBookings();
  }, [selectedDate, isAdmin]);

  // Fetch month bookings for calendar dots
  useEffect(() => {
    if (!isAdmin || viewMode !== "month") return;
    const fetchMonthBookings = async () => {
      const year = calendarMonth.getFullYear();
      const month = calendarMonth.getMonth();
      const firstDay = format(new Date(year, month, 1), "yyyy-MM-dd");
      const lastDay = format(new Date(year, month + 1, 0), "yyyy-MM-dd");
      const { data } = await supabase
        .from("bookings")
        .select("booking_date, studio_id, session_type")
        .gte("booking_date", firstDay)
        .lte("booking_date", lastDay)
        .in("status", ["pending", "confirmed"]);
      setMonthBookings(data || []);
    };
    fetchMonthBookings();
  }, [calendarMonth, isAdmin, viewMode]);

  // Load customers for picker
  useEffect(() => {
    if (!isAdmin) return;
    const loadCustomers = async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      if (data) {
        setCustomers(data.map(p => ({ id: p.id, email: "", full_name: p.full_name })));
      }
    };
    loadCustomers();
  }, [isAdmin]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [calendarMonth]);

  // Scroll to ~current hour on grid mount
  useEffect(() => {
    if (viewMode === "day" && gridScrollRef.current) {
      const now = new Date();
      const scrollTo = Math.max(0, (now.getHours() - 2)) * 56;
      gridScrollRef.current.scrollTop = scrollTo;
    }
  }, [viewMode]);

  // Keep month calendar synced with selected date
  useEffect(() => {
    setCalendarMonth((prev) => {
      const sameMonth = prev.getFullYear() === selectedDate.getFullYear() && prev.getMonth() === selectedDate.getMonth();
      return sameMonth ? prev : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    });
  }, [selectedDate]);

  // Auto-scroll date picker so the selected day starts at the left edge
  const hasInitialDayScrolled = useRef(false);
  const scrollDateIntoView = (dateStr: string, smooth: boolean, align: "start" | "center" = "start") => {
    if (!dateScrollRef.current) return;
    const el = dateScrollRef.current.querySelector(`[data-date="${dateStr}"]`) as HTMLElement;
    if (!el) return;
    const container = dateScrollRef.current;
    const scrollLeft = Math.max(
      0,
      align === "center"
        ? el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2
        : el.offsetLeft - 12,
    );
    if (smooth) {
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    } else {
      container.scrollLeft = scrollLeft;
    }
  };

  // Show today first on initial load, then keep the selected day anchored left
  useEffect(() => {
    if (viewMode !== "day") return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    if (!hasInitialDayScrolled.current) {
      // Use multiple frames + timeout to ensure DOM is fully laid out
      const tryScroll = () => {
        scrollDateIntoView(dateStr, false, "start");
        hasInitialDayScrolled.current = true;
      };
      requestAnimationFrame(() => requestAnimationFrame(tryScroll));
      // Fallback in case rAF fires too early
      setTimeout(tryScroll, 150);
    } else {
      scrollDateIntoView(dateStr, true, "start");
    }
  }, [selectedDate, viewMode]);

  const handleCreateBooking = async () => {
    if (!formCustomerId) {
      toast.error(lang === "nl" ? "Selecteer een klant" : "Select a customer");
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const studio = studios.find(s => s.id === formStudio);
      const totalPrice = formPaid === "betaald" ? (studio?.pricePerHour || 0) * formDuration : 0;
      const sessionType = formPaid === "gratis" ? "gratis" : formPaid === "member" ? "member" : "single";

      const { data: newBooking, error } = await supabase.from("bookings").insert({
        user_id: formCustomerId,
        studio_id: formStudio,
        booking_date: dateStr,
        start_time: formTime,
        duration_hours: formDuration,
        total_price: totalPrice,
        status: "confirmed",
        session_type: sessionType,
        notes: formNotes || null,
      }).select("id").single();

      if (error) throw error;


      toast.success(lang === "nl" ? "Sessie ingepland!" : "Session scheduled!");
      setShowForm(false);
      setGridQuickBook(false);
      setFormNotes("");
      setShowNotesField(false);
      setFormCustomerId("");
      setCustomerSearch("");
      resetNewClientForm();
      await refreshBookings();
      if (viewMode === "week") await refreshWeekBookings();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBooking = async (bookingId?: string) => {
    const idToDelete = bookingId || deleteId;
    if (!idToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("bookings").delete().eq("id", idToDelete);
      if (error) throw error;
      toast.success(lang === "nl" ? "Sessie verwijderd" : "Session deleted");
      setDeleteId(null);
      setEditBooking(null);
      await refreshBookings();
      if (viewMode === "week") await refreshWeekBookings();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editBooking) return;
    setEditSaving(true);
    try {
      const studio = studios.find(s => s.id === editBooking.studio_id);
      const newPrice = editPaid === "betaald" ? (studio?.pricePerHour || 0) * editDuration : 0;
      const sessionType = editPaid === "gratis" ? "gratis" : editPaid === "member" ? "member" : "single";
      const { error } = await supabase.from("bookings").update({
        start_time: editTime,
        duration_hours: editDuration,
        notes: editNotes || null,
        session_type: sessionType,
        total_price: newPrice,
      }).eq("id", editBooking.id);
      if (error) throw error;
      toast.success(lang === "nl" ? "Sessie bijgewerkt" : "Session updated");
      setEditBooking(null);
      await refreshBookings();
      if (viewMode === "week") await refreshWeekBookings();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setEditSaving(false);
    }
  };

  const allRooms = [
    { id: "studio-1", nl: "Studio 1", en: "Studio 1" },
    { id: "studio-2", nl: "Studio 2", en: "Studio 2" },
    { id: "content-room", nl: "Content Room", en: "Content Room" },
    { id: "print-shop", nl: "Drukkerij", en: "Print Shop" },
  ];

  const getStudioName = (id: string) => {
    const room = allRooms.find(r => r.id === id);
    return room ? room[lang] || room.nl : id;
  };

  const getRoomBookingCount = (roomId: string) => {
    return bookings.filter(b => b.studio_id === roomId).length;
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <p className="text-muted-foreground">{lang === "nl" ? "Geen toegang" : "No access"}</p>
      </div>
    );
  }

  const weekDayLabels = lang === "nl"
    ? ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  // Show all rooms in one grid (no pagination)
  const visibleRooms = GRID_ROOMS;

  const getGridBookings = (date: Date, roomId: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return weekBookings.filter(b => b.booking_date === dateStr && b.studio_id === roomId);
  };

  const getWeekDayBookings = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return weekBookings.filter((b) => b.booking_date === dateStr);
  };

  // Helper: format end time wrapping past midnight
  const formatEndTime = (startTime: string, durationHours: number) => {
    const startH = parseInt(startTime.split(":")[0]);
    const startM = parseInt(startTime.split(":")[1] || "0");
    const totalMinutes = (startH * 60 + startM) + (durationHours * 60);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
  };


  return (
    <div className="min-h-full bg-background" data-toast-section>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background px-3 py-3" style={{ paddingTop: "calc(var(--safe-area-top) + 10px)", willChange: "transform", transform: "translateZ(0)", backfaceVisibility: "hidden" }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <CalendarIcon size={18} className="text-primary" />
            <h1 className="text-base sm:text-lg font-bold font-display">{lang === "nl" ? "Planning" : "Schedule"}</h1>
          </div>
          <div className="ml-auto flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => { setSelectedDate(new Date()); setCalendarMonth(new Date()); hasInitialDayScrolled.current = false; }}
              className="px-2 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg bg-card border border-border hover:bg-secondary transition-colors shrink-0"
            >
              {lang === "nl" ? "Vandaag" : "Today"}
            </button>
            <div className="flex rounded-lg bg-card border border-border overflow-hidden shrink-0">
              {([
                { value: "day" as const, label: lang === "nl" ? "Dag" : "Day" },
                { value: "week" as const, label: lang === "nl" ? "Week" : "Week" },
                { value: "month" as const, label: lang === "nl" ? "Maand" : "Month" },
              ]).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setViewMode(option.value)}
                  className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold transition-all ${viewMode === option.value ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowForm(true)}
              aria-label={lang === "nl" ? "Nieuwe sessie" : "New session"}
              className="p-1.5 rounded-lg gradient-primary text-primary-foreground shrink-0"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "day" ? (
        /* ===== DAY PLANNING VIEW ===== */
        <div className="flex flex-col">
          {/* Sticky top section: day nav + dates + room headers */}
          <div className="sticky z-30 bg-background" style={{ top: "calc(var(--safe-area-top) + 50px)", willChange: "transform", transform: "translateZ(0)", backfaceVisibility: "hidden" }}>

            {/* Day navigation */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-2 rounded-xl hover:bg-card">
                  <ChevronLeft size={18} />
                </button>
                <h2 className="font-semibold font-display capitalize text-center text-sm sm:text-base">
                  {format(selectedDate, "EEEE d MMMM yyyy", { locale })}
                </h2>
                <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 rounded-xl hover:bg-card">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Day selector - horizontally scrollable, starts at today */}
              <div ref={dateScrollRef} className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
                {extendedDates.map((date, i) => {
                  const isToday = isSameDay(date, new Date());
                  const isSelected = isSameDay(date, selectedDate);
                  const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1; // Mon=0
                  return (
                    <button
                      key={i}
                      data-date={format(date, "yyyy-MM-dd")}
                      onClick={() => setSelectedDate(date)}
                      className="flex flex-col items-center gap-0.5 shrink-0 snap-start min-w-[44px]"
                    >
                      <span className="text-[10px] font-medium text-muted-foreground">{weekDayLabels[dayIndex]}</span>
                      <span className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all ${
                        isSelected
                          ? "gradient-primary text-primary-foreground shadow-glow"
                          : isToday
                            ? "border-2 border-primary text-primary"
                            : "text-foreground"
                      }`}>
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid header (studio columns) */}
            <div className="flex border-b border-border bg-card/50">
              <div className="w-14 shrink-0" />
              {visibleRooms.map(room => (
                <div key={room.id} className="flex-1 text-center py-2 border-l border-border">
                  <span className="text-xs font-bold">{room.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Time grid — uses page scroll, no nested scroll container */}
          {weekLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : (
            <div ref={gridScrollRef}>
              <div className="relative">
                {hours.map((hour, hi) => (
                  <div key={hour} className="flex border-b border-border/50" style={{ height: 56 }}>
                    <div className="w-14 shrink-0 flex items-start justify-end pr-2 pt-0.5">
                      <span className="text-[10px] text-muted-foreground font-medium">{hour}</span>
                    </div>
                    {visibleRooms.map(room => (
                      <div
                        key={room.id}
                        className="flex-1 border-l border-border/30 relative cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => {
                          setFormStudio(room.id);
                          setFormTime(hour);
                          setFormDuration(2);
                          setFormNotes("");
                          setShowNotesField(false);
                          setFormPaid("betaald");
                          setFormCustomerId("");
                          setCustomerSearch("");
                          setPaymentUrl(null);
                          setLinkCopied(false);
                          setGridQuickBook(true);
                        }}
                      />
                    ))}
                  </div>
                ))}

                {/* Booking blocks overlay - one column per room, positioned via CSS grid-aligned calc */}
                {visibleRooms.map((room, roomIdx) => {
                  const dayBookings = bookings.filter((b) => b.studio_id === room.id);
                  const colCount = visibleRooms.length;

                  return dayBookings.map(b => {
                    const startH = parseInt(b.start_time.split(":")[0]);
                    const startM = parseInt(b.start_time.split(":")[1] || "0");
                    const top = (startH + startM / 60) * 56;
                    const height = b.duration_hours * 56;
                    const endTimeStr = formatEndTime(b.start_time, b.duration_hours);
                    const userName = profiles[b.user_id] || "?";
                    const isMember = b.session_type === "member";
                    const isGratis = b.session_type === "gratis";

                    // Position using calc: time column = 56px, remaining space split equally
                    // left = 56px + roomIdx/colCount * (100% - 56px)
                    // width = 1/colCount * (100% - 56px) - 2px gap
                    const leftCalc = `calc(56px + (100% - 56px) * ${roomIdx} / ${colCount})`;
                    const widthCalc = `calc((100% - 56px) / ${colCount} - 2px)`;

                    return (
                      <div
                        key={b.id}
                        className="absolute rounded-lg overflow-hidden cursor-pointer"
                        style={{
                          top,
                          left: leftCalc,
                          width: widthCalc,
                          marginLeft: 1,
                          height: Math.max(height, 28),
                          background: room.color,
                          zIndex: 10,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditBooking(b);
                          setEditDuration(b.duration_hours);
                          setEditNotes(b.notes || "");
                          setEditTime(b.start_time);
                          setEditPaid(b.session_type === "gratis" ? "gratis" : b.session_type === "member" ? "member" : "betaald");
                          setPaymentUrl(null);
                          setLinkCopied(false);
                        }}
                      >
                        <div className="p-1.5 text-primary-foreground flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold leading-tight truncate">
                              {userName} - {b.duration_hours}h{isMember ? " • Member" : isGratis ? " • Gratis" : " • Betaald"}
                            </p>
                            {height >= 42 && (
                              <p className="text-[9px] opacity-80 mt-0.5">
                                {b.start_time} - {endTimeStr}
                              </p>
                            )}
                          </div>
                          {!isGratis && !isMember && b.total_price > 0 && height >= 28 && (
                            <button
                              onClick={(e) => handleGenerateAndCopyLink(b.id, e)}
                              disabled={generatingLinkId === b.id}
                              className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
                            >
                              {generatingLinkId === b.id ? <Loader2 size={10} className="animate-spin" /> : copiedLinkId === b.id ? <Check size={10} /> : <Link size={10} />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })}

                {/* Current time indicator */}
                {isSameDay(selectedDate, new Date()) && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-destructive z-[15] pointer-events-none"
                    style={{ top: (new Date().getHours() + new Date().getMinutes() / 60) * 56 }}
                  >
                    <div className="absolute -top-1.5 left-12 w-3 h-3 rounded-full bg-destructive" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === "week" ? (
        /* ===== WEEK OVERVIEW ===== */
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="p-2 rounded-xl hover:bg-card">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold font-display capitalize text-center text-sm sm:text-base">
              {format(weekDates[0], "d MMM", { locale })} – {format(weekDates[6], "d MMM yyyy", { locale })}
            </h2>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="p-2 rounded-xl hover:bg-card">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date) => {
              const isToday = isSameDay(date, new Date());
              const isSelected = isSameDay(date, selectedDate);
              const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
              return (
                <button
                  key={format(date, "yyyy-MM-dd")}
                  onClick={() => setSelectedDate(date)}
                  className={`rounded-xl px-1 py-2 text-center transition-all ${
                    isSelected
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : isToday
                        ? "border border-primary text-primary"
                        : "bg-card border border-border text-foreground"
                  }`}
                >
                  <div className="text-[10px] font-medium opacity-80">{weekDayLabels[dayIndex]}</div>
                  <div className="text-sm font-bold">{date.getDate()}</div>
                </button>
              );
            })}
          </div>

          {weekLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : (
            <div className="space-y-3">
              {weekDates.map((date) => {
                const dayBookings = getWeekDayBookings(date);
                const isToday = isSameDay(date, new Date());
                const isSelected = isSameDay(date, selectedDate);
                return (
                  <div
                    key={format(date, "yyyy-MM-dd")}
                    className={`rounded-2xl border p-4 ${isSelected ? "border-primary/30 bg-primary/5" : isToday ? "border-primary/20 bg-card" : "border-border bg-card"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className={`font-semibold font-display capitalize ${isSelected || isToday ? "text-primary" : "text-foreground"}`}>
                          {format(date, "EEEE d MMMM", { locale })}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {dayBookings.length} {lang === "nl" ? (dayBookings.length === 1 ? "sessie" : "sessies") : (dayBookings.length === 1 ? "session" : "sessions")}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedDate(date)}
                        className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        {lang === "nl" ? "Selecteer" : "Select"}
                      </button>
                    </div>

                    {dayBookings.length === 0 ? (
                      <p className="pt-3 text-sm text-muted-foreground">
                        {lang === "nl" ? "Geen sessies op deze dag" : "No sessions on this day"}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {dayBookings.map((b) => {
                          const endTimeStr = formatEndTime(b.start_time, b.duration_hours);
                          return (
                            <div key={b.id} className="rounded-xl border border-border bg-background px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold truncate">{getStudioName(b.studio_id)}</p>
                                  <p className="text-xs font-medium text-foreground truncate">{profiles[b.user_id] || "Onbekend"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {b.start_time} – {endTimeStr} • {b.duration_hours}h • {b.session_type === "gratis" ? "Gratis" : b.session_type === "member" ? "Member" : `€${b.total_price}`}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditBooking(b);
                                    setEditDuration(b.duration_hours);
                                    setEditNotes(b.notes || "");
                                    setEditTime(b.start_time);
                                    setEditPaid(b.session_type === "gratis" ? "gratis" : b.session_type === "member" ? "member" : "betaald");
                                    setPaymentUrl(null);
                                    setLinkCopied(false);
                                  }}
                                  className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                                >
                                  {lang === "nl" ? "Open" : "Open"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ===== MONTH VIEW ===== */
        <div className="p-4 space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-2 rounded-xl hover:bg-card">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold font-display capitalize">
              {format(calendarMonth, "MMMM yyyy", { locale })}
            </h2>
            <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 rounded-xl hover:bg-card">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {weekDayLabels.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />;
              const isToday = isSameDay(day, new Date());
              const isSelected = isSameDay(day, selectedDate);
              const dayStr = format(day, "yyyy-MM-dd");
              const dayBookings = monthBookings.filter(b => b.booking_date === dayStr);
              const hasS1 = dayBookings.some(b => b.studio_id === "studio-1");
              const hasS2 = dayBookings.some(b => b.studio_id === "studio-2");
              const hasCR = dayBookings.some(b => b.studio_id === "content-room");
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square rounded-xl text-sm font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${
                    isSelected
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : isToday
                        ? "border-2 border-primary text-primary"
                        : "hover:bg-card"
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {dayBookings.length > 0 && (
                    <div className="flex gap-0.5">
                      {hasS1 && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} />}
                      {hasS2 && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary-foreground/70" : "bg-primary/70"}`} />}
                      {hasCR && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary-foreground/50" : "bg-success"}`} />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Rooms overview */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-primary" />
              <h3 className="font-semibold font-display text-sm">
                {lang === "nl" ? "Ruimtes" : "Rooms"}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allRooms.map(room => {
                const count = getRoomBookingCount(room.id);
                return (
                  <div key={room.id} className="rounded-xl bg-card border border-border p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{room[lang]}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {count} {lang === "nl" ? "sessies" : "sessions"}
                      </p>
                    </div>
                    <button
                      onClick={() => { setFormStudio(room.id); setShowForm(true); }}
                      className="p-1.5 rounded-lg gradient-primary text-primary-foreground"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected date header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold font-display">
              {format(selectedDate, "EEEE d MMMM", { locale })}
            </h3>
            <span className="text-xs text-muted-foreground">
              {bookings.length} {lang === "nl" ? "sessies" : "sessions"}
            </span>
          </div>

          {/* Day timeline */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-1">
              {bookings.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {lang === "nl" ? "Geen sessies op deze dag" : "No sessions on this day"}
                </p>
              ) : (
                bookings.map((b) => {
                  const endTimeStr = formatEndTime(b.start_time, b.duration_hours);
                  return (
                    <motion.div
                      key={b.id}
                      variants={item}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                    >
                      <div className="flex flex-col items-center min-w-[50px]">
                        <span className="text-sm font-bold text-primary">{b.start_time}</span>
                        <span className="text-[10px] text-muted-foreground">
                          → {endTimeStr}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{getStudioName(b.studio_id)}</p>
                        <p className="text-xs text-foreground font-medium truncate">
                          {profiles[b.user_id] || "Onbekend"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.duration_hours}h • {b.session_type === "gratis" ? "Gratis" : b.session_type === "member" ? "Member" : `€${b.total_price}`} • {b.status}
                        </p>
                        {b.notes && (
                          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{b.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {b.session_type !== "gratis" && b.total_price > 0 && (
                          <button
                            onClick={() => handleGenerateAndCopyLink(b.id)}
                            disabled={generatingLinkId === b.id}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                            title={lang === "nl" ? "Betaallink kopiëren" : "Copy payment link"}
                          >
                            {generatingLinkId === b.id ? <Loader2 size={14} className="animate-spin" /> : copiedLinkId === b.id ? <Check size={14} /> : <Link size={14} />}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(b.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* New booking modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg bg-card rounded-2xl p-5 space-y-3 border border-border max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold font-display text-lg">
                {lang === "nl" ? "Sessie inplannen" : "Schedule session"}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-xl hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {format(selectedDate, "EEEE d MMMM yyyy", { locale })}
            </p>

            {/* Customer */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Users size={12} />
                {lang === "nl" ? "Klant" : "Customer"}
              </label>
              {!showNewClientForm ? (
                <>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setFormCustomerId(""); }}
                    placeholder={lang === "nl" ? "Zoek klant op naam..." : "Search customer by name..."}
                    className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm"
                  />
                  {customerSearch && !formCustomerId && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-xl bg-background border border-border">
                      {customers
                        .filter(c => (c.full_name || "").toLowerCase().includes(customerSearch.toLowerCase()))
                        .slice(0, 5)
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setFormCustomerId(c.id); setCustomerSearch(c.full_name || c.id); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                          >
                            {c.full_name || (lang === "nl" ? "Naamloos" : "Unnamed")}
                          </button>
                        ))}
                      {customers.filter(c => (c.full_name || "").toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {lang === "nl" ? "Geen klant gevonden" : "No customer found"}
                        </p>
                      )}
                      <button
                        onClick={() => { setNewClientName(customerSearch); setShowNewClientForm(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border"
                      >
                        <UserPlus size={14} />
                        {lang === "nl" ? "Nieuwe klant toevoegen" : "Add new client"}
                      </button>
                    </div>
                  )}
                  {!customerSearch && !formCustomerId && (
                    <button
                      onClick={() => setShowNewClientForm(true)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <UserPlus size={12} />
                      {lang === "nl" ? "Nieuwe klant toevoegen" : "Add new client"}
                    </button>
                  )}
                  {formCustomerId && (
                    <p className="mt-1 text-xs text-success">✓ {lang === "nl" ? "Klant geselecteerd" : "Customer selected"}</p>
                  )}
                </>
              ) : (
                <div className="space-y-2 rounded-xl bg-background border border-primary/30 p-3 mt-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                      <UserPlus size={12} />
                      {lang === "nl" ? "Nieuwe klant" : "New client"}
                    </span>
                    <button onClick={resetNewClientForm} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">{lang === "nl" ? "Naam *" : "Name *"}</label>
                    <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                      placeholder={lang === "nl" ? "Volledige naam" : "Full name"}
                      className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Mail size={10} /> {lang === "nl" ? "E-mail *" : "Email *"}</label>
                    <input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="email@voorbeeld.nl"
                      className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Phone size={10} /> {lang === "nl" ? "Telefoon" : "Phone"}</label>
                    <input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="+31 6..."
                      className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Home size={10} /> {lang === "nl" ? "Adres" : "Address"}</label>
                    <input type="text" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)}
                      placeholder={lang === "nl" ? "Straat + huisnummer" : "Street + number"}
                      className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">{lang === "nl" ? "Postcode" : "Postal code"}</label>
                      <input type="text" value={newClientPostalCode} onChange={(e) => setNewClientPostalCode(e.target.value)}
                        placeholder="1234 AB"
                        className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">{lang === "nl" ? "Plaats" : "City"}</label>
                      <input type="text" value={newClientCity} onChange={(e) => setNewClientCity(e.target.value)}
                        placeholder={lang === "nl" ? "Stad" : "City"}
                        className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                    </div>
                  </div>
                  <button
                    onClick={handleCreateClient}
                    disabled={creatingClient || !newClientName.trim() || !newClientEmail.trim()}
                    className="w-full py-2 rounded-lg gradient-primary text-primary-foreground font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {creatingClient ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    {lang === "nl" ? "Klant aanmaken & selecteren" : "Create & select client"}
                  </button>
                </div>
              )}
            </div>

            {/* Studio */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Studio</label>
              <select
                value={formStudio}
                onChange={(e) => { setFormStudio(e.target.value); setPaymentUrl(null); }}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm"
              >
                {studios.map(s => (
                  <option key={s.id} value={s.id}>{getStudioName(s.id)}</option>
                ))}
              </select>
            </div>

            {/* Time + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {lang === "nl" ? "Starttijd" : "Start time"}
                </label>
                <select
                  value={formTime}
                  onChange={(e) => { setFormTime(e.target.value); setPaymentUrl(null); }}
                  className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm"
                >
                  {hours.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {lang === "nl" ? "Duur (uren)" : "Duration (hours)"}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { if (formDuration > 1) { setFormDuration(formDuration - 1); setPaymentUrl(null); } }}
                    disabled={formDuration <= 1}
                    className="p-2 rounded-lg border border-border hover:bg-card disabled:opacity-30 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="flex-1 text-center text-sm font-bold">{formDuration}h</span>
                  <button
                    onClick={() => { if (formDuration < 24) { setFormDuration(formDuration + 1); setPaymentUrl(null); } }}
                    disabled={formDuration >= 24}
                    className="p-2 rounded-lg border border-border hover:bg-card disabled:opacity-30 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  {formTime} → {formatEndTime(formTime, formDuration)}
                </p>
              </div>
            </div>

            {/* Session type selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {lang === "nl" ? "Type sessie" : "Session type"}
              </label>
              <div className="flex gap-1.5">
                {([
                  { value: "betaald" as const, label: lang === "nl" ? "Betaald" : "Paid", color: "bg-primary" },
                  { value: "gratis" as const, label: "Gratis", color: "bg-muted-foreground" },
                  { value: "member" as const, label: "Member", color: "bg-success" },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFormPaid(opt.value); setPaymentUrl(null); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                      formPaid === opt.value
                        ? `${opt.color} text-white`
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {formPaid === "betaald" && (
              <div>
                {paymentUrl ? (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(paymentUrl);
                      setLinkCopied(true);
                      toast.success(lang === "nl" ? "Betaallink gekopieerd!" : "Payment link copied!");
                      setTimeout(() => setLinkCopied(false), 3000);
                    }}
                    className="w-full flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5 text-sm text-primary hover:bg-primary/20 transition-colors"
                  >
                    {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span className="truncate flex-1 text-left">{linkCopied ? (lang === "nl" ? "Gekopieerd!" : "Copied!") : paymentUrl}</span>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!formCustomerId) {
                        toast.error(lang === "nl" ? "Selecteer eerst een klant" : "Select a customer first");
                        return;
                      }
                      setGeneratingLink(true);
                      try {
                        const studio = studios.find(s => s.id === formStudio);
                        const price = (studio?.pricePerHour || 0) * formDuration;
                        const { data: linkData } = await supabase.functions.invoke("create-admin-payment-link", {
                          body: {
                            customer_id: formCustomerId,
                            studio_id: formStudio,
                            booking_date: format(selectedDate, "yyyy-MM-dd"),
                            start_time: formTime,
                            duration_hours: formDuration,
                            total_price: price,
                          },
                        });
                        if (linkData?.url) {
                          setPaymentUrl(linkData.url);
                          await navigator.clipboard.writeText(linkData.url);
                          setLinkCopied(true);
                          toast.success(lang === "nl" ? "Betaallink gekopieerd!" : "Payment link copied!");
                          setTimeout(() => setLinkCopied(false), 3000);
                        } else {
                          toast.error(linkData?.error || "Error");
                        }
                      } catch (err: any) {
                        toast.error(err.message || "Error");
                      } finally {
                        setGeneratingLink(false);
                      }
                    }}
                    disabled={generatingLink || !formCustomerId}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {generatingLink ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                    {lang === "nl" ? "Betaallink genereren & kopiëren" : "Generate & copy payment link"}
                  </button>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {lang === "nl" ? "Notities" : "Notes"}
              </label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={lang === "nl" ? "Optioneel..." : "Optional..."}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm"
              />
            </div>

            <button
              onClick={handleCreateBooking}
              disabled={submitting}
              className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="animate-spin mx-auto" size={18} />
              ) : (
                lang === "nl" ? "Inplannen" : "Schedule"
              )}
            </button>
          </motion.div>
        </div>
      )}

      {/* Grid quick-book modal */}
      {gridQuickBook && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setGridQuickBook(false)}>
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-lg bg-card rounded-t-2xl p-5 pb-24 space-y-3 border-t border-border max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display text-base">
                  {getStudioName(formStudio)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {format(selectedDate, "EEEE d MMMM", { locale })} • {formTime} - {formatEndTime(formTime, formDuration)}
                </p>
              </div>
              <button onClick={() => setGridQuickBook(false)} className="p-1.5 rounded-xl hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            {/* Customer */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Users size={12} />
                {lang === "nl" ? "Klant" : "Customer"}
              </label>
              {!showNewClientForm ? (
                <>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setFormCustomerId(""); }}
                    placeholder={lang === "nl" ? "Zoek klant..." : "Search customer..."}
                    className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm"
                  />
                  {customerSearch && !formCustomerId && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-xl bg-background border border-border">
                      {customers
                        .filter(c => (c.full_name || "").toLowerCase().includes(customerSearch.toLowerCase()))
                        .slice(0, 5)
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setFormCustomerId(c.id); setCustomerSearch(c.full_name || c.id); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                          >
                            {c.full_name || (lang === "nl" ? "Naamloos" : "Unnamed")}
                          </button>
                        ))}
                      {customers.filter(c => (c.full_name || "").toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {lang === "nl" ? "Geen klant gevonden" : "No customer found"}
                        </p>
                      )}
                      <button
                        onClick={() => { setNewClientName(customerSearch); setShowNewClientForm(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border"
                      >
                        <UserPlus size={14} />
                        {lang === "nl" ? "Nieuwe klant toevoegen" : "Add new client"}
                      </button>
                    </div>
                  )}
                  {!customerSearch && !formCustomerId && (
                    <button
                      onClick={() => setShowNewClientForm(true)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <UserPlus size={12} />
                      {lang === "nl" ? "Nieuwe klant toevoegen" : "Add new client"}
                    </button>
                  )}
                  {formCustomerId && (
                    <p className="mt-1 text-xs text-success">✓ {customerSearch}</p>
                  )}
                </>
              ) : (
                <div className="space-y-2 rounded-xl bg-background border border-primary/30 p-3 mt-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                      <UserPlus size={12} />
                      {lang === "nl" ? "Nieuwe klant" : "New client"}
                    </span>
                    <button onClick={resetNewClientForm} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">{lang === "nl" ? "Naam *" : "Name *"}</label>
                    <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                      placeholder={lang === "nl" ? "Volledige naam" : "Full name"}
                      className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Mail size={10} /> {lang === "nl" ? "E-mail *" : "Email *"}</label>
                    <input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="email@voorbeeld.nl"
                      className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Phone size={10} /> {lang === "nl" ? "Telefoon" : "Phone"}</label>
                    <input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="+31 6..."
                      className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Home size={10} /> {lang === "nl" ? "Adres" : "Address"}</label>
                    <input type="text" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)}
                      placeholder={lang === "nl" ? "Straat + huisnummer" : "Street + number"}
                      className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">{lang === "nl" ? "Postcode" : "Postal code"}</label>
                      <input type="text" value={newClientPostalCode} onChange={(e) => setNewClientPostalCode(e.target.value)}
                        placeholder="1234 AB"
                        className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">{lang === "nl" ? "Plaats" : "City"}</label>
                      <input type="text" value={newClientCity} onChange={(e) => setNewClientCity(e.target.value)}
                        placeholder={lang === "nl" ? "Stad" : "City"}
                        className="w-full rounded-lg bg-card border border-border px-2.5 py-2 text-sm" />
                    </div>
                  </div>
                  <button
                    onClick={handleCreateClient}
                    disabled={creatingClient || !newClientName.trim() || !newClientEmail.trim()}
                    className="w-full py-2 rounded-lg gradient-primary text-primary-foreground font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {creatingClient ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    {lang === "nl" ? "Klant aanmaken & selecteren" : "Create & select client"}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Clock size={12} />
                {lang === "nl" ? "Duur" : "Duration"}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (formDuration > 1) { setFormDuration(formDuration - 1); setPaymentUrl(null); } }}
                  disabled={formDuration <= 1}
                  className="p-2.5 rounded-xl border border-border hover:bg-card disabled:opacity-30 transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="text-lg font-bold min-w-[3rem] text-center">{formDuration}h</span>
                <button
                  onClick={() => { if (formDuration < 24) { setFormDuration(formDuration + 1); setPaymentUrl(null); } }}
                  disabled={formDuration >= 24}
                  className="p-2.5 rounded-xl border border-border hover:bg-card disabled:opacity-30 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formTime} → {formatEndTime(formTime, formDuration)}
              </p>
            </div>

            {/* Session type selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {lang === "nl" ? "Type sessie" : "Session type"}
              </label>
              <div className="flex gap-1.5">
                {([
                  { value: "betaald" as const, label: lang === "nl" ? "Betaald" : "Paid", color: "bg-primary" },
                  { value: "gratis" as const, label: "Gratis", color: "bg-muted-foreground" },
                  { value: "member" as const, label: "Member", color: "bg-success" },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFormPaid(opt.value); setPaymentUrl(null); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                      formPaid === opt.value
                        ? `${opt.color} text-white`
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {formPaid === "betaald" && (
              <div>
                {paymentUrl ? (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(paymentUrl);
                      setLinkCopied(true);
                      toast.success(lang === "nl" ? "Betaallink gekopieerd!" : "Payment link copied!");
                      setTimeout(() => setLinkCopied(false), 3000);
                    }}
                    className="w-full flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5 text-sm text-primary hover:bg-primary/20 transition-colors"
                  >
                    {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span className="truncate flex-1 text-left">{linkCopied ? (lang === "nl" ? "Gekopieerd!" : "Copied!") : paymentUrl}</span>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!formCustomerId) {
                        toast.error(lang === "nl" ? "Selecteer eerst een klant" : "Select a customer first");
                        return;
                      }
                      setGeneratingLink(true);
                      try {
                        const studio = studios.find(s => s.id === formStudio);
                        const price = (studio?.pricePerHour || 0) * formDuration;
                        const { data: linkData } = await supabase.functions.invoke("create-admin-payment-link", {
                          body: {
                            customer_id: formCustomerId,
                            studio_id: formStudio,
                            booking_date: format(selectedDate, "yyyy-MM-dd"),
                            start_time: formTime,
                            duration_hours: formDuration,
                            total_price: price,
                          },
                        });
                        if (linkData?.url) {
                          setPaymentUrl(linkData.url);
                          await navigator.clipboard.writeText(linkData.url);
                          setLinkCopied(true);
                          toast.success(lang === "nl" ? "Betaallink gekopieerd!" : "Payment link copied!");
                          setTimeout(() => setLinkCopied(false), 3000);
                        } else {
                          toast.error(linkData?.error || "Error");
                        }
                      } catch (err: any) {
                        toast.error(err.message || "Error");
                      } finally {
                        setGeneratingLink(false);
                      }
                    }}
                    disabled={generatingLink || !formCustomerId}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {generatingLink ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                    {lang === "nl" ? "Betaallink genereren & kopiëren" : "Generate & copy payment link"}
                  </button>
                )}
              </div>
            )}

            {!showNotesField ? (
              <button
                onClick={() => setShowNotesField(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={12} />
                {lang === "nl" ? "Notitie toevoegen" : "Add note"}
              </button>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {lang === "nl" ? "Notitie" : "Note"}
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={lang === "nl" ? "Typ een notitie..." : "Type a note..."}
                  className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm"
                  autoFocus
                />
              </div>
            )}

            <button
              onClick={handleCreateBooking}
              disabled={submitting || !formCustomerId}
              className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="animate-spin mx-auto" size={18} />
              ) : (
                lang === "nl" ? "Inplannen" : "Schedule"
              )}
            </button>
          </motion.div>
        </div>
      )}

      {/* Edit booking modal */}
      {editBooking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditBooking(null)}>
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-lg bg-card rounded-t-2xl p-5 pb-24 space-y-3 border-t border-border max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display text-base">
                  {getStudioName(editBooking.studio_id)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {profiles[editBooking.user_id] || "?"} • {editBooking.booking_date}
                </p>
              </div>
              <button onClick={() => setEditBooking(null)} className="p-1.5 rounded-xl hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            {/* Start time */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Clock size={12} />
                {lang === "nl" ? "Starttijd" : "Start time"}
              </label>
              <select
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm"
              >
                {hours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {lang === "nl" ? "Duur" : "Duration"}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (editDuration > 1) setEditDuration(editDuration - 1); }}
                  disabled={editDuration <= 1}
                  className="p-2.5 rounded-xl border border-border hover:bg-card disabled:opacity-30 transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="text-lg font-bold min-w-[3rem] text-center">{editDuration}h</span>
                <button
                  onClick={() => { if (editDuration < 24) setEditDuration(editDuration + 1); }}
                  disabled={editDuration >= 24}
                  className="p-2.5 rounded-xl border border-border hover:bg-card disabled:opacity-30 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {editTime} → {formatEndTime(editTime, editDuration)}
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {lang === "nl" ? "Notitie" : "Note"}
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder={lang === "nl" ? "Optioneel..." : "Optional..."}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm"
              />
            </div>

            {/* Session type selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {lang === "nl" ? "Type sessie" : "Session type"}
              </label>
              <div className="flex gap-1.5">
                {([
                  { value: "betaald" as const, label: lang === "nl" ? "Betaald" : "Paid", color: "bg-primary" },
                  { value: "gratis" as const, label: "Gratis", color: "bg-muted-foreground" },
                  { value: "member" as const, label: "Member", color: "bg-success" },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setEditPaid(opt.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                      editPaid === opt.value
                        ? `${opt.color} text-white`
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment link */}
            {editPaid === "betaald" && editBooking.total_price > 0 && (
              <div>
                {paymentUrl ? (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(paymentUrl);
                      setLinkCopied(true);
                      toast.success(lang === "nl" ? "Betaallink gekopieerd!" : "Payment link copied!");
                      setTimeout(() => setLinkCopied(false), 3000);
                    }}
                    className="w-full flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5 text-sm text-primary hover:bg-primary/20 transition-colors"
                  >
                    {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span className="truncate flex-1 text-left">{linkCopied ? (lang === "nl" ? "Gekopieerd!" : "Copied!") : paymentUrl}</span>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setGeneratingLink(true);
                      try {
                        const { data: linkData } = await supabase.functions.invoke("create-admin-payment-link", {
                          body: { booking_id: editBooking.id },
                        });
                        if (linkData?.url) {
                          setPaymentUrl(linkData.url);
                          await navigator.clipboard.writeText(linkData.url);
                          setLinkCopied(true);
                          toast.success(lang === "nl" ? "Betaallink gekopieerd!" : "Payment link copied!");
                          setTimeout(() => setLinkCopied(false), 3000);
                        } else {
                          toast.error(linkData?.error || "Error");
                        }
                      } catch (e: any) {
                        toast.error(e.message || "Error");
                      } finally {
                        setGeneratingLink(false);
                      }
                    }}
                    disabled={generatingLink}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {generatingLink ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                    {lang === "nl" ? "Betaallink genereren" : "Generate payment link"}
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleDeleteBooking(editBooking.id)}
                disabled={deleting}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm font-semibold text-destructive"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {lang === "nl" ? "Verwijder" : "Delete"}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                {lang === "nl" ? "Opslaan" : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete confirmation (list view) */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-4 border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/20">
                <Trash2 size={18} className="text-destructive" />
              </div>
              <h3 className="font-bold font-display">
                {lang === "nl" ? "Sessie verwijderen?" : "Delete session?"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {lang === "nl"
                ? "Weet je zeker dat je deze sessie wilt verwijderen? Dit kan niet ongedaan worden."
                : "Are you sure you want to delete this session? This cannot be undone."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium"
              >
                {lang === "nl" ? "Annuleren" : "Cancel"}
              </button>
              <button
                onClick={() => handleDeleteBooking()}
                disabled={deleting}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground flex items-center justify-center gap-1"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {lang === "nl" ? "Verwijderen" : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminCalendarPage;
