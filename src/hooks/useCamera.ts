import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { inlineToast } from "@/components/InlineToast";

/**
 * Hook to capture a photo via the native camera or photo library.
 * Returns a base64 data URL ready for upload/display.
 */
export function useCamera() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async (source: CameraSource = CameraSource.Prompt) => {
    try {
      setLoading(true);

      // On web, Camera plugin falls back to file input
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
        width: 512,
        height: 512,
      });

      if (image.base64String) {
        const dataUrl = `data:image/${image.format};base64,${image.base64String}`;
        setPhoto(dataUrl);
        return dataUrl;
      }

      return null;
    } catch (err: any) {
      // User cancelled — not an error
      if (err?.message?.includes("cancel") || err?.message?.includes("User")) {
        return null;
      }
      console.error("[Camera] Error:", err);
      inlineToast.error("Camera niet beschikbaar");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { photo, loading, takePhoto, setPhoto };
}
