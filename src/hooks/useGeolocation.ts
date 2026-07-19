import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { inlineToast } from "@/components/InlineToast";

interface Position {
  latitude: number;
  longitude: number;
}

/**
 * Hook to get the user's current GPS position via native Geolocation.
 */
export function useGeolocation() {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = async () => {
    try {
      setLoading(true);
      setError(null);

      let permStatus = await Geolocation.checkPermissions();

      if (permStatus.location === "prompt") {
        permStatus = await Geolocation.requestPermissions();
      }

      if (permStatus.location !== "granted") {
        const msg = "Locatie-toegang is geweigerd. Schakel 'Locatievoorzieningen' in via je telefooninstellingen.";
        setError(msg);
        inlineToast.warning(msg);
        return null;
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const coords: Position = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      setPosition(coords);
      return coords;
    } catch (err: any) {
      console.error("[Geolocation] Error:", err);
      const msg = "Kan locatie niet ophalen. Controleer of GPS ingeschakeld is.";
      setError(msg);
      inlineToast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { position, loading, error, getCurrentPosition };
}
