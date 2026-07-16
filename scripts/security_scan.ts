/**
 * CI Security Scan — enumerates DB security posture and fails if NEW findings
 * appear vs. scripts/security_baseline.json. Blocks merges on regressions.
 *
 * Findings surfaced:
 *   • RLS_DISABLED:<table>          — public table without RLS
 *   • RLS_NO_POLICIES:<table>       — RLS on but zero policies (locked-out or misconfigured)
 *   • SECDEF_ANON_EXECUTE:<fn>      — SECURITY DEFINER function EXECUTE-able by anon
 *   • SECDEF_PUBLIC_EXECUTE:<fn>    — SECURITY DEFINER function EXECUTE-able by PUBLIC
 *
 * A baseline JSON lists finding IDs that are accepted as intentional. Anything
 * outside the baseline is a NEW finding and fails CI. Update the baseline in a
 * PR (with justification) to accept a new intentional posture.
 *
 * Run:
 *   deno run --allow-net --allow-env --allow-read scripts/security_scan.ts
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(2);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const { data, error } = await sb.rpc("_ci_security_scan_probe");
if (error) {
  console.error("❌ _ci_security_scan_probe() is not installed. Apply the latest migrations first.");
  console.error("   Underlying error:", error.message);
  Deno.exit(2);
}

const snap = data as {
  tables: Array<{ table: string; rls_enabled: boolean; policy_count: number }>;
  security_definer_functions: Array<{
    function: string;
    anon_execute: boolean;
    public_execute: boolean;
    authenticated_execute: boolean;
  }>;
};

// Skip internal/probe helpers to reduce noise.
const SKIP_FN = new Set(["_ci_db_guardrails_probe", "_ci_security_scan_probe"]);

const findings: string[] = [];
for (const t of snap.tables ?? []) {
  if (!t.rls_enabled) findings.push(`RLS_DISABLED:${t.table}`);
  else if ((t.policy_count ?? 0) === 0) findings.push(`RLS_NO_POLICIES:${t.table}`);
}
for (const f of snap.security_definer_functions ?? []) {
  if (SKIP_FN.has(f.function)) continue;
  if (f.anon_execute) findings.push(`SECDEF_ANON_EXECUTE:${f.function}`);
  if (f.public_execute) findings.push(`SECDEF_PUBLIC_EXECUTE:${f.function}`);
}

// Load baseline of accepted findings.
type Baseline = { accepted: string[] };
let baseline: Baseline = { accepted: [] };
try {
  const raw = await Deno.readTextFile(new URL("./security_baseline.json", import.meta.url));
  baseline = JSON.parse(raw) as Baseline;
} catch (_) {
  console.warn("⚠️  scripts/security_baseline.json not found — treating baseline as empty.");
}
const accepted = new Set(baseline.accepted ?? []);

const found = new Set(findings);
const newFindings = [...found].filter((f) => !accepted.has(f)).sort();
const staleAccepted = [...accepted].filter((f) => !found.has(f)).sort();

console.log(`Scan summary: ${found.size} finding(s), ${accepted.size} accepted in baseline.`);

if (staleAccepted.length > 0) {
  console.log("ℹ️  Stale baseline entries (no longer present, safe to remove):");
  for (const f of staleAccepted) console.log("     • " + f);
}

if (newFindings.length > 0) {
  console.error(`\n❌ ${newFindings.length} NEW security finding(s) — merge blocked:`);
  for (const f of newFindings) console.error("   • " + f);
  console.error(
    "\n   Fix the underlying issue, or (if intentional) add the finding ID to " +
      "scripts/security_baseline.json with justification in the PR description.",
  );
  Deno.exit(1);
}

console.log("✅ No new security findings vs. baseline.");
