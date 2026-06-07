/** Admin / observability server functions.
 *
 * All read endpoints are admin-gated via `has_role(user, 'admin')` enforced
 * at the database level by the `usage_events` SELECT policies plus an
 * explicit check here for clearer errors. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeOverview,
  groupByAction,
  groupByProviderModel,
  topUsers,
  type UsageEventRow,
} from "./observability/aggregations";

// Loose type so this module doesn't depend on the full Supabase generic chain
// (which has had inference-depth issues with TS2589 on newly-added tables).
type AnySupabase = {
  from: (t: string) => {
    select: (s: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { role?: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

async function ensureAdmin(supabase: unknown, userId: string): Promise<void> {
  const sb = supabase as AnySupabase;
  const { data, error } = await sb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") throw new Error("Admin access required");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();
    return { isAdmin: data?.role === "admin" };
  });

const windowSchema = z.object({
  windowHours: z.number().int().min(1).max(24 * 30).optional(),
});

function sinceISO(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => windowSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const windowHours = data.windowHours ?? 24;
    const since = sinceISO(windowHours);

    const { data: rows, error } = await context.supabase
      .from("usage_events")
      .select(
        "id, action, status, duration_ms, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at, actor_id, workspace_id, error_message",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const events = (rows ?? []) as unknown as UsageEventRow[];

    return {
      windowHours,
      since,
      overview: computeOverview(events),
      byAction: groupByAction(events),
      byProviderModel: groupByProviderModel(events),
      topUsers: topUsers(events, 10),
    };
  });

const listSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  status: z.enum(["success", "error"]).optional(),
  action: z.string().min(1).max(100).optional(),
});

export const listUsageEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);

    let q = context.supabase
      .from("usage_events")
      .select(
        "id, action, status, duration_ms, provider, model, total_tokens, cost_usd, created_at, actor_id, error_message, resource_type, resource_id",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status) q = q.eq("status", data.status);
    if (data.action) q = q.eq("action", data.action);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
