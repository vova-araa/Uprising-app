import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, ChevronRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useWebPush } from "@/hooks/useWebPush";


interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

const NOTIFICATION_SOUND_URL = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGkqeli62teleUE6ecLW2apXJkRyr9XneEkuW5y808qCUjVLhLPOyZJfOUl+rszKnGtETXaqx8OjelJOXZ2/wqiISVhZkbm7rJRdUFmOtLaqmGhhWoSssqufi2tgcJOoq6qYfWhmdJOlp6aWhXVscYydo6KUinhudIuYnJqTiH13dYeSl5aRiYB6eIONk5OPiIN+fIGIjY6Nh4SBf4GFiIqKiIWDgoGChIaHhoWEg4KCg4SFhYWEhIODg4OEhISEhIODg4ODhISEhIODg4ODg4OEhISDg4ODg4ODg4ODg4ODg4ODg4OD";

const NotificationBell = () => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const locale = lang === "nl" ? nl : enUS;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasRequestedPermission = useRef(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = 0.5;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted" && document.hidden) {
      new window.Notification(title, { body, icon: "/favicon.ico", tag: "uprising-admin" });
    }
  }, []);

  const { supported: webPushSupported, permission: webPushPermission, subscribed: webPushSubscribed, subscribe: subscribeWebPush, configured: webPushConfigured } = useWebPush();

  // No auto prompt — iOS Safari/PWA requires a user gesture. The user enables via the bell button.


  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          playSound();
          showBrowserNotification(newNotif.title, newNotif.message);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, playSound, showBrowserNotification]);

  const fetchNotifications = async () => {
    const { data } = await (supabase as any)
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await (supabase as any)
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;
    const ids = notifications.map((n) => n.id);
    await (supabase as any).from("notifications").delete().in("id", ids);
    setNotifications([]);
  };

  const typeColors: Record<string, string> = {
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    info: "bg-primary/20 text-primary",
    error: "bg-destructive/20 text-destructive",
  };

  const handleBellClick = useCallback(() => {
    // User gesture — safe to request notification permission / subscribe to web push
    if (webPushSupported && webPushConfigured && !webPushSubscribed) {
      subscribeWebPush();
    } else if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setOpen((prev) => {
      if (!prev) markAllRead();
      return !prev;
    });
  }, [webPushSupported, webPushConfigured, webPushSubscribed, subscribeWebPush]);

  const needsEnable =
    webPushSupported && webPushConfigured && !webPushSubscribed && webPushPermission !== "denied";

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        aria-label={t("alerts")}
        aria-expanded={open}
        className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
      >
        <Bell size={20} className="text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>


      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-12 z-50 w-80 max-h-96 overflow-y-auto rounded-xl bg-card border border-border shadow-card"
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold font-display text-sm">
                  {t("alerts")}
                </h3>
                {notifications.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllNotifications();
                    }}
                    className="p-1 rounded-lg hover:bg-destructive/20 transition-colors"
                    title={t("clearAll")}
                  >
                    <X size={16} className="text-destructive" />
                  </button>
                )}
              </div>
              {needsEnable && (
                <button
                  onClick={(e) => { e.stopPropagation(); subscribeWebPush(); }}
                  className="w-full px-4 py-2 text-xs text-left bg-primary/10 hover:bg-primary/20 text-primary border-b border-border transition-colors"
                >
                  🔔 {lang === "nl" ? "Schakel push-notificaties in voor deze browser" : "Enable push notifications for this browser"}
                </button>
              )}

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell size={24} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("noNotifications")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.link) {
                          navigate(n.link);
                          setOpen(false);
                        }
                      }}
                      className={`px-4 py-3 transition-colors ${!n.read ? "bg-primary/5" : ""} ${n.link ? "cursor-pointer hover:bg-secondary/60" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${typeColors[n.type]?.split(" ")[0] || "bg-primary/20"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(n.created_at), "d MMM, HH:mm", { locale })}
                          </p>
                        </div>
                        {n.link && <ChevronRight size={14} className="mt-1 text-muted-foreground shrink-0" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
