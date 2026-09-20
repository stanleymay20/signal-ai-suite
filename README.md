# Signal AI Suite

**Evidence-Grounded Applied AI · Forecasting · Anomaly Detection · Provider-Agnostic LLM Layer**

Signal AI Suite is an analytics copilot for tabular data. It combines deterministic data analysis with a constrained AI explanation layer so the model explains **evidence the system has already computed** instead of inventing metrics or bypassing the analytical pipeline.

```text
Dataset
   ↓
Profile / deterministic analysis
   ↓
Forecasting + anomaly detection
   ↓
Evidence package + citations
   ↓
AI explanation layer
   ↓
Report / conversational interface
```

## Recruiter quick scan

**What this repository demonstrates**

- provider-agnostic LLM integration;
- Ollama and OpenAI-compatible provider adapters;
- compatibility with OpenAI-style gateways, vLLM, LM Studio and similar endpoints;
- evidence-grounded prompting and deterministic citation context;
- forecasting with model comparison/backtesting;
- multiple anomaly-detection strategies;
- structured executive reporting;
- workspace-scoped Row-Level Security;
- telemetry, audit logging and cost/usage observability;
- per-user rate limiting and background job processing;
- Vitest unit tests, Playwright E2E and CI across lint/typecheck/test/build.

## AI architecture

The AI layer is deliberately downstream of the analytical pipeline.

The provider interface lets the application switch between self-hosted and managed runtimes without changing the evidence contract. Current abstractions include:

- **Ollama** for local/self-hosted inference;
- **OpenAI-compatible endpoints** for OpenAI-style APIs, vLLM, LM Studio, Together and compatible gateways.

The model receives an evidence package and deterministic citation list. It is used to explain results, not to decide what evidence exists.

## Analytical capabilities

### Forecasting

Implemented forecasting paths include:

- Prophet;
- ARIMA;
- SARIMA;
- Exponential Smoothing;
- XGBoost baselines.

Forecast runs persist model outputs and comparison metrics so model selection can be inspected rather than hidden behind a single prediction.

### Anomaly detection

The system includes:

- Z-Score;
- MAD;
- IQR;
- Rolling Z;
- Forecast Residual detection.

The application separates deterministic anomaly evidence from AI-authored narrative.

### Reporting

Report modes include:

- Executive Summary;
- Boardroom;
- Risk Brief;
- Forecast Brief;
- Anomaly Investigation.

Report structure is deterministic, with AI narrative slots layered over computed evidence. Export flows support PDF/PPTX delivery through signed URLs.

## Production engineering

The repository contains production-oriented controls beyond the model layer:

- workspace-scoped RLS;
- audit logging;
- usage telemetry and cost estimation;
- per-user rate limits;
- background job queue;
- telemetry/audit retention controls;
- signed export URLs;
- deployment and rollback checklist.

See [`docs/`](./docs) for architecture, ERD, RLS, provider abstraction, forecasting, anomaly detection, AI grounding, observability, enterprise hardening and deployment documentation.

## Quality gates

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

The same core sequence is available as:

```bash
bun run audit:ci
```

End-to-end browser validation:

```bash
bun run test:e2e
```

CI runs linting, TypeScript checks, unit tests and the production build. Playwright E2E is maintained separately for preview/published or local environments.

## Quick start

```bash
bun install
cp .env.example .env
bun run dev
```

Do not commit live `.env` files or credentials.

## Evidence boundaries

Signal AI Suite is designed to reduce unsupported model claims by grounding AI explanations in precomputed evidence. That design does not make model output infallible.

Forecast quality still depends on the dataset, horizon and assumptions; anomaly flags require contextual interpretation; and production reliability should be established from current deployment/test evidence rather than README language alone.

## Documentation

- [Architecture](./docs/01-architecture.md)
- [ERD](./docs/02-erd.md)
- [RLS model](./docs/03-rls-model.md)
- [AI provider abstraction](./docs/04-provider-abstraction.md)
- [Forecasting pipeline](./docs/05-forecasting-pipeline.md)
- [Anomaly pipeline](./docs/06-anomaly-pipeline.md)
- [AI grounding flow](./docs/07-ai-grounding-flow.md)
- [Reporting pipeline](./docs/09-reporting-pipeline.md)
- [Observability](./docs/10-observability.md)
- [Enterprise hardening](./docs/11-enterprise-hardening.md)
- [Deployment checklist](./docs/12-deployment-checklist.md)

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE).
