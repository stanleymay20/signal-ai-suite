/** Conversations & messages server functions.
 *
 * The chat layer is grounded: each assistant reply is generated from a
 * deterministic evidence package built by `src/lib/ai/retrieval.ts` and
 * accompanied by citations derived from that same package — the AI never
 * touches raw rows. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildEvidencePackage,
  deriveCitations,
  hasAnyEvidence,
  type Citation,
} from "./ai/retrieval";
import { buildSystemMessage, suggestFollowups } from "./ai/prompts";
import { resolveAIProvider, type ChatMessage } from "./ai/providers";

const uuid = z.string().uuid();

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ datasetId: uuid.optional(), workspaceId: uuid.optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("conversations")
      .select("id, title, dataset_id, workspace_id, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (data.datasetId) q = q.eq("dataset_id", data.datasetId);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: conv, error: cErr } = await context.supabase
      .from("conversations")
      .select("*")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conv) throw new Error("Conversation not found");
    const { data: msgs, error: mErr } = await context.supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);
    return { conversation: conv, messages: msgs ?? [] };
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        datasetId: uuid.nullable(),
        workspaceId: uuid,
        title: z.string().min(1).max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("conversations")
      .insert({
        workspace_id: data.workspaceId,
        dataset_id: data.datasetId,
        created_by: context.userId,
        title: data.title ?? "New conversation",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .delete()
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const MAX_HISTORY_MESSAGES = 20;

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conversationId: uuid,
        content: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Load conversation + dataset.
    const { data: conv, error: cErr } = await supabase
      .from("conversations")
      .select("id, dataset_id, workspace_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conv) throw new Error("Conversation not found");
    if (!conv.dataset_id) throw new Error("Conversation has no dataset attached");

    const { data: ds, error: dErr } = await supabase
      .from("datasets")
      .select("id, filename")
      .eq("id", conv.dataset_id)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!ds) throw new Error("Dataset not found");

    // 2. Retrieve latest evidence (parallel).
    const [profileQ, analysisQ, forecastQ, anomalyQ] = await Promise.all([
      supabase
        .from("dataset_profiles")
        .select("quality_score, summary_json, issues_json")
        .eq("dataset_id", ds.id)
        .maybeSingle(),
      supabase
        .from("analyses")
        .select(
          "id, created_at, date_column, target_column, granularity, results_json, insights_json, anomalies_json",
        )
        .eq("dataset_id", ds.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("forecasts")
        .select(
          "id, created_at, horizon, granularity, model_name, metrics, model_comparison, assumptions, forecast_points",
        )
        .eq("dataset_id", ds.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("anomaly_runs")
        .select("id, created_at, methods, summary, anomalies")
        .eq("dataset_id", ds.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const pkg = buildEvidencePackage({
      datasetId: ds.id,
      datasetName: ds.filename,
      profile: profileQ.data ?? null,
      analysis: analysisQ.data?.[0] ?? null,
      forecast: forecastQ.data?.[0] ?? null,
      anomalyRun: anomalyQ.data?.[0] ?? null,
    });

    // 3. Persist the user message.
    const { error: insUserErr } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      role: "user",
      content: data.content,
      citations_json: [],
      token_usage_json: {},
    });
    if (insUserErr) throw new Error(insUserErr.message);

    // 4. If there is no evidence at all, short-circuit with a grounded refusal.
    if (!hasAnyEvidence(pkg)) {
      const refusal =
        "I don't have any evidence for this dataset yet. Run a profile, analysis, forecast, or anomaly detection first so I can ground my answer.";
      const { data: aRow, error: aErr } = await supabase
        .from("messages")
        .insert({
          conversation_id: conv.id,
          role: "assistant",
          content: refusal,
          citations_json: [],
          token_usage_json: { reason: "no_evidence" },
        })
        .select("*")
        .single();
      if (aErr) throw new Error(aErr.message);
      return {
        message: aRow,
        citations: [] as Citation[],
        followups: suggestFollowups(pkg),
      };
    }

    // 5. Load short history (already includes the just-inserted user message).
    const { data: history, error: hErr } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    if (hErr) throw new Error(hErr.message);

    const recent = (history ?? []).slice(-MAX_HISTORY_MESSAGES);
    const chatMessages: ChatMessage[] = [
      { role: "system", content: buildSystemMessage(pkg) },
      ...recent.map((m) => ({
        role: m.role as ChatMessage["role"],
        content: m.content,
      })),
    ];

    // 6. Call provider.
    const provider = resolveAIProvider({
      AI_PROVIDER: process.env.AI_PROVIDER,
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
      OLLAMA_MODEL: process.env.OLLAMA_MODEL,
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      LOVABLE_API_KEY: process.env.LOVABLE_API_KEY,
    });

    let answer: string;
    let usage: Record<string, unknown> = {};
    try {
      const result = await provider.chat(chatMessages, {
        temperature: 0.2,
        maxTokens: 1024,
      });
      answer = result.content || "(empty response)";
      usage = {
        provider: result.provider,
        model: result.model,
        prompt_tokens: result.usage.promptTokens,
        completion_tokens: result.usage.completionTokens,
        total_tokens: result.usage.totalTokens,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI provider error";
      throw new Error(`AI provider failed: ${msg}`);
    }

    const citations = deriveCitations(pkg);

    // 7. Persist assistant message with citations.
    const { data: aRow, error: aErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conv.id,
        role: "assistant",
        content: answer,
        citations_json: JSON.parse(JSON.stringify(citations)),
        token_usage_json: JSON.parse(JSON.stringify(usage)),
      })
      .select("*")
      .single();
    if (aErr) throw new Error(aErr.message);

    // Touch updated_at on the conversation.
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conv.id);

    return {
      message: aRow,
      citations,
      followups: suggestFollowups(pkg),
    };
  });
