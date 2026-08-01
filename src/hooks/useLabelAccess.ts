import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// A user has label access if they are a manager of at least one label
// (label_managers is the source of truth; supports multiple managers per
// label). Admins/staff reach labels through the admin panel.
export function useLabelAccess() {
  const { user } = useAuth();
  const [labelId, setLabelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    supabase
      .from("label_managers")
      .select("label_id, labels!inner(id, active)")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (!active) return;
        const row = (data || []).find((r: any) => r.labels?.active);
        setLabelId(row?.label_id || null);
        setLoading(false);
      })
      .catch(() => {
        // Bij een fout: geen label-toegang aannemen i.p.v. blijven hangen.
        if (!active) return;
        setLabelId(null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  return { isLabelManager: !!labelId, labelId, loading };
}
