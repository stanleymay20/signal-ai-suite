# Signal AI Suite

Evidence-grounded analytics copilot for tabular data. Upload a CSV/XLSX, get
deterministic profiling, exploratory analysis, forecasting, anomaly detection,
executive-grade reports, and a conversational assistant that explains the
evidence instead of inventing it.

## Highlights

- **Pipeline-first.** `Dataset → Profile → Analysis → Forecast → Anomalies →
Evidence Package → AI Explanation Layer`. The AI layer never bypasses the
  pipeline.
- **Provider-agnostic AI.** Ollama, vLLM, OpenAI-compatible endpoints,
  Qwen, DeepSeek, Llama. Self-host or use a managed gateway.
- **Forecasting.** Prophet, ARIMA, SARIMA, Exponential Smoothing, XGBoost
  baselines with backtested metrics and persisted predictions.
- **Anomaly detection.** Z-Score, MAD, IQR, Rolling Z, Forecast Residual —
  with deterministic severity, contributions, and impact estimates.
- **Executive reporting.** Executive Summary, Boardroom, Risk Brief,
  Forecast Brief, Anomaly Investigation. Deterministic structure + AI
  narrative slots, exported to PDF / PPTX through signed URLs.
- **Enterprise hardening.** Workspace-scoped RLS, audit logging, telemetry,
  per-user rate limits, background job queue, retention purge.

## Quick start

```bash
bun install
cp .env.example .env       # then fill in real values
bun run dev
```

| Script             | Purpose                     |
| ------------------ | --------------------------- |
| `bun run dev`      | Vite dev server             |
| `bun run build`    | Production build            |
| `bun run lint`     | ESLint                      |
| `bun run test`     | Vitest unit suite           |
| `bun run test:e2e` | Playwright end-to-end suite |
| `bun run format`   | Prettier                    |

## Documentation

Engineering documentation lives in [`docs/`](./docs):

- `01-architecture.md` — runtime topology and layering rules
- `02-erd.md` — database entities and relationships
- `03-rls-model.md` — row-level security patterns
- `04-provider-abstraction.md` — AI provider interface
- `05-forecasting-pipeline.md`
- `06-anomaly-pipeline.md`
- `07-ai-grounding-flow.md`
- `09-reporting-pipeline.md`
- `10-observability.md`
- `11-enterprise-hardening.md`
- `12-deployment-checklist.md`

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE).
