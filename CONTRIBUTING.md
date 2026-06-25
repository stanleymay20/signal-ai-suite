# Contributing

Thanks for taking the time to contribute to Signal AI Suite.

## Ground rules

- Keep the pipeline deterministic. KPIs, forecasts, anomalies, citations, and
  risk scores are computed from real data — never authored by the AI layer.
- Pure-TS analytics utilities must remain framework-free and unit-tested.
- All workspace-scoped tables ship with RLS policies and audit logging.
- Never read secrets at module scope in shared files; read them inside
  request handlers or server-only modules.

## Workflow

1. Fork and create a feature branch.
2. `bun install`, then run `bun run dev`.
3. Add or update unit tests for any behavior change.
4. Before opening a PR, ensure the following all pass:
   ```bash
   bun run lint
   bun run typecheck
   bun run test
   bun run build
   ```
5. Update relevant docs under `docs/` when the change is user- or
   operator-visible.

## Commit style

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
`test:`). Keep messages imperative and scoped.

## Security

Report vulnerabilities privately to the maintainers rather than opening a
public issue.
