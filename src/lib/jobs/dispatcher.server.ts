/** Job dispatcher used by the /api/public/hooks/jobs-tick worker route.
 *
 * The router claims one queued job via `claim_next_job()` (atomic),
 * dispatches based on `type` to a handler that does the actual work, then
 * marks the job as `succeeded` or `failed`. Failed jobs are re-eligible
 * automatically until `attempts >= max_attempts`.
 *
 * All handlers receive the service-role client (RLS bypassed) because the
 * job runs out-of-band from the originating user request. Handlers must
 * therefore re-derive workspace/permissions from the job row itself.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runReportJob } from "./runReportJob.server";

type AnyClient = typeof supabaseAdmin;

export interface JobRow {
  id: string;
  workspace_id: string;
  dataset_id: string | null;
  created_by: string;
  type: "dataset_profile" | "analysis" | "forecast" | "anomaly" | "report";
  status: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export type JobHandler = (job: JobRow, client: AnyClient) => Promise<Record<string, unknown>>;

const HANDLERS: Partial<Record<JobRow["type"], JobHandler>> = {
  report: runReportJob,
};

export async function processOneJob(): Promise<
  | { kind: "idle" }
  | { kind: "succeeded"; jobId: string; type: string; durationMs: number }
  | { kind: "failed"; jobId: string; type: string; error: string; durationMs: number }
  | { kind: "unsupported"; jobId: string; type: string }
> {
  const { data: claimed, error: claimErr } = await supabaseAdmin.rpc("claim_next_job");
  if (claimErr) throw new Error(`claim_next_job: ${claimErr.message}`);
  const rows = claimed as unknown as JobRow[] | null;
  if (!rows || rows.length === 0) return { kind: "idle" };

  const job = rows[0];
  const handler = HANDLERS[job.type];
  const t0 = Date.now();

  if (!handler) {
    await markFailed(job.id, `Unsupported job type: ${job.type}`);
    return { kind: "unsupported", jobId: job.id, type: job.type };
  }

  try {
    const result = await handler(job, supabaseAdmin);
    const durationMs = Date.now() - t0;
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "succeeded",
        result: result as never,
        finished_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", job.id);
    return { kind: "succeeded", jobId: job.id, type: job.type, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - t0;
    const shouldRetry = job.attempts < job.max_attempts;
    await supabaseAdmin
      .from("jobs")
      .update({
        status: shouldRetry ? "queued" : "failed",
        finished_at: shouldRetry ? null : new Date().toISOString(),
        error_message: message,
      })
      .eq("id", job.id);
    return { kind: "failed", jobId: job.id, type: job.type, error: message, durationMs };
  }
}

async function markFailed(jobId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("jobs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: message,
    })
    .eq("id", jobId);
}
