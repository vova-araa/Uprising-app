import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { prefetchAdminPages } from "@/lib/prefetch";

/**
 * Centralized admin/staff role check hook.
 * Caches result per user to avoid duplicate RPC calls across components.
 */
const roleCache = new Map<string, boolean>();

export const useAdminRole = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    // Check cache first
    if (roleCache.has(user.id)) {
      const cached = roleCache.get(user.id)!;
      setIsAdmin(cached);
      if (cached) prefetchAdminPages();
      return;
    }

    const check = async () => {
      const [adminRes, staffRes] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as const }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "staff" as const }),
      ]);
      const hasAccess = adminRes.data === true || staffRes.data === true;
      roleCache.set(user.id, hasAccess);
      setIsAdmin(hasAccess);
      if (hasAccess) prefetchAdminPages();
    };
    check();
  }, [user]);

  return { isAdmin, loading: isAdmin === null };
};

// Clear cache on sign out
export const clearRoleCache = () => roleCache.clear();
