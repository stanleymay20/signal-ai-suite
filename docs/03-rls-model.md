# 03 — RLS Model

Every user-facing table has Row Level Security enabled. There is no table that
relies on application code alone to enforce tenancy.

## Helper functions (SECURITY DEFINER, `search_path=public`)

```sql
has_role(_user_id uuid, _role app_role) returns boolean
is_workspace_member(_workspace_id uuid, _user_id uuid) returns boolean
is_workspace_owner(_workspace_id uuid, _user_id uuid) returns boolean
```

All three are `STABLE SECURITY DEFINER` with an explicit `SET search_path`.
They exist specifically so RLS policies do not have to perform recursive
table lookups (which would re-trigger RLS) and so policies remain readable.

## Policy shape

For every workspace-scoped table the policies follow the same template:

```sql
-- Read
USING (public.is_workspace_member(workspace_id, auth.uid()))

-- Write
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()))

-- Delete / destructive ops
USING  (public.is_workspace_owner(workspace_id, auth.uid()))
```

Tables that hang off a dataset (`analyses`, `forecasts`, `anomaly_runs`,
`conversations`, `messages`, `dataset_columns`, `dataset_profiles`) resolve
`workspace_id` through their parent dataset via a sub-select. Each table
includes a workspace-derived guard to keep the policies simple and to make
the index-on-`workspace_id` access path available.

## Grants

Every public-schema table created in a migration is followed by explicit
grants in the same migration:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
```

`anon` is never granted access to a user-facing table — there is no
unauthenticated read path in the application.

## Workspace bootstrap

`handle_new_user()` runs on `auth.users` insert and:

1. inserts a `profiles` row,
2. creates a personal workspace,
3. inserts a `workspace_members` row with role `owner`.

Result: the moment a user signs in, RLS already allows them to see exactly
one workspace — their own.

## Audit log

`audit_logs` rows are written by server functions at the end of every
phase-completing operation. Currently emitted:

- `dataset.uploaded`, `dataset.deleted`
- `analysis.completed`
- `forecast.completed`, `forecast.deleted`
- `anomaly.completed`, `anomaly.deleted`
- `conversation.created`, `conversation.deleted`
- `message.sent`

RLS on `audit_logs` allows users to read only their own rows; writes are
performed under the user's session (not service-role) so the policy chain
remains consistent.
