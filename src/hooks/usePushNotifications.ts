import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { inlineToast } from "@/components/InlineToast";

/**
 * Registers for push notifications on native platforms.
 * – Requests permission on first mount
 * – Logs the FCM / APNS token to console
 * – Shows an in-app toast when a push arrives while the app is open
 */
export function usePushNotifications() {
  const initialised = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || initialised.current) return;
    initialised.current = true;

    const setup = async () => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== "granted") {
        console.warn("[Push] Permission denied");
        return;
      }

      await PushNotifications.register();

      PushNotifications.addListener("registration", (token) => {
        console.log("[Push] Registration token:", token.value);
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("[Push] Registration error:", err);
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("[Push] Received:", notification);
        inlineToast.info(notification.title ?? notification.body ?? "Nieuw bericht");
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("[Push] Action performed:", action);
      });
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);
}
