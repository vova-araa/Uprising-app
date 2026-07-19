import { useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Set this to your VAPID **public** key (publishable, safe in frontend).
// Empty string = web push disabled (fallback to in-app realtime only).
const VAPID_PUBLIC_KEY = "BHeplfZm1ASZk5ZCR4GUNppJ8ZkqBoW9qpPhfvnKE8dn0jQQol6P4-4lgywG5uho4fdgN1bOhNOBHZvxbpPs5n8";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreview =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

export function useWebPush() {
  const { user } = useAuth();
  const inited = useRef(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "default">("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      !Capacitor.isNativePlatform() &&
      !isInIframe &&
      !isPreview;
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
  }, []);

  // Re-route SW navigation messages
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "navigate" && typeof e.data.link === "string") {
        window.location.assign(e.data.link);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || !user || !VAPID_PUBLIC_KEY) return false;
    if (inited.current && subscribed) return true;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;
      inited.current = true;


      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = sub.toJSON();
      const endpoint = json.endpoint!;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;

      await (supabase as any).from("push_subscriptions").upsert(
        {
          user_id: user.id,
          platform: "web",
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

      setSubscribed(true);
      return true;
    } catch (err) {
      console.warn("[WebPush] subscribe failed", err);
      return false;
    }
  }, [supported, user, subscribed]);

  // Auto-subscribe silently after login if permission already granted
  useEffect(() => {
    if (supported && user && Notification.permission === "granted" && VAPID_PUBLIC_KEY) {
      subscribe();
    }
  }, [supported, user, subscribe]);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, []);

  return { supported, permission, subscribed, subscribe, unsubscribe, configured: !!VAPID_PUBLIC_KEY };
}
