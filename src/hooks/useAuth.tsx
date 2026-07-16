import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const sessionRequestId = useRef(0);

  const fetchRole = async (userId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error || !data || data.length === 0) {
      return null;
    }

    // Prioritize: admin > merchant > customer
    const priorities = ["admin", "merchant", "customer"];
    const sorted = [...data].sort((a, b) => priorities.indexOf(a.role) - priorities.indexOf(b.role));
    return sorted[0].role;
  };

  const applySession = async (nextSession: Session | null) => {
    const requestId = ++sessionRequestId.current;
    setLoading(true);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    const nextRole = nextSession?.user ? await fetchRole(nextSession.user.id) : null;

    if (sessionRequestId.current !== requestId) return;
    setRole(nextRole);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setTimeout(() => {
          applySession(session);
        }, 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
