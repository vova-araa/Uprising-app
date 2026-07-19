import { Capacitor } from "@capacitor/core";
import {
  AndroidBiometryStrength,
  BiometricAuth,
  BiometryType,
} from "@aparajita/capacitor-biometric-auth";
import { inlineToast } from "@/components/InlineToast";

/**
 * Performs biometric authentication (Face ID / Touch ID / fingerprint).
 * Returns true on success, false otherwise.
 */
export async function performBiometricAuth(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[Biometric] Not running on native platform");
    return true; // Skip on web
  }

  try {
    // Check availability
    const result = await BiometricAuth.checkBiometry();

    if (!result.isAvailable) {
      inlineToast.warning("Biometrie is niet beschikbaar op dit apparaat.");
      return false;
    }

    // Authenticate
    await BiometricAuth.authenticate({
      reason: "Bevestig je identiteit om door te gaan",
      cancelTitle: "Annuleren",
      androidTitle: "Biometrische verificatie",
      androidSubtitle: "Gebruik je vingerafdruk of gezichtsherkenning",
      allowDeviceCredential: true,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    });

    return true;
  } catch (err: any) {
    console.error("[Biometric] Auth error:", err);
    // User cancelled
    if (err?.code === "authenticationCanceled" || err?.code === "userCancel") {
      return false;
    }
    inlineToast.error("Biometrische verificatie mislukt");
    return false;
  }
}
