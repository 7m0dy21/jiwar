import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { logError, LoggedError, generateCorrelationId } from "@/lib/errorLogger";

export interface RoleFetchError {
  correlationId: string;
  code: string | null;
  message: string;
  hint?: string | null;
  attempts: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  roleError: RoleFetchError | null;
  retryRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  roleError: null,
  retryRole: async () => {},
  signOut: async () => {},
});

const MAX_AUTO_RETRIES = 3;

interface FetchRoleResult {
  role: string | null;
  error: { code: string | null; message: string; hint?: string | null } | null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<RoleFetchError | null>(null);
  const sessionRequestId = useRef(0);

  const fetchRole = async (userId: string): Promise<FetchRoleResult> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      return {
        role: null,
        error: {
          code: error.code ?? null,
          message: error.message || "تعذر جلب الصلاحيات",
          hint: (error as { hint?: string | null }).hint ?? null,
        },
      };
    }
    if (!data || data.length === 0) {
      return { role: null, error: null };
    }

    const priorities = ["admin", "merchant", "customer"];
    const sorted = [...data].sort(
      (a, b) => priorities.indexOf(a.role) - priorities.indexOf(b.role)
    );
    return { role: sorted[0].role, error: null };
  };

  const auditRoleCheck = async (
    correlationId: string,
    decision: "success" | "empty" | "error" | "retry_success",
    payload: {
      resolvedRole?: string | null;
      reason?: string | null;
      code?: string | null;
      attempts?: number;
      latencyMs?: number | null;
      details?: Record<string, unknown> | null;
    }
  ) => {
    try {
      await supabase.rpc("log_role_check" as never, {
        _correlation_id: correlationId,
        _decision: decision,
        _resolved_role: payload.resolvedRole ?? null,
        _reason: payload.reason ?? null,
        _code: payload.code ?? null,
        _attempts: payload.attempts ?? 1,
        _latency_ms: payload.latencyMs ?? null,
        _route: typeof window !== "undefined" ? window.location.pathname : null,
        _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        _details: (payload.details ?? null) as never,
      } as never);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[auth] log_role_check failed", e);
    }
  };

  const loadRoleWithRetry = async (userId: string, requestId: number) => {
    const correlationId = generateCorrelationId();
    const startedAt = Date.now();
    let lastError: FetchRoleResult["error"] = null;
    let attempts = 0;
    for (let attempt = 0; attempt < MAX_AUTO_RETRIES; attempt++) {
      attempts = attempt + 1;
      const { role: r, error } = await fetchRole(userId);
      if (sessionRequestId.current !== requestId) return;
      if (!error) {
        setRole(r);
        setRoleError(null);
        void auditRoleCheck(
          correlationId,
          r === null ? "empty" : attempts > 1 ? "retry_success" : "success",
          {
            resolvedRole: r,
            attempts,
            latencyMs: Date.now() - startedAt,
            reason:
              r === null
                ? "user_roles returned no rows — defaulted to unauthenticated view"
                : `resolved to ${r} in ${attempts} attempt(s)`,
          }
        );
        return;
      }
      lastError = error;
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
    if (sessionRequestId.current !== requestId) return;

    const logged: LoggedError = await logError({
      source: "auth.fetchRole",
      code: lastError?.code ?? "ROLE_FETCH_FAILED",
      message: lastError?.message ?? "تعذر التحقق من الصلاحيات",
      severity: "error",
      userId,
      details: {
        attempts,
        hint: lastError?.hint ?? null,
        correlationId,
      },
    });

    void auditRoleCheck(correlationId, "error", {
      reason: lastError?.message ?? "role fetch failed after retries",
      code: lastError?.code ?? "ROLE_FETCH_FAILED",
      attempts,
      latencyMs: Date.now() - startedAt,
      details: { hint: lastError?.hint ?? null, errorCorrelationId: logged.correlationId },
    });

    setRole(null);
    setRoleError({
      correlationId: logged.correlationId,
      code: logged.code,
      message: logged.message,
      hint: lastError?.hint ?? null,
      attempts,
    });
  };

  const applySession = async (nextSession: Session | null) => {
    const requestId = ++sessionRequestId.current;
    setLoading(true);
    setRoleError(null);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      if (sessionRequestId.current !== requestId) return;
      setRole(null);
      setLoading(false);
      return;
    }

    await loadRoleWithRetry(nextSession.user.id, requestId);
    if (sessionRequestId.current !== requestId) return;
    setLoading(false);
  };

  const retryRole = useCallback(async () => {
    if (!user) return;
    const requestId = ++sessionRequestId.current;
    setLoading(true);
    setRoleError(null);
    await loadRoleWithRetry(user.id, requestId);
    if (sessionRequestId.current !== requestId) return;
    setLoading(false);
  }, [user]);

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
    <AuthContext.Provider
      value={{ user, session, loading, role, roleError, retryRole, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
