import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Lightweight haptic feedback helpers.
 * Silently no-ops on web.
 */
export const haptics = {
  /** Light tap — use for successful button presses */
  light: () => {
    if (!Capacitor.isNativePlatform()) return;
    Haptics.impact({ style: ImpactStyle.Light });
  },

  /** Medium tap — use for significant actions */
  medium: () => {
    if (!Capacitor.isNativePlatform()) return;
    Haptics.impact({ style: ImpactStyle.Medium });
  },

  /** Heavy tap — use for destructive or important confirmations */
  heavy: () => {
    if (!Capacitor.isNativePlatform()) return;
    Haptics.impact({ style: ImpactStyle.Heavy });
  },

  /** Success feedback */
  success: () => {
    if (!Capacitor.isNativePlatform()) return;
    Haptics.notification({ type: NotificationType.Success });
  },

  /** Error feedback — use for validation failures */
  error: () => {
    if (!Capacitor.isNativePlatform()) return;
    Haptics.notification({ type: NotificationType.Error });
  },

  /** Warning feedback */
  warning: () => {
    if (!Capacitor.isNativePlatform()) return;
    Haptics.notification({ type: NotificationType.Warning });
  },
};
