/** Background-job server functions: enqueue, list, get.
 *
 * The worker is a separate server route at /api/public/hooks/jobs-tick that
 * runs on a pg_cron schedule. This module owns only the user-facing surface
 * (enqueue & inspect). */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

const jobType = z.enum(["dataset_profile", "analysis", "forecast", "anomaly", "report"]);

export const enqueueJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: uuid,
        datasetId: uuid.nullable().optional(),
        type: jobType,
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const insertPayload = {
      workspace_id: data.workspaceId,
      dataset_id: data.datasetId ?? null,
      created_by: userId,
      type: data.type,
      status: "queued",
      payload: data.payload,
    } as never;
    const { data: row, error } = await supabase
      .from("jobs")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "job.enqueued",
      metadata: { job_id: row.id, type: data.type, dataset_id: data.datasetId },
    });
    return row;
  });

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: uuid.optional(),
        datasetId: uuid.optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("jobs")
      .select(
        "id, type, status, attempts, max_attempts, error_message, created_at, started_at, finished_at, dataset_id, workspace_id",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);
    if (data.datasetId) q = q.eq("dataset_id", data.datasetId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Job not found");
    return row;
  });
