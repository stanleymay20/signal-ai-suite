# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [0.7.0-rc1] — 2026-06-07

### Added

- Executive reporting suite: Executive Summary, Boardroom, Risk Brief,
  Forecast Brief, and Anomaly Investigation reports with PDF/PPTX export
  through signed URLs.
- Deterministic risk scoring engine with banded severity and driver
  attribution.
- Observability layer: `usage_events` telemetry, cost estimation, and the
  Admin Control Center.
- Enterprise hardening: per-user rate limiting, background job queue,
  retention purge, and signed-URL exports.
- Playwright end-to-end suite covering auth, upload, analysis, forecast,
  anomaly, chat, report, and admin flows.

### Changed

- Forecasting engine now persists per-model backtest predictions; the
  forecast-residual anomaly detector consumes exact timestamped predictions
  instead of a mean approximation.
- Authentication hardened: HIBP password check, 12-character minimum,
  full password recovery flow, and OAuth redirect resilience.

### Security

- RLS enforced on every workspace-scoped table, including `jobs` and
  `rate_limits`.
- Audit logging on report generation, export, deletion, and admin role
  changes.
