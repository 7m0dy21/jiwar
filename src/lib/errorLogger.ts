import { supabase } from "@/integrations/supabase/client";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface LogErrorInput {
  source: string;
  message: string;
  code?: string | null;
  details?: Record<string, unknown> | null;
  severity?: ErrorSeverity;
  userId?: string | null;
}

export interface LoggedError {
  correlationId: string;
  code: string | null;
  message: string;
  source: string;
  timestamp: string;
}

/**
 * Generates a short human-readable correlation id like ERR-K3F9-8Q2M.
 */
export const generateCorrelationId = (): string => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () =>
    Array.from({ length: 4 }, () =>
      alphabet.charAt(Math.floor(Math.random() * alphabet.length))
    ).join("");
  return `ERR-${pick()}-${pick()}`;
};

/**
 * Centralized error logging. Writes to `public.error_logs` and mirrors to
 * console so developers can still see the failure locally.
 */
export const logError = async (input: LogErrorInput): Promise<LoggedError> => {
  const correlationId = generateCorrelationId();
  const timestamp = new Date().toISOString();
  const payload = {
    correlation_id: correlationId,
    user_id: input.userId ?? null,
    source: input.source,
    code: input.code ?? null,
    message: input.message,
    details: input.details ?? null,
    severity: input.severity ?? "error",
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent : null,
    route:
      typeof window !== "undefined" ? window.location.pathname : null,
  };

  // eslint-disable-next-line no-console
  console.error(`[${input.source}] ${correlationId}`, {
    code: input.code,
    message: input.message,
    details: input.details,
  });

  try {
    await supabase.from("error_logs").insert(payload);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("errorLogger: failed to persist error log", e);
  }

  return {
    correlationId,
    code: input.code ?? null,
    message: input.message,
    source: input.source,
    timestamp,
  };
};
