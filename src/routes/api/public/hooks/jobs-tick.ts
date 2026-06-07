/** Worker route for the background job queue.
 *
 * Called periodically by pg_cron. Authenticates the caller by requiring the
 * Supabase publishable key in the `apikey` header. Processes up to
 * MAX_JOBS_PER_TICK jobs per invocation; loops until idle or the budget
 * is exhausted so a single tick can drain a small backlog quickly. */

import { createFileRoute } from "@tanstack/react-router";
import { processOneJob } from "@/lib/jobs/dispatcher.server";

const MAX_JOBS_PER_TICK = 5;
const SOFT_DEADLINE_MS = 25_000;

function authorized(request: Request): boolean {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!expected) return false;
  const apiKey = request.headers.get("apikey");
  return Boolean(apiKey && apiKey === expected);
}

export const Route = createFileRoute("/api/public/hooks/jobs-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const t0 = Date.now();
        const results: unknown[] = [];

        for (let i = 0; i < MAX_JOBS_PER_TICK; i++) {
          if (Date.now() - t0 > SOFT_DEADLINE_MS) break;
          try {
            const r = await processOneJob();
            results.push(r);
            if (r.kind === "idle") break;
          } catch (err) {
            results.push({
              kind: "tick_error",
              error: err instanceof Error ? err.message : String(err),
            });
            break;
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            processed: results.length,
            durationMs: Date.now() - t0,
            results,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
