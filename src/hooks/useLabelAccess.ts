import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// A user has label access if they manage at least one label. Admins/staff
// reach labels through the admin panel, so this is scoped to managers.
export function useLabelAccess() {
  const { user } = useAuth();
  const [labelId, setLabelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    supabase
      .from("labels")
      .select("id")
      .eq("manager_user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) { setLabelId(data?.id || null); setLoading(false); }
      });
    return () => { active = false; };
  }, [user]);

  return { isLabelManager: !!labelId, labelId, loading };
}
