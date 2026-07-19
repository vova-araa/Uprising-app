// @refresh reset
import React, { createContext, useContext, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { clearRoleCache } from "@/hooks/useAdminRole";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST to catch all auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (loading) setLoading(false);
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    clearRoleCache();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  // During Fast Refresh the context module can be swapped while consumers still hold the old reference.
  // Returning a safe default avoids a crashing error overlay; the next render after HMR settles will re-attach.
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn("[useAuth] context not yet available (likely HMR); returning safe defaults");
      return {
        user: null,
        session: null,
        loading: true,
        signUp: async () => ({ data: null, error: new Error("auth not ready") }),
        signIn: async () => ({ error: new Error("auth not ready") }),
        signOut: async () => {},
      } as AuthContextType;
    }
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

if (import.meta.hot) {
  // Force a full reload of dependents when this module changes, so cached context identity stays in sync.
  import.meta.hot.invalidate();
}

