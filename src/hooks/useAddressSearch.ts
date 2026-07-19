import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export function useAddressSearch() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (timeout.current) clearTimeout(timeout.current);
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    timeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-address?q=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(Array.isArray(data) && data.length > 0);
      } catch {
        setSuggestions([]);
      }
      setSearching(false);
    }, 400);
  }, []);

  const select = useCallback((suggestion: AddressSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    return suggestion.display_name;
  }, []);

  const show = useCallback(() => {
    if (suggestions.length > 0) setShowSuggestions(true);
  }, [suggestions]);

  const hide = useCallback(() => {
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  return { suggestions, showSuggestions, searching, search, select, show, hide };
}
