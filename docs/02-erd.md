# 02 — Entity Relationship Diagram

```text
auth.users (Supabase)
   │ 1
   │
   ▼ 1
profiles ──── role (app_role enum)
   │
   │ owner_id
   ▼
workspaces ◀───── workspace_members ─── user_id ─▶ auth.users
   │ 1                  (role: owner | admin | member)
   │
   ├──▶ datasets ──┬──▶ dataset_profiles  (1:1 latest)
   │               ├──▶ dataset_columns   (1:N)
   │               ├──▶ analyses          (1:N)
   │               ├──▶ forecasts         (1:N)
   │               ├──▶ anomaly_runs      (1:N)
   │               └──▶ conversations ──▶ messages (1:N)
   │
   └──▶ audit_logs (action, entity_type, entity_id, payload)
```

## Tables (domain fields)

| Table               | Purpose                                  | Key domain fields                                                                                                                                  |
| ------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`          | Per-user metadata mirroring `auth.users` | `full_name`, `email`, `avatar_url`, `role`                                                                                                         |
| `workspaces`        | Tenancy unit                             | `owner_id`, `name`, `description`                                                                                                                  |
| `workspace_members` | Membership                               | `workspace_id`, `user_id`, `role`                                                                                                                  |
| `datasets`          | Uploaded tabular file metadata           | `workspace_id`, `name`, `storage_path`, `row_count`, `column_count`, `status`                                                                      |
| `dataset_columns`   | Inferred schema                          | `dataset_id`, `name`, `inferred_type`, `null_count`, `distinct_count`                                                                              |
| `dataset_profiles`  | Phase 2 profile snapshot                 | `quality_score`, `summary_json`, `issues_json`                                                                                                     |
| `analyses`          | Phase 3 EDA run                          | `date_column`, `target_column`, `granularity`, `results_json`, `insights_json`, `anomalies_json`                                                   |
| `forecasts`         | Phase 4 forecast run                     | `horizon`, `granularity`, `model_name`, `forecast_points`, `confidence_intervals`, `metrics`, `model_comparison`, `assumptions`, `backtest_points` |
| `anomaly_runs`      | Phase 5 anomaly run                      | `methods`, `parameters`, `summary`, `anomalies`, `status` (`anomaly_status` enum)                                                                  |
| `conversations`     | Phase 6 chat thread                      | `workspace_id`, `dataset_id`, `title`                                                                                                              |
| `messages`          | Chat message                             | `conversation_id`, `role` (`message_role` enum), `content`, `citations`, `model`                                                                   |
| `audit_logs`        | Immutable activity log                   | `user_id`, `action`, `entity_type`, `entity_id`, `payload`                                                                                         |

## Enums

- `app_role` — `admin` \| `user`
- `anomaly_status` — `pending` \| `running` \| `completed` \| `failed`
- `message_role` — `user` \| `assistant` \| `system`

## Storage

- Bucket `datasets` (private) — raw CSV / JSON / Parquet uploads. Accessed
  only via signed URLs minted by server functions.

## Relationships in plain English

- A user belongs to one or more workspaces; one workspace is created
  automatically on sign-up (handled by `handle_new_user`).
- All analytical artefacts (`analyses`, `forecasts`, `anomaly_runs`,
  `conversations`) hang off a `dataset_id`, and every dataset belongs to
  exactly one workspace.
- Audit log rows are append-only and scoped to the acting user.
