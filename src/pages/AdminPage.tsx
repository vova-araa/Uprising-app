import { useState, useEffect, lazy, Suspense } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar, Clock, Music, Users, Package, Camera,
  Check, X, Loader2, Shield, CalendarClock,
  BarChart3, CreditCard, Bell, Gift, UserCheck, Megaphone, TrendingUp,
  ChevronRight, ChevronDown, AlertTriangle, Bug,
  Edit3, Save, Phone, MapPin, Mail, Crown, Trash2,
  Database, ChevronLeft, RefreshCw, Upload, Settings, Plus
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays } from "date-fns";
const AdminConfigTab = lazy(() => import("@/components/admin/AdminConfigTab"));
const AdminSubscriptionsTab = lazy(() => import("@/components/admin/AdminSubscriptionsTab"));
const AdminNukiTab = lazy(() => import("@/components/admin/AdminNukiTab"));
const AdminAccessTab = lazy(() => import("@/components/admin/AdminAccessTab"));
import PageLoader from "@/components/PageLoader";
import AdminUserAccess from "@/components/admin/AdminUserAccess";
const AdminBlastTab = lazy(() => import("@/components/admin/AdminBlastTab"));
const AdminPerfTab = lazy(() => import("@/components/admin/AdminPerfTab"));
const AdminInsightsTab = lazy(() => import("@/components/admin/AdminInsightsTab"));
import { nl, enUS } from "date-fns/locale";
import { inlineToast as toast } from "@/components/InlineToast";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

type Tab = "overview" | "insights" | "diensten" | "bookings" | "producer" | "requests" | "projects" | "users" | "notifications" | "referrals" | "errors" | "database" | "products" | "config" | "configsettings" | "nuki" | "access" | "blast" | "subscriptions" | "perf";

const AdminPage = () => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const locale = lang === "nl" ? nl : enUS;

  const { isAdmin: isAdminCached } = useAdminRole();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [bookings, setBookings] = useState<any[]>([]);
  const [producerBookings, setProducerBookings] = useState<any[]>([]);
  const [contentRequests, setContentRequests] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [membershipData, setMembershipData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ full_name: "", email: "", phone: "", address: "", city: "", postal_code: "" });
  const [addingUser, setAddingUser] = useState(false);
  

  // Database viewer state
  const DB_TABLES = ["profiles", "bookings", "producer_bookings", "content_requests", "projects", "notifications", "referrals", "user_roles", "booking_feedback", "error_logs", "broedplaats_rsvp"];
  const [dbSelectedTable, setDbSelectedTable] = useState<string | null>(null);
  const [dbRows, setDbRows] = useState<any[]>([]);
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbEditingRow, setDbEditingRow] = useState<string | null>(null);
  const [dbEditForm, setDbEditForm] = useState<any>({});
  const [dbDeletingRow, setDbDeletingRow] = useState<string | null>(null);


  // Products (Stripe) state
  const [stripeProducts, setStripeProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productEditForm, setProductEditForm] = useState<any>({});
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceEditAmount, setPriceEditAmount] = useState<number>(0);
  const [savingProduct, setSavingProduct] = useState(false);

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsersLast30: 0,
    totalBookings: 0,
    pendingBookings: 0,
    pendingProducer: 0,
    pendingRequests: 0,
    activeProjects: 0,
    totalRevenue: 0,
    bookingsThisMonth: 0,
  });

  useEffect(() => {
    if (!user || isAdminCached === null) return;
    setIsAdmin(isAdminCached);
    if (isAdminCached) loadOverview();
  }, [user, isAdminCached]);


  const loadOverview = async () => {
    // Don't block UI: render shell instantly, fill data progressively.
    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
    const thirtyDaysAgo = format(subDays(now, 30), "yyyy-MM-dd'T'HH:mm:ss");

    try {
      const [bookingsRes, profilesRes, producerRes, requestsRes, projectsRes] = await Promise.all([
        supabase.from("bookings").select("*").order("booking_date", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("producer_bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("content_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
      ]);

      const allBookings = bookingsRes.data || [];
      const allProfiles = profilesRes.data || [];
      const allProducer = producerRes.data || [];
      const allRequests = requestsRes.data || [];
      const allProjects = projectsRes.data || [];

      setBookings(allBookings);
      setProfiles(allProfiles);
      setProducerBookings(allProducer);
      setContentRequests(allRequests);
      setProjects(allProjects);

      // Avatars/roles in background — don't block stats
      loadUserAvatars(allProfiles);
      loadUserRoles();

      const recentBookingUserIds = new Set(
        allBookings.filter(b => b.created_at >= thirtyDaysAgo).map(b => b.user_id)
      );

      setStats(prev => ({
        ...prev,
        totalUsers: allProfiles.length,
        activeUsersLast30: recentBookingUserIds.size,
        totalBookings: allBookings.length,
        pendingBookings: allBookings.filter(b => b.status === "pending").length,
        pendingProducer: allProducer.filter(b => b.status === "pending").length,
        pendingRequests: allRequests.filter(r => r.status === "pending").length,
        activeProjects: allProjects.filter(p => p.status !== "completed").length,
        bookingsThisMonth: allBookings.filter(b => b.booking_date >= monthStart && b.booking_date <= monthEnd).length,
      }));

      // Edge function (cold start ~500ms+) — fire in background, never block the page
      supabase.functions.invoke("admin-subscriptions").then(({ data: memData, error: memError }) => {
        if (!memError && memData) {
          setMembershipData(memData);
          setStats(prev => ({ ...prev, totalRevenue: memData.monthly_revenue || 0 }));
        }
      }).catch(() => {});
    } catch {
      // overview load error
    }
  };


  const loadMembershipData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-subscriptions");
      if (!error && data) setMembershipData(data);
    } catch {
      // membership reload failed silently
    }
  };

  const loadUserAvatars = async (allProfiles: any[]) => {
    // Batch avatar loading - just check for avatar existence via a single list call per user
    // Skip individual storage calls to avoid N+1 - only load when user expands
    const avatarMap: Record<string, string> = {};
    // Load avatars lazily - we'll populate on expand instead
    setUserAvatars(avatarMap);
  };

  const loadSingleAvatar = async (userId: string) => {
    if (userAvatars[userId]) return;
    try {
      const { data } = await supabase.storage.from("avatars").list(`${userId}`, { limit: 1, sortBy: { column: "created_at", order: "desc" } });
      if (data && data.length > 0) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(`${userId}/${data[0].name}`);
        setUserAvatars(prev => ({ ...prev, [userId]: urlData.publicUrl }));
      }
    } catch {}
  };

  const loadUserRoles = async () => {
    const { data } = await supabase.from("user_roles").select("*");
    if (data) {
      const rolesMap: Record<string, string[]> = {};
      for (const r of data) {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      }
      setUserRoles(rolesMap);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm(lang === "nl" ? "Weet je zeker dat je deze gebruiker wilt verwijderen? Dit kan niet ongedaan worden gemaakt." : "Are you sure you want to delete this user? This cannot be undone.")) return;
    setDeletingUser(userId);
    try {
      // Delete profile (cascading will handle related data)
      await supabase.from("profiles").delete().eq("id", userId);
      // Remove from user_roles
      await supabase.from("user_roles").delete().eq("user_id", userId);
      toast.success(lang === "nl" ? "Gebruiker verwijderd" : "User deleted");
      setExpandedUser(null);
      loadOverview();
    } catch {
      toast.error(lang === "nl" ? "Er ging iets mis" : "Something went wrong");
    } finally {
      setDeletingUser(null);
    }
  };

  const createNewUser = async () => {
    if (!addUserForm.full_name.trim() || !addUserForm.email.trim()) {
      toast.error("Naam en e-mail zijn verplicht");
      return;
    }
    setAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-client", {
        body: addUserForm,
      });
      if (error) throw error;
      if (data?.existing) {
        toast.info(`${addUserForm.full_name} bestond al — profiel is bijgewerkt`);
      } else {
        toast.success(`${addUserForm.full_name} is aangemaakt`);
      }
      setShowAddUser(false);
      setAddUserForm({ full_name: "", email: "", phone: "", address: "", city: "", postal_code: "" });
      loadOverview();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Aanmaken mislukt");
    } finally {
      setAddingUser(false);
    }
  };

  const loadData = async (tab: Tab) => {
    if (tab === "overview") { loadOverview(); return; }
    setLoading(true);
    try {
      if (tab === "referrals") {
        const { data } = await supabase.from("referrals").select("*").order("created_at", { ascending: false });
        setReferrals(data || []);
      } else if (tab === "notifications") {
        const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
        setNotifications(data || []);
      } else if (tab === "errors") {
        const { data } = await supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(100);
        setErrorLogs(data || []);
      }
    } catch (err) {
      // data load error
    } finally {
      setLoading(false);
    }
  };

  const loadDbTable = async (tableName: string) => {
    setDbLoading(true);
    setDbSelectedTable(tableName);
    setDbEditingRow(null);
    try {
      const { data, error } = await (supabase.from as any)(tableName).select("*").order("created_at", { ascending: false }).limit(200);
      if (error) {
        const { data: fallbackData } = await (supabase.from as any)(tableName).select("*").limit(200);
        const rows = fallbackData || [];
        setDbRows(rows);
        setDbColumns(rows.length > 0 ? Object.keys(rows[0]) : []);
      } else {
        const rows = data || [];
        setDbRows(rows);
        setDbColumns(rows.length > 0 ? Object.keys(rows[0]) : []);
      }
    } catch {
      setDbRows([]);
      setDbColumns([]);
    } finally {
      setDbLoading(false);
    }
  };

  const saveDbRow = async (tableName: string, rowId: string) => {
    try {
      const updateData = { ...dbEditForm };
      delete updateData.id; // don't update the id
      await (supabase.from as any)(tableName).update(updateData).eq("id", rowId);
      toast.success("Opgeslagen");
      setDbEditingRow(null);
      loadDbTable(tableName);
    } catch {
      toast.error("Opslaan mislukt");
    }
  };

  const deleteDbRow = async (tableName: string, rowId: string) => {
    try {
      await (supabase.from as any)(tableName).delete().eq("id", rowId);
      toast.success("Verwijderd");
      setDbDeletingRow(null);
      loadDbTable(tableName);
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };



  const loadStripeProducts = async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-stripe-products", {
        body: { action: "list" },
      });
      if (error) throw error;
      setStripeProducts(data.products || []);
    } catch {
      toast.error("Producten laden mislukt");
    } finally {
      setProductsLoading(false);
    }
  };

  const saveProductEdit = async (productId: string) => {
    setSavingProduct(true);
    try {
      const { error } = await supabase.functions.invoke("manage-stripe-products", {
        body: { action: "update_product", productId, name: productEditForm.name, description: productEditForm.description, active: productEditForm.active },
      });
      if (error) throw error;
      toast.success("Product bijgewerkt in Stripe");
      setEditingProduct(null);
      loadStripeProducts();
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSavingProduct(false);
    }
  };

  const savePriceEdit = async (priceId: string) => {
    setSavingProduct(true);
    try {
      const { error } = await supabase.functions.invoke("manage-stripe-products", {
        body: { action: "update_price", priceId, amount: priceEditAmount },
      });
      if (error) throw error;
      toast.success("Prijs bijgewerkt in Stripe");
      setEditingPrice(null);
      loadStripeProducts();
    } catch {
      toast.error("Prijs opslaan mislukt");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "products") { loadStripeProducts(); return; }
    if (tab !== "overview") loadData(tab);
  };

  const deactivatePrice = async (priceId: string) => {
    if (!confirm("Weet je zeker dat je deze prijs wilt verwijderen uit Stripe?")) return;
    setSavingProduct(true);
    try {
      const { error } = await supabase.functions.invoke("manage-stripe-products", {
        body: { action: "deactivate_price", priceId },
      });
      if (error) throw error;
      toast.success("Prijs verwijderd uit Stripe");
      loadStripeProducts();
    } catch {
      toast.error("Prijs verwijderen mislukt");
    } finally {
      setSavingProduct(false);
    }
  };

  const deactivateProduct = async (productId: string) => {
    if (!confirm("Weet je zeker dat je dit product wilt deactiveren in Stripe? Alle bijbehorende prijzen worden ook gedeactiveerd.")) return;
    setSavingProduct(true);
    try {
      const { error } = await supabase.functions.invoke("manage-stripe-products", {
        body: { action: "deactivate_product", productId },
      });
      if (error) throw error;
      toast.success("Product gedeactiveerd in Stripe");
      setExpandedProduct(null);
      loadStripeProducts();
    } catch {
      toast.error("Product deactiveren mislukt");
    } finally {
      setSavingProduct(false);
    }
  };


  const updateProducerStatus = async (id: string, status: string, userId: string) => {
    try {
      await supabase.from("producer_bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      
      // Check if payment was actually made before adding credit
      const { data: booking } = await (supabase as any).from("producer_bookings").select("stripe_session_id").eq("id", id).single();
      const wasPaid = !!booking?.stripe_session_id;

      const title = status === "accepted" ? "Producer sessie geaccepteerd!" : "Producer sessie afgewezen";
      const message = status === "accepted"
        ? "Je producer sessie is bevestigd."
        : wasPaid
          ? "Je producer sessie is afgewezen. Je tegoed van €350 is bijgeschreven."
          : "Je producer sessie is afgewezen.";
      await supabase.from("notifications").insert({ user_id: userId, title, message, type: status === "accepted" ? "success" : "warning", link: "/account" });
      
      if (status === "declined" && wasPaid) {
        const { data: profile } = await supabase.from("profiles").select("credit_balance").eq("id", userId).single();
        await supabase.from("profiles").update({ credit_balance: (profile?.credit_balance || 0) + 350 }).eq("id", userId);
      }
      toast.success(status === "accepted" ? "Geaccepteerd!" : "Afgewezen");
      loadOverview();
    } catch { toast.error("Er ging iets mis"); }
  };

  const updateBookingStatus = async (id: string, status: string, userId: string) => {
    try {
      await supabase.from("bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      await supabase.from("notifications").insert({
        user_id: userId,
        title: status === "confirmed" ? "Boeking bevestigd!" : "Boeking geannuleerd",
        message: status === "confirmed" ? "Je studioboeking is bevestigd." : "Je studioboeking is geannuleerd.",
        type: status === "confirmed" ? "success" : "warning",
        link: "/account",
      });
      toast.success("Status bijgewerkt");
      loadOverview();
    } catch { toast.error("Er ging iets mis"); }
  };

  const updateRequestStatus = async (id: string, status: string) => {
    try {
      await supabase.from("content_requests").update({ status }).eq("id", id);
      toast.success("Status bijgewerkt");
      loadOverview();
    } catch { toast.error("Er ging iets mis"); }
  };

  const updateProjectStatus = async (id: string, status: string) => {
    try {
      await supabase.from("projects").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      toast.success("Status bijgewerkt");
      loadOverview();
    } catch { toast.error("Er ging iets mis"); }
  };

  const startEditUser = (profile: any) => {
    setEditingUser(profile.id);
    setEditForm({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      city: profile.city || "",
      address: profile.address || "",
      postal_code: profile.postal_code || "",
      credit_balance: profile.credit_balance || 0,
      membership: profile.membership || "",
      membership_end_date: profile.membership_end_date || "",
      membership_override: (profile as any).membership_override || "",
      broedplaats: profile.broedplaats || "",
      studio1_hours: profile.studio1_hours || 0,
      studio2_hours: profile.studio2_hours || 0,
      content_hours: profile.content_hours || 0,
    });
  };

  const saveUserEdit = async (userId: string) => {
    try {
      // Get current profile to compare changes
      const { data: oldProfile } = await supabase.from("profiles").select("credit_balance, studio1_hours, studio2_hours, content_hours").eq("id", userId).single();

      await supabase.from("profiles").update({
        full_name: editForm.full_name,
        phone: editForm.phone,
        city: editForm.city,
        address: editForm.address,
        postal_code: editForm.postal_code,
        credit_balance: editForm.credit_balance,
        membership: editForm.membership || null,
        membership_end_date: editForm.membership_end_date || null,
        membership_override: editForm.membership_override || null,
        broedplaats: editForm.broedplaats || null,
        studio1_hours: editForm.studio1_hours || 0,
        studio2_hours: editForm.studio2_hours || 0,
        content_hours: editForm.content_hours || 0,
      }).eq("id", userId);

      // Send notifications for credit/hours changes
      const notifications: { user_id: string; title: string; message: string; type: string; link: string }[] = [];
      const oldCredit = oldProfile?.credit_balance || 0;
      const newCredit = editForm.credit_balance || 0;
      if (newCredit > oldCredit) {
        notifications.push({
          user_id: userId,
          title: "Tegoed bijgeschreven",
          message: `Er is €${newCredit - oldCredit} tegoed aan je account toegevoegd. Je totale tegoed is nu €${newCredit}.`,
          type: "success",
          link: "/account",
        });
      }

      const hourChanges: string[] = [];
      const oldS1 = oldProfile?.studio1_hours || 0;
      const oldS2 = oldProfile?.studio2_hours || 0;
      const oldC = oldProfile?.content_hours || 0;
      const newS1 = editForm.studio1_hours || 0;
      const newS2 = editForm.studio2_hours || 0;
      const newC = editForm.content_hours || 0;
      if (newS1 > oldS1) hourChanges.push(`Studio 1: ${newS1}h`);
      if (newS2 > oldS2) hourChanges.push(`Studio 2: ${newS2}h`);
      if (newC > oldC) hourChanges.push(`Content Room: ${newC}h`);

      if (hourChanges.length > 0) {
        notifications.push({
          user_id: userId,
          title: "Uren toegewezen",
          message: `Je hebt uren toegewezen gekregen: ${hourChanges.join(", ")}.`,
          type: "success",
          link: "/account",
        });
      }

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }

      toast.success("Gebruiker bijgewerkt");
      setEditingUser(null);
      loadOverview();
    } catch { toast.error("Er ging iets mis"); }
  };

  const resolveError = async (id: string) => {
    try {
      await supabase.from("error_logs").update({ resolved: true }).eq("id", id);
      toast.success("Fout gemarkeerd als opgelost");
      loadData("errors");
    } catch { toast.error("Er ging iets mis"); }
  };

  if (isAdmin === null) {
    return <PageLoader />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-full px-5 pt-10">
        <div className="rounded-xl bg-card border border-destructive/30 p-8 text-center">
          <Shield size={48} className="mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-bold font-display mb-2">{lang === "nl" ? "Geen toegang" : "Access denied"}</h2>
          <p className="text-sm text-muted-foreground mb-4">{lang === "nl" ? "Je hebt geen admin rechten." : "You don't have admin permissions."}</p>
          <button onClick={() => navigate("/")} className="rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            {lang === "nl" ? "Terug naar home" : "Back to home"}
          </button>
        </div>
      </div>
    );
  }

  const mainTabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: lang === "nl" ? "Overzicht" : "Overview", icon: BarChart3 },
    { id: "insights", label: "Insights", icon: TrendingUp },
    { id: "diensten", label: lang === "nl" ? "Diensten" : "Services", icon: Package },
    { id: "users", label: lang === "nl" ? "Gebruikers" : "Users", icon: Users },
    { id: "config", label: "Config", icon: Settings },
  ];

  const dienstenSubTabs: { id: Tab; label: string; icon: any }[] = [
    { id: "bookings", label: lang === "nl" ? "Boekingen" : "Bookings", icon: Calendar },
    { id: "producer", label: "Producer", icon: Music },
    { id: "requests", label: lang === "nl" ? "Aanvragen" : "Requests", icon: Camera },
    { id: "projects", label: lang === "nl" ? "Projecten" : "Projects", icon: Package },
    { id: "subscriptions", label: "Abonnementen", icon: Crown },
    { id: "referrals", label: "Referrals", icon: Gift },
  ];

  const configSubTabs: { id: Tab; label: string; icon: any }[] = [
    { id: "database", label: "Database", icon: Database },
    { id: "products", label: "Producten", icon: CreditCard },
    { id: "configsettings", label: "Configuratie", icon: Settings },
    { id: "nuki", label: "Nuki Sloten", icon: Shield },
    { id: "access", label: "Toegang", icon: Calendar },
    { id: "blast", label: "Mail Bom", icon: Megaphone },
    { id: "perf", label: "Performance", icon: BarChart3 },
  ];

  const isDienstenTab = activeTab === "diensten" || dienstenSubTabs.some(t => t.id === activeTab);
  const isConfigTab = activeTab === "config" || configSubTabs.some(t => t.id === activeTab);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-warning/20 text-warning",
      confirmed: "bg-success/20 text-success",
      accepted: "bg-success/20 text-success",
      declined: "bg-destructive/20 text-destructive",
      cancelled: "bg-destructive/20 text-destructive",
      received: "bg-muted text-muted-foreground",
      mixing: "bg-primary/20 text-primary",
      mastering: "bg-primary/20 text-primary",
      review: "bg-primary/20 text-primary",
      completed: "bg-success/20 text-success",
    };
    return `rounded-full px-2.5 py-1 text-[10px] font-semibold ${colors[status] || "bg-muted text-muted-foreground"}`;
  };

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-xl" style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}>
        <h1 className="text-lg font-bold font-display">Admin Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          {lang === "nl" ? "Centraal beheer voor alles" : "Central management hub"}
        </p>
      </div>

      {/* Tab Bar */}
      <div className="px-5 mt-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
          {mainTabs.map((tab) => {
            const isActive = activeTab === tab.id
              || (tab.id === "diensten" && isDienstenTab)
              || (tab.id === "config" && isConfigTab);
            return (
              <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}>
                <tab.icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-3 mt-4 pb-28" data-toast-section>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ===== OVERVIEW ===== */}
            {activeTab === "overview" && (
              <>
                <motion.div variants={item}>
                  <button onClick={() => navigate("/planning")}
                    className="w-full flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-4 text-left transition-all hover:bg-primary/20 active:scale-[0.98]">
                    <CalendarClock size={20} className="text-primary" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-primary">Planning & Kalender</span>
                      <p className="text-[10px] text-muted-foreground">{lang === "nl" ? "Sessies inplannen & beheren" : "Schedule & manage sessions"}</p>
                    </div>
                    <ChevronRight size={16} className="text-primary" />
                  </button>
                </motion.div>

                <motion.div variants={item}>
                  <button onClick={() => navigate("/admin-taken")}
                    className="w-full flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-4 text-left transition-all hover:bg-primary/20 active:scale-[0.98]">
                    <Bell size={20} className="text-primary" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-primary">Taken Uprising</span>
                      <p className="text-[10px] text-muted-foreground">Microsoft To Do-stijl takenbeheer</p>
                    </div>
                    <ChevronRight size={16} className="text-primary" />
                  </button>
                </motion.div>

                <motion.div variants={item}>
                  <button onClick={() => navigate("/admin-faciliteiten")}
                    className="w-full flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-4 text-left transition-all hover:bg-primary/20 active:scale-[0.98]">
                    <Package size={20} className="text-primary" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-primary">Schoonmaak & Inventaris</span>
                      <p className="text-[10px] text-muted-foreground">Schoonmaak, inventarisatie & vendingmachine</p>
                    </div>
                    <ChevronRight size={16} className="text-primary" />
                  </button>
                </motion.div>

                <motion.div variants={item} className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, label: lang === "nl" ? "Totaal gebruikers" : "Total users", value: stats.totalUsers.toString() },
                    { icon: UserCheck, label: lang === "nl" ? "Actief (30 dagen)" : "Active (30 days)", value: stats.activeUsersLast30.toString() },
                    { icon: Calendar, label: lang === "nl" ? "Boekingen deze maand" : "Bookings this month", value: stats.bookingsThisMonth.toString() },
                    { icon: CreditCard, label: lang === "nl" ? "Totale omzet" : "Total revenue", value: `€${stats.totalRevenue}` },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-card border border-border p-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 mb-3">
                        <stat.icon size={18} className="text-primary" />
                      </div>
                      <p className="text-2xl font-bold font-display">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </motion.div>

                <motion.div variants={item} className="rounded-xl bg-card border border-border p-5">
                  <h3 className="font-semibold font-display text-sm mb-3">
                    {lang === "nl" ? "Openstaande acties" : "Pending actions"}
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: lang === "nl" ? "Boekingen wachtend" : "Bookings pending", count: stats.pendingBookings, tab: "bookings" as Tab },
                      { label: lang === "nl" ? "Producer aanvragen" : "Producer requests", count: stats.pendingProducer, tab: "producer" as Tab },
                      { label: lang === "nl" ? "Content aanvragen" : "Content requests", count: stats.pendingRequests, tab: "requests" as Tab },
                      { label: lang === "nl" ? "Actieve projecten" : "Active projects", count: stats.activeProjects, tab: "projects" as Tab },
                    ].map((action) => (
                      <button key={action.label} onClick={() => handleTabChange(action.tab)}
                        className="flex w-full items-center justify-between rounded-lg bg-secondary p-3 text-left transition-all hover:bg-secondary/80">
                        <span className="text-sm">{action.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${action.count > 0 ? "text-warning" : "text-muted-foreground"}`}>
                            {action.count}
                          </span>
                          <ChevronRight size={14} className="text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>

                <motion.div variants={item} className="rounded-xl bg-card border border-border p-5">
                  <h3 className="font-semibold font-display text-sm mb-3">
                    {lang === "nl" ? "Recente boekingen" : "Recent bookings"}
                  </h3>
                  <div className="space-y-2">
                    {bookings.slice(0, 5).map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {b.studio_id === "studio-1" ? "Studio 1" : b.studio_id === "studio-2" ? "Studio 2" : b.studio_id === "content-room" ? "Content Room" : b.studio_id}
                          </p>
                          <p className="text-[10px] text-foreground font-medium truncate">
                            {profiles.find((p: any) => p.id === b.user_id)?.full_name || "Onbekend"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(b.booking_date), "d MMM", { locale })} • {b.start_time} • {b.duration_hours}h
                          </p>
                          {b.notes && (
                            <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{b.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={statusBadge(b.status)}>{b.status}</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(lang === "nl" ? "Boeking verwijderen?" : "Delete booking?")) return;
                              await supabase.from("bookings").delete().eq("id", b.id);
                              toast.success(lang === "nl" ? "Boeking verwijderd" : "Booking deleted");
                              loadOverview();
                            }}
                            className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors"
                          >
                            <X size={14} className="text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Membership Overview */}
                <motion.div variants={item} className="rounded-xl bg-card border border-border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown size={16} className="text-primary" />
                    <h3 className="font-semibold font-display text-sm">
                      {lang === "nl" ? "Actieve abonnementen" : "Active subscriptions"}
                    </h3>
                  </div>
                  {!membershipData ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={18} className="animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-secondary p-3 text-center">
                          <p className="text-xl font-bold font-display text-primary">{membershipData.studio_members?.length || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Studio Members</p>
                        </div>
                        <div className="rounded-lg bg-secondary p-3 text-center">
                          <p className="text-xl font-bold font-display text-primary">{membershipData.broedplaats_members?.length || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Broedplaats</p>
                        </div>
                      </div>
                      {membershipData.all_members?.length > 0 && (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {membershipData.all_members.map((m: any, i: number) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-secondary p-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{m.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-[10px] font-semibold text-primary">{m.product_name}</p>
                                <p className="text-[10px] text-muted-foreground">€{m.amount}/{m.interval === "year" ? "jr" : "mnd"}</p>
                                {m.current_period_start ? (
                                  <p className="text-[9px] text-muted-foreground">
                                    {format(new Date(m.current_period_start * 1000), "d MMM yyyy", { locale })} – {m.current_period_end ? format(new Date(m.current_period_end * 1000), "d MMM yyyy", { locale }) : ""}
                                  </p>
                                ) : m.created ? (
                                  <p className="text-[9px] text-muted-foreground">
                                    Sinds {format(new Date(m.created), "d MMM yyyy", { locale })}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </>
            )}

            {/* ===== DIENSTEN HUB ===== */}
            {activeTab === "diensten" && (
              <motion.div variants={item}>
                <h2 className="text-lg font-bold font-display mb-4">
                  {lang === "nl" ? "Diensten" : "Services"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dienstenSubTabs.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => handleTabChange(card.id)}
                      className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <card.icon size={22} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{card.label}</p>
                      </div>
                      <ChevronRight size={16} className="ml-auto mt-1 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ===== BOOKINGS ===== */}
            {activeTab === "bookings" && (<>
              <button onClick={() => handleTabChange("diensten")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
                <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Diensten" : "Back to Services"}
              </button>
              {bookings.map((b: any) => (
              <motion.div key={b.id} variants={item} className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold font-display text-sm">
                      {b.studio_id === "studio-1" ? "Studio 1" : b.studio_id === "studio-2" ? "Studio 2" : b.studio_id === "content-room" ? "Content Room" : b.studio_id}
                    </h3>
                    <p className="text-xs text-foreground font-medium">
                      {profiles.find((p: any) => p.id === b.user_id)?.full_name || "Onbekend"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(b.booking_date), "d MMM yyyy", { locale })} • {b.start_time} - {(parseInt(b.start_time.split(":")[0]) + b.duration_hours).toString().padStart(2, "0")}:00 • {b.duration_hours}h
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">€{b.total_price} • {b.session_type}</p>
                    {b.notes && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{b.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadge(b.status)}>{b.status}</span>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(lang === "nl" ? "Boeking verwijderen?" : "Delete booking?")) return;
                        await supabase.from("bookings").delete().eq("id", b.id);
                        toast.success(lang === "nl" ? "Boeking verwijderd" : "Booking deleted");
                        loadOverview();
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors"
                    >
                      <X size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}</>)}

            {/* ===== PRODUCER ===== */}
            {activeTab === "producer" && (<>
              <button onClick={() => handleTabChange("diensten")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
                <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Diensten" : "Back to Services"}
              </button>
              {producerBookings.map((pb: any) => {
              const owner = profiles.find((pr: any) => pr.id === pb.user_id);
              return (
              <motion.div key={pb.id} variants={item} className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold font-display text-sm">Producer Sessie</h3>
                    <p className="text-xs text-foreground font-medium">{owner?.full_name || owner?.email || "Onbekend"}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(pb.preferred_date), "d MMM yyyy", { locale })} • {pb.preferred_time}
                    </p>
                    {pb.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pb.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadge(pb.status)}>{pb.status}</span>
                    <button
                      onClick={async () => {
                        if (!confirm(lang === "nl" ? "Producer sessie verwijderen?" : "Delete producer session?")) return;
                        try {
                          await supabase.from("producer_bookings").delete().eq("id", pb.id);
                          setProducerBookings(prev => prev.filter((p: any) => p.id !== pb.id));
                        } catch { toast.error("Er ging iets mis"); }
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
                {pb.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => updateProducerStatus(pb.id, "accepted", pb.user_id)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-success/20 py-2 text-xs font-semibold text-success">
                      <Check size={14} /> {lang === "nl" ? "Accepteren" : "Accept"}
                    </button>
                    <button onClick={() => updateProducerStatus(pb.id, "declined", pb.user_id)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-destructive/20 py-2 text-xs font-semibold text-destructive">
                      <X size={14} /> {lang === "nl" ? "Afwijzen" : "Decline"}
                    </button>
                  </div>
                )}
              </motion.div>
              );
            })}</>)}

            {/* ===== REQUESTS ===== */}
            {activeTab === "requests" && (<>
              <button onClick={() => handleTabChange("diensten")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
                <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Diensten" : "Back to Services"}
              </button>
              {contentRequests.map((cr: any) => (
              <motion.div key={cr.id} variants={item} className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold font-display text-sm capitalize">{cr.request_type}</h3>
                    <p className="text-xs text-muted-foreground">{format(new Date(cr.created_at), "d MMM yyyy", { locale })}</p>
                    {cr.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{cr.description}</p>}
                  </div>
                  <span className={statusBadge(cr.status)}>{cr.status}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {["pending", "in_progress", "completed"].map((s) => (
                    <button key={s} onClick={() => updateRequestStatus(cr.id, s)}
                      className={`flex-1 rounded-lg py-2 text-[10px] font-semibold transition-all ${
                        cr.status === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}>
                      {s === "pending" ? "Wachtend" : s === "in_progress" ? "Bezig" : "Klaar"}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}</>)}

            {/* ===== PROJECTS ===== */}
            {activeTab === "projects" && (<>
              <button onClick={() => handleTabChange("diensten")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
                <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Diensten" : "Back to Services"}
              </button>
              {projects.map((p: any) => {
              const owner = profiles.find((pr: any) => pr.id === p.user_id);
              return (
              <motion.div key={p.id} variants={item} className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold font-display text-sm">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {owner?.full_name || "Onbekend"} • {format(new Date(p.created_at), "d MMM yyyy", { locale })} • €{p.price}
                    </p>
                    {p.style && <p className="text-xs text-muted-foreground mt-0.5">Stijl: {p.style}</p>}
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadge(p.status)}>{p.status}</span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Project "${p.title}" verwijderen?`)) return;
                        try {
                          await (supabase as any).from("projects").delete().eq("id", p.id);
                          toast.success("Project verwijderd");
                          loadOverview();
                        } catch { toast.error("Er ging iets mis"); }
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors"
                    >
                      <X size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Staff notes */}
                {p.staff_notes && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-2.5 mt-2">
                    <p className="text-[10px] font-semibold text-primary mb-0.5">📝 Notitie aan klant:</p>
                    <p className="text-[11px] text-foreground">{p.staff_notes}</p>
                  </div>
                )}

                {/* Request info form */}
                <div className="mt-3 space-y-2">
                  <textarea
                    placeholder="Aanvullende informatie vragen aan klant..."
                    defaultValue={p.staff_notes || ""}
                    id={`staff-notes-${p.id}`}
                    rows={2}
                    className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const el = document.getElementById(`staff-notes-${p.id}`) as HTMLTextAreaElement;
                        const notes = el?.value?.trim() || "";
                        try {
                          await supabase.from("projects").update({ staff_notes: notes, updated_at: new Date().toISOString() } as any).eq("id", p.id);
                          // Send notification to user
                          if (notes) {
                            await supabase.from("notifications").insert({
                              user_id: p.user_id,
                              title: "Aanvullende informatie nodig",
                              message: notes,
                              type: "info",
                              link: "/account?tab=projects",
                            });
                          }
                          toast.success("Bericht verstuurd naar klant");
                          loadOverview();
                        } catch { toast.error("Er ging iets mis"); }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary/20 py-2 text-xs font-semibold text-primary"
                    >
                      <Bell size={12} /> Informatie opvragen
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const uploadNote = "We missen nog bestanden voor je project '" + p.title + "'. Upload ze via de projectpagina.";
                          await supabase.from("projects").update({ staff_notes: uploadNote, updated_at: new Date().toISOString() } as any).eq("id", p.id);
                          await supabase.from("notifications").insert({
                            user_id: p.user_id,
                            title: "Upload je bestanden",
                            message: uploadNote,
                            type: "warning",
                            link: "/account?tab=projects",
                          });
                          toast.success("Upload-herinnering verstuurd");
                          loadOverview();
                        } catch { toast.error("Er ging iets mis"); }
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-warning/20 py-2 px-3 text-xs font-semibold text-warning"
                    >
                      <Upload size={12} /> Upload
                    </button>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {["received", "mixing", "mastering", "review", "completed"].map((s) => (
                    <button key={s} onClick={() => updateProjectStatus(p.id, s)}
                      className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all ${
                        p.status === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
              );
            })}</>)}

            {/* ===== USERS ===== */}
            {activeTab === "users" && (<>
              {/* Add user button + form */}
              <motion.div variants={item} className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{profiles.length} gebruikers</p>
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  <Plus size={14} /> Gebruiker toevoegen
                </button>
              </motion.div>

              <AnimatePresence>
                {showAddUser && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl bg-card border border-primary/30 p-4 mb-3 space-y-3" data-toast-section>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <UserCheck size={16} className="text-primary" />
                        Nieuwe gebruiker
                      </h3>
                      <div className="space-y-2">
                        {[
                          { key: "full_name", label: "Volledige naam *", icon: Users, type: "text" },
                          { key: "email", label: "E-mailadres *", icon: Mail, type: "email" },
                          { key: "phone", label: "Telefoonnummer", icon: Phone, type: "tel" },
                          { key: "address", label: "Adres", icon: MapPin, type: "text" },
                          { key: "city", label: "Stad", icon: MapPin, type: "text" },
                          { key: "postal_code", label: "Postcode", icon: Mail, type: "text" },
                        ].map((field) => (
                          <div key={field.key} className="flex items-center gap-2">
                            <field.icon size={14} className="text-muted-foreground shrink-0" />
                            <input
                              value={(addUserForm as any)[field.key] || ""}
                              onChange={(e) => setAddUserForm({ ...addUserForm, [field.key]: e.target.value })}
                              placeholder={field.label}
                              type={field.type}
                              className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Er wordt een account aangemaakt met een willekeurig wachtwoord. De gebruiker kan via "Wachtwoord vergeten" inloggen.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={createNewUser}
                          disabled={addingUser}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-success/20 py-2.5 text-xs font-semibold text-success disabled:opacity-50"
                        >
                          {addingUser ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Aanmaken
                        </button>
                        <button
                          onClick={() => setShowAddUser(false)}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-secondary py-2.5 text-xs font-semibold text-muted-foreground"
                        >
                          <X size={14} /> Annuleren
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {profiles.map((p: any) => (
              <motion.div key={p.id} variants={item} className="rounded-xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => { const next = expandedUser === p.id ? null : p.id; setExpandedUser(next); if (next) loadSingleAvatar(next); }}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    {userAvatars[p.id] ? (
                      <AvatarImage src={userAvatars[p.id]} alt={p.full_name || ""} />
                    ) : null}
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                      {(p.full_name || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">
                      {p.full_name || "Onbekend"}
                      {userRoles[p.id]?.includes("admin") && (
                        <span className="ml-1.5 text-[10px] font-bold text-primary bg-primary/20 rounded-full px-2 py-0.5">Admin</span>
                      )}
                      {userRoles[p.id]?.includes("staff") && !userRoles[p.id]?.includes("admin") && (
                        <span className="ml-1.5 text-[10px] font-bold text-warning bg-warning/20 rounded-full px-2 py-0.5">Staff</span>
                      )}
                      {p.membership && (
                        <span className="ml-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-400/20 rounded-full px-2 py-0.5">
                          {p.membership.charAt(0).toUpperCase() + p.membership.slice(1)}
                        </span>
                      )}
                      {p.broedplaats && (
                        <span className="ml-1.5 text-[10px] font-bold text-amber-400 bg-amber-400/20 rounded-full px-2 py-0.5">
                          {p.broedplaats.charAt(0).toUpperCase() + p.broedplaats.slice(1)}
                        </span>
                      )}
                    </h3>
                    {p.email && <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>}
                    <p className="text-xs text-muted-foreground">{p.phone || "-"} • {p.city || "-"}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {p.referral_code && (
                        <span className="text-xs text-muted-foreground">Ref: {p.referral_code}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), "d MMM yy")}</p>
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedUser === p.id ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <AnimatePresence>
                  {expandedUser === p.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                        {editingUser === p.id ? (
                          <>
                            <div className="space-y-2">
                              {[
                                { key: "full_name", label: "Naam", icon: Users },
                                { key: "phone", label: "Telefoon", icon: Phone },
                                { key: "city", label: "Stad", icon: MapPin },
                                { key: "address", label: "Adres", icon: MapPin },
                                { key: "postal_code", label: "Postcode", icon: Mail },
                              ].map((field) => (
                                <div key={field.key} className="flex items-center gap-2">
                                  <field.icon size={14} className="text-muted-foreground shrink-0" />
                                  <input
                                    value={editForm[field.key] || ""}
                                    onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                                    placeholder={field.label}
                                    className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                  />
                                </div>
                              ))}
                              <div className="flex items-center gap-2">
                                <CreditCard size={14} className="text-muted-foreground shrink-0" />
                                <input
                                  type="number"
                                  value={editForm.credit_balance || 0}
                                  onChange={(e) => setEditForm({ ...editForm, credit_balance: parseFloat(e.target.value) || 0 })}
                                  placeholder="Tegoed"
                                  className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                />
                              </div>

                              {/* Membership Assignment */}
                              <div className="border-t border-border pt-2 mt-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                  {lang === "nl" ? "Toewijzingen" : "Assignments"}
                                </p>

                                <div className="space-y-2">
                                  <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                      {lang === "nl" ? "Membership" : "Membership"}
                                    </label>
                                    <select
                                      value={editForm.membership || ""}
                                      onChange={(e) => setEditForm({ ...editForm, membership: e.target.value })}
                                      className="w-full rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                    >
                                      <option value="">{lang === "nl" ? "Geen" : "None"}</option>
                                      <option value="basic">Basic (8 uur/mnd)</option>
                                      <option value="pro">Pro (16 uur/mnd)</option>
                                      <option value="unlimited">Unlimited</option>
                                      <option value="ambassadeur">{lang === "nl" ? "Ambassadeur (toegewezen uren)" : "Ambassador (allocated hours)"}</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                      {lang === "nl" ? "Loopt tot (einddatum)" : "Expires on (end date)"}
                                    </label>
                                    <input
                                      type="date"
                                      value={editForm.membership_end_date || ""}
                                      onChange={(e) => setEditForm({ ...editForm, membership_end_date: e.target.value })}
                                      className="w-full rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                    />
                                    <p className="text-[9px] text-muted-foreground mt-0.5">
                                      Handig bij overgang vanuit ander systeem — stel in tot wanneer het huidige abonnement loopt
                                    </p>
                                  </div>

                                  <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                      {lang === "nl" ? "Uren override (uitzonderlijk)" : "Hours override (exceptional)"}
                                    </label>
                                    <select
                                      value={editForm.membership_override || ""}
                                      onChange={(e) => setEditForm({ ...editForm, membership_override: e.target.value })}
                                      className="w-full rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                    >
                                      <option value="">{lang === "nl" ? "Geen (standaard)" : "None (default)"}</option>
                                      <option value="basic">Basic (8 uur/mnd, 1 boeking)</option>
                                      <option value="pro">Pro (16 uur/mnd, 1 boeking)</option>
                                      <option value="unlimited">Unlimited (onbeperkt, 4 boekingen)</option>
                                    </select>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">
                                      Overschrijf de uurlimieten van het abonnement. Bijv. een Pro-lid met Unlimited uren.
                                    </p>
                                  </div>

                                  <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                      {lang === "nl" ? "Broedplaats abonnement" : "Broedplaats subscription"}
                                    </label>
                                    <select
                                      value={editForm.broedplaats || ""}
                                      onChange={(e) => setEditForm({ ...editForm, broedplaats: e.target.value })}
                                      className="w-full rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                    >
                                      <option value="">{lang === "nl" ? "Geen" : "None"}</option>
                                      <option value="broedplaats-students">Scholieren (€45/mnd)</option>
                                      <option value="broedplaats">Broedplaats (€70/mnd)</option>
                                      <option value="broedplaats-plus">Broedplaats Plus (€150/mnd)</option>
                                    </select>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-[11px] text-muted-foreground mb-1 block">
                                        Studio 1
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={editForm.studio1_hours || 0}
                                        onChange={(e) => setEditForm({ ...editForm, studio1_hours: parseInt(e.target.value) || 0 })}
                                        className="w-full rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[11px] text-muted-foreground mb-1 block">
                                        Studio 2
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={editForm.studio2_hours || 0}
                                        onChange={(e) => setEditForm({ ...editForm, studio2_hours: parseInt(e.target.value) || 0 })}
                                        className="w-full rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[11px] text-muted-foreground mb-1 block">
                                        Content
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={editForm.content_hours || 0}
                                        onChange={(e) => setEditForm({ ...editForm, content_hours: parseInt(e.target.value) || 0 })}
                                        className="w-full rounded-lg bg-secondary px-3 py-2 text-sm border-none outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveUserEdit(p.id)}
                                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-success/20 py-2 text-xs font-semibold text-success">
                                <Save size={14} /> Opslaan
                              </button>
                              <button onClick={() => setEditingUser(null)}
                                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-secondary py-2 text-xs font-semibold text-muted-foreground">
                                <X size={14} /> Annuleren
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-muted-foreground">Adres:</span> {p.address || "-"}</div>
                              <div><span className="text-muted-foreground">Postcode:</span> {p.postal_code || "-"}</div>
                              <div><span className="text-muted-foreground">Taal:</span> {p.language || "-"}</div>
                              <div><span className="text-muted-foreground">Lid sinds:</span> {format(new Date(p.created_at), "d MMM yyyy")}</div>
                              <div><span className="text-muted-foreground">Tegoed:</span> <span className="text-success font-semibold">{p.credit_balance > 0 ? `€${p.credit_balance}` : "-"}</span></div>
                              <div><span className="text-muted-foreground">Membership:</span> <span className="font-semibold">{p.membership || "-"}</span></div>
                              {p.membership_end_date && (
                                <div><span className="text-muted-foreground">Loopt tot:</span> <span className="font-semibold">{format(new Date(p.membership_end_date), "d MMM yyyy")}</span></div>
                              )}
                              {p.broedplaats && (
                                <div><span className="text-muted-foreground">Broedplaats:</span> <span className="font-semibold">{p.broedplaats}</span></div>
                              )}
                            </div>
                            {userAvatars[p.id] && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Camera size={12} /> Profielfoto ingesteld
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => startEditUser(p)}
                                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-primary/20 py-2 text-xs font-semibold text-primary">
                                <Edit3 size={14} /> Bewerken
                              </button>
                              <button onClick={() => deleteUser(p.id)} disabled={deletingUser === p.id}
                                className="flex items-center justify-center gap-1 rounded-lg bg-destructive/20 px-4 py-2 text-xs font-semibold text-destructive">
                                {deletingUser === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                            <AdminUserAccess userId={p.id} userName={p.full_name || p.email || "Gebruiker"} />
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}</>)}

            {/* ===== REFERRALS ===== */}
            {activeTab === "referrals" && (<>
              <button onClick={() => handleTabChange("diensten")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
                <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Diensten" : "Back to Services"}
              </button>
              {referrals.map((r: any) => (
              <motion.div key={r.id} variants={item} className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold font-mono">{r.referral_code}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(r.created_at), "d MMM yyyy", { locale })}
                    </p>
                  </div>
                  <span className={statusBadge(r.status)}>{r.status}</span>
                </div>
              </motion.div>
            ))}</>)}

            {/* ===== NOTIFICATIONS ===== */}
            {activeTab === "notifications" && notifications.map((n: any) => (
              <motion.div key={n.id} variants={item} className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                    n.type === "success" ? "bg-success" : n.type === "warning" ? "bg-warning" : "bg-primary"
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(n.created_at), "d MMM HH:mm", { locale })}
                    </p>
                  </div>
                  <span className={`text-[10px] ${n.read ? "text-muted-foreground" : "text-primary font-semibold"}`}>
                    {n.read ? "Gelezen" : "Nieuw"}
                  </span>
                </div>
              </motion.div>
            ))}

            {/* ===== ERROR LOGS ===== */}
            {activeTab === "errors" && (
              <>
                {errorLogs.length === 0 ? (
                  <div className="rounded-xl bg-card border border-border p-8 text-center">
                    <Check size={32} className="mx-auto text-success mb-3" />
                    <p className="text-sm font-semibold">{lang === "nl" ? "Geen fouten gevonden!" : "No errors found!"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{lang === "nl" ? "Alles werkt naar behoren" : "Everything is working properly"}</p>
                  </div>
                ) : (
                  errorLogs.map((err: any) => (
                    <motion.div key={err.id} variants={item}
                      className={`rounded-xl bg-card border p-4 ${err.resolved ? "border-border opacity-60" : "border-warning/30"}`}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className={err.resolved ? "text-muted-foreground mt-0.5" : "text-warning mt-0.5"} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium break-words">{err.error_message}</p>
                          {err.page_url && <p className="text-[10px] text-muted-foreground mt-1 truncate">Pagina: {err.page_url}</p>}
                          {err.error_stack && (
                            <pre className="text-[9px] text-muted-foreground mt-1 bg-secondary rounded p-2 overflow-x-auto max-h-20">
                              {err.error_stack}
                            </pre>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(err.created_at), "d MMM HH:mm", { locale })}
                          </p>
                        </div>
                      </div>
                      {!err.resolved && (
                        <button onClick={() => resolveError(err.id)}
                          className="mt-2 w-full flex items-center justify-center gap-1 rounded-lg bg-success/20 py-2 text-xs font-semibold text-success">
                          <Check size={14} /> {lang === "nl" ? "Markeer als opgelost" : "Mark as resolved"}
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </>
            )}

            {/* ===== DATABASE ===== */}
            {activeTab === "database" && (
              <motion.div variants={item} className="space-y-4">
                <button onClick={() => handleTabChange("config")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Config" : "Back to Config"}
                </button>
                {!dbSelectedTable ? (
                  <div className="grid grid-cols-2 gap-2">
                    {DB_TABLES.map((table) => (
                      <button key={table} onClick={() => loadDbTable(table)}
                        className="rounded-xl bg-card border border-border p-4 text-left hover:border-primary/40 transition-all">
                        <Database size={16} className="text-primary mb-1" />
                        <p className="text-xs font-semibold">{table}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setDbSelectedTable(null); setDbRows([]); }}
                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        <ChevronLeft size={14} /> Terug
                      </button>
                      <p className="text-sm font-semibold flex-1">{dbSelectedTable}</p>
                      <button onClick={() => loadDbTable(dbSelectedTable)} className="p-1.5 rounded-lg bg-secondary">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                    {dbLoading ? (
                      <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
                    ) : dbRows.length === 0 ? (
                      <div className="rounded-xl bg-card border border-border p-8 text-center">
                        <p className="text-sm text-muted-foreground">Geen data</p>
                      </div>
                    ) : (
                      dbRows.map((row: any) => (
                        <motion.div key={row.id} variants={item} className="rounded-xl bg-card border border-border p-3 space-y-1">
                          {dbEditingRow === row.id ? (
                            <div className="space-y-2">
                              {dbColumns.filter(c => c !== "id").map((col) => (
                                <div key={col}>
                                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">{col}</label>
                                  <input
                                    value={dbEditForm[col] ?? ""}
                                    onChange={(e) => setDbEditForm((prev: any) => ({ ...prev, [col]: e.target.value }))}
                                    className="w-full rounded-lg bg-secondary border border-border px-2 py-1.5 text-xs"
                                  />
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => setDbEditingRow(null)}
                                  className="flex-1 rounded-lg bg-secondary py-2 text-xs font-semibold">Annuleer</button>
                                <button onClick={() => saveDbRow(dbSelectedTable, row.id)}
                                  className="flex-1 rounded-lg gradient-primary py-2 text-xs font-semibold text-primary-foreground">
                                  <Save size={12} className="inline mr-1" />Opslaan
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {dbColumns.slice(0, 4).map((col) => (
                                <div key={col} className="flex gap-2">
                                  <span className="text-[10px] font-semibold text-muted-foreground w-24 shrink-0 truncate">{col}</span>
                                  <span className="text-[11px] text-foreground truncate">{row[col] != null ? String(row[col]).substring(0, 80) : "—"}</span>
                                </div>
                              ))}
                              {dbColumns.length > 4 && (
                                <p className="text-[10px] text-muted-foreground">+{dbColumns.length - 4} meer velden</p>
                              )}
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => { setDbEditingRow(row.id); setDbEditForm({ ...row }); }}
                                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-secondary py-1.5 text-[11px] font-semibold">
                                  <Edit3 size={12} /> Bewerk
                                </button>
                                {dbDeletingRow === row.id ? (
                                  <div className="flex-1 flex gap-1">
                                    <button onClick={() => setDbDeletingRow(null)}
                                      className="flex-1 rounded-lg bg-secondary py-1.5 text-[11px] font-semibold">Nee</button>
                                    <button onClick={() => deleteDbRow(dbSelectedTable, row.id)}
                                      className="flex-1 rounded-lg bg-destructive py-1.5 text-[11px] font-semibold text-destructive-foreground">Ja</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDbDeletingRow(row.id)}
                                    className="flex items-center justify-center gap-1 rounded-lg border border-destructive/20 px-3 py-1.5 text-[11px] font-semibold text-destructive">
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </motion.div>
                      ))
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Products Tab */}
            {activeTab === "products" && (
              <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                <button onClick={() => handleTabChange("config")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Config" : "Back to Config"}
                </button>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold font-display">Stripe Producten</h2>
                  <button onClick={loadStripeProducts} className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    <RefreshCw size={12} /> Vernieuw
                  </button>
                </div>
                {productsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
                ) : stripeProducts.length === 0 ? (
                  <div className="rounded-xl bg-card border border-border p-8 text-center">
                    <p className="text-sm text-muted-foreground">Geen producten gevonden</p>
                  </div>
                ) : (
                  stripeProducts.map((product: any) => {
                    const isExpanded = expandedProduct === product.id;
                    return (
                    <motion.div key={product.id} variants={item} className="rounded-xl bg-card border border-border overflow-hidden">
                      {/* Header - always visible, click to expand */}
                      <button
                        onClick={() => { setExpandedProduct(isExpanded ? null : product.id); setEditingProduct(null); }}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate">{product.name}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold shrink-0 ${product.active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                            {product.active ? "Actief" : "Inactief"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(product.prices || []).length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {(product.prices || []).map((p: any) => `€${(p.unit_amount / 100).toFixed(2)}`).join(", ")}
                            </span>
                          )}
                          {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                        </div>
                      </button>

                      {/* Expanded content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-border"
                          >
                            <div className="p-4 space-y-3">
                              {editingProduct === product.id ? (
                                <>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Naam</label>
                                    <input value={productEditForm.name || ""} onChange={(e) => setProductEditForm({ ...productEditForm, name: e.target.value })}
                                      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Beschrijving</label>
                                    <textarea value={productEditForm.description || ""} onChange={(e) => setProductEditForm({ ...productEditForm, description: e.target.value })}
                                      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground min-h-[60px]" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Actief</label>
                                    <button onClick={() => setProductEditForm({ ...productEditForm, active: !productEditForm.active })}
                                      className={`rounded-full px-3 py-1 text-[10px] font-semibold ${productEditForm.active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                                      {productEditForm.active ? "Actief" : "Inactief"}
                                    </button>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditingProduct(null)} className="flex-1 rounded-lg bg-secondary py-2 text-xs font-semibold">Annuleren</button>
                                    <button onClick={() => saveProductEdit(product.id)} disabled={savingProduct}
                                      className="flex-1 rounded-lg gradient-primary py-2 text-xs font-semibold text-primary-foreground flex items-center justify-center gap-1">
                                      {savingProduct ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Opslaan
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {product.description && <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>}
                                  {/* Prices */}
                                  <div className="space-y-2">
                                    {(product.prices || []).map((price: any) => (
                                      <div key={price.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                                        {editingPrice === price.id ? (
                                          <div className="flex items-center gap-2 w-full">
                                            <span className="text-xs text-muted-foreground">€</span>
                                            <input type="number" step="0.01" value={(priceEditAmount / 100).toFixed(2)}
                                              onChange={(e) => setPriceEditAmount(Math.round(parseFloat(e.target.value) * 100))}
                                              className="flex-1 rounded-lg bg-card border border-border px-2 py-1 text-sm text-foreground w-20" />
                                            <button onClick={() => setEditingPrice(null)} className="rounded-lg bg-card px-2 py-1 text-[10px] font-semibold">✕</button>
                                            <button onClick={() => savePriceEdit(price.id)} disabled={savingProduct}
                                              className="rounded-lg gradient-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                                              {savingProduct ? <Loader2 size={10} className="animate-spin" /> : "Opslaan"}
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <div>
                                              <span className="text-sm font-bold text-foreground">€{(price.unit_amount / 100).toFixed(2)}</span>
                                              {price.recurring && (
                                                <span className="text-[10px] text-muted-foreground ml-1">/ {price.recurring.interval === "month" ? "maand" : price.recurring.interval === "year" ? "jaar" : price.recurring.interval}</span>
                                              )}
                                              {!price.recurring && <span className="text-[10px] text-muted-foreground ml-1">eenmalig</span>}
                                            </div>
                                            <button onClick={() => { setEditingPrice(price.id); setPriceEditAmount(price.unit_amount); }}
                                              className="p-1 rounded-lg hover:bg-card transition-colors">
                                              <Edit3 size={12} className="text-muted-foreground" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[9px] text-muted-foreground font-mono">{product.id}</p>
                                  {/* Action buttons */}
                                  <div className="flex gap-2 pt-2 border-t border-border">
                                    <button onClick={() => { setEditingProduct(product.id); setProductEditForm({ name: product.name, description: product.description || "", active: product.active }); }}
                                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-secondary py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors">
                                      <Edit3 size={12} /> Bewerken
                                    </button>
                                    <button onClick={() => deactivateProduct(product.id)}
                                      className="flex items-center justify-center gap-1 rounded-lg bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors">
                                      <Trash2 size={12} /> Verwijderen
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}

            {/* ===== ABONNEMENTEN ===== */}
            {activeTab === "subscriptions" && (
              <motion.div variants={item}>
                <button onClick={() => handleTabChange("diensten")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
                  <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Diensten" : "Back to Services"}
                </button>
                <Suspense fallback={<PageLoader />}><AdminSubscriptionsTab /></Suspense>
              </motion.div>
            )}

            {/* ===== CONFIG HUB ===== */}
            {activeTab === "config" && (
              <motion.div variants={item}>
                <h2 className="text-lg font-bold font-display mb-4">
                  {lang === "nl" ? "Configuratie" : "Configuration"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {configSubTabs.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => handleTabChange(card.id)}
                      className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <card.icon size={22} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{card.label}</p>
                      </div>
                      <ChevronRight size={16} className="ml-auto mt-1 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ===== CONFIG SETTINGS (was "config" AdminConfigTab) ===== */}
            {activeTab === "configsettings" && (
              <motion.div variants={item}>
                <button onClick={() => handleTabChange("config")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
                  <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Config" : "Back to Config"}
                </button>
                <Suspense fallback={<PageLoader />}><AdminConfigTab /></Suspense>
              </motion.div>
            )}

            {/* Back buttons for other config sub-tabs */}

            {activeTab === "nuki" && (
              <motion.div variants={item}>
                <button onClick={() => handleTabChange("config")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
                  <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Config" : "Back to Config"}
                </button>
                <Suspense fallback={<PageLoader />}><AdminNukiTab /></Suspense>
              </motion.div>
            )}

            {activeTab === "access" && (
              <motion.div variants={item}>
                <button onClick={() => handleTabChange("config")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
                  <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Config" : "Back to Config"}
                </button>
                <Suspense fallback={<PageLoader />}><AdminAccessTab /></Suspense>
              </motion.div>
            )}

            {/* ===== MAIL BOM ===== */}
            {activeTab === "blast" && (
              <motion.div variants={item}>
                <button onClick={() => handleTabChange("config")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
                  <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Config" : "Back to Config"}
                </button>
                <Suspense fallback={<PageLoader />}><AdminBlastTab /></Suspense>
              </motion.div>
            )}

            {/* ===== INSIGHTS ===== */}
            {activeTab === "insights" && (
              <motion.div variants={item}>
                <Suspense fallback={<PageLoader />}><AdminInsightsTab /></Suspense>
              </motion.div>
            )}

            {/* ===== PERFORMANCE ===== */}
            {activeTab === "perf" && (
              <motion.div variants={item}>
                <button onClick={() => handleTabChange("config")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
                  <ChevronLeft size={14} /> {lang === "nl" ? "Terug naar Config" : "Back to Config"}
                </button>
                <Suspense fallback={<PageLoader />}><AdminPerfTab /></Suspense>
              </motion.div>
            )}

            {activeTab !== "overview" && activeTab !== "insights" && activeTab !== "errors" && activeTab !== "database" && activeTab !== "products" && activeTab !== "config" && activeTab !== "nuki" && activeTab !== "access" && activeTab !== "blast" && activeTab !== "subscriptions" && activeTab !== "perf" && (
              (activeTab === "bookings" && bookings.length === 0) ||
              (activeTab === "producer" && producerBookings.length === 0) ||
              (activeTab === "requests" && contentRequests.length === 0) ||
              (activeTab === "projects" && projects.length === 0) ||
              (activeTab === "users" && profiles.length === 0) ||
              (activeTab === "referrals" && referrals.length === 0) ||
              (activeTab === "notifications" && notifications.length === 0)
            ) && (
              <div className="rounded-xl bg-card border border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">{lang === "nl" ? "Nog geen items" : "No items yet"}</p>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AdminPage;
