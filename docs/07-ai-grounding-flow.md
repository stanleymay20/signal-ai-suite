# 07 — AI Grounding Flow

This is the rule that the rest of the architecture exists to protect:

> The model produces narrative. Everything else — numbers, citations,
> follow-up suggestions — is produced by deterministic TypeScript and
> handed to the model as context.

## End-to-end flow

```text
user message
   │
   ▼
sendChatMessage server fn (workspace-scoped, RLS-bound)
   │
   ├──▶ persist user message
   │
   ├──▶ build Evidence Package
   │       ├── latest dataset_profile
   │       ├── latest analysis
   │       ├── latest forecast (incl. backtest_points)
   │       └── latest anomaly_run
   │
   ├──▶ deriveCitations(evidence)   ← deterministic, runs BEFORE the model
   │
   ├──▶ buildSystemMessage(evidence) + history + user message
   │
   ├──▶ provider.chat(...)          ← OllamaProvider / OpenAICompatibleProvider
   │
   ├──▶ persist assistant message
   │       { content, citations, model, provider, usage }
   │
   └──▶ audit_log: message.sent
```

## Evidence Package

`buildEvidencePackage({ datasetId, datasetName, profile, analysis,
forecast, anomalyRun })` produces a strict structure. Any field can be
`null`; `renderEvidence` prints `(no evidence available yet)` and
`suggestFollowups` will recommend running the missing phase.

## Citation engine

`deriveCitations(pkg)` emits one citation per present source plus
per-anomaly citations:

- profile → `{ source: "profile", ref: datasetId, detail: { quality_score, ... } }`
- analysis → `{ source: "analysis", ref: analysisId, detail: { trend, seasonality, ... } }`
- forecast → `{ source: "forecast", ref: forecastId, detail: { model, rmse, mae, mape } }`
- anomaly summary → `{ source: "anomaly", ref: anomalyRunId, detail: { total } }`
- anomaly examples → `{ source: "anomaly", ref: "<runId>:<t>", detail: { severity, method, score } }`

Because citations are produced **before** the model is called, the model
literally cannot invent a citation — its output is rendered next to a
citation list it did not author.

## System prompt rules

`SYSTEM_PROMPT` in `src/lib/ai/prompts.ts` enforces:

- ground every claim in the evidence package
- never invent metrics, forecasts, or anomalies
- never make causal claims unsupported by evidence
- when evidence is missing, say so and suggest the run that would fill it
- speak in plain English; reference dataset name and column names verbatim

## Follow-up suggestions

`suggestFollowups(pkg)` proposes next runs for missing evidence
("Run analysis", "Generate a forecast", "Run anomaly detection"). These
are rendered as chips in the chat UI and are also fully deterministic.

## What the AI is allowed to produce

- summary paragraphs that explain numbers already present in the evidence
- caveats grounded in the persisted `assumptions` array
- pointer language ("the forecast above projects …", "anomaly run x1 …")

## What the AI is not allowed to produce

- new metrics or percentages
- new forecast points or anomaly timestamps
- causal explanations not present in the evidence
- citations to anything other than the evidence package
