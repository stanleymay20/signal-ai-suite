
-- Phase 9 part A: rate limiting, background job queue, retention.

-- ============================================================================
-- 1. RATE LIMITS
-- ============================================================================
CREATE TABLE public.rate_limits (
  user_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, window_start)
);

CREATE INDEX idx_rate_limits_window ON public.rate_limits (window_start);

GRANT SELECT ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their own rate-limit counters (visibility only — function
-- is the only writer because it runs SECURITY DEFINER).
CREATE POLICY "Users read own rate limits"
  ON public.rate_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Atomic fixed-window check-and-increment.
-- Returns: { allowed, count, limit, remaining, window_start, reset_at }
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _action text,
  _max integer,
  _window_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz;
  _new_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;
  IF _max < 1 OR _window_seconds < 1 THEN
    RAISE EXCEPTION 'limit and window must be positive';
  END IF;

  _bucket := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.rate_limits AS rl (user_id, action, window_start, count)
  VALUES (_user_id, _action, _bucket, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET count = rl.count + 1
  RETURNING count INTO _new_count;

  RETURN jsonb_build_object(
    'allowed', _new_count <= _max,
    'count', _new_count,
    'limit', _max,
    'remaining', GREATEST(0, _max - _new_count),
    'window_start', _bucket,
    'reset_at', _bucket + make_interval(secs => _window_seconds)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO authenticated, service_role;

-- ============================================================================
-- 2. BACKGROUND JOB QUEUE
-- ============================================================================
CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE public.job_type AS ENUM ('dataset_profile', 'analysis', 'forecast', 'anomaly', 'report');

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  dataset_id uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  type public.job_type NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_status_scheduled ON public.jobs (status, scheduled_at);
CREATE INDEX idx_jobs_workspace_created ON public.jobs (workspace_id, created_at DESC);
CREATE INDEX idx_jobs_dataset ON public.jobs (dataset_id) WHERE dataset_id IS NOT NULL;

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read jobs"
  ON public.jobs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members enqueue jobs"
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id, auth.uid())
    AND created_by = auth.uid()
  );

-- Only admins (or service_role) can mutate job lifecycle from SQL.
CREATE POLICY "Admins update jobs"
  ON public.jobs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Atomic claim function for the worker — locks one queued job and flips it
-- to 'running'. Returns the claimed row or empty set.
CREATE OR REPLACE FUNCTION public.claim_next_job()
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id
  FROM public.jobs
  WHERE status = 'queued'
    AND scheduled_at <= now()
    AND attempts < max_attempts
  ORDER BY scheduled_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF _id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.jobs
  SET status = 'running',
      started_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  WHERE id = _id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_job() TO service_role;

-- ============================================================================
-- 3. RETENTION
-- ============================================================================
-- Default 90-day retention for usage_events. audit_logs retained 180 days.
-- rate_limits buckets older than 7 days are deleted.
CREATE OR REPLACE FUNCTION public.purge_telemetry_retention(
  _usage_days integer DEFAULT 90,
  _audit_days integer DEFAULT 180,
  _rate_limit_days integer DEFAULT 7
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _u bigint;
  _a bigint;
  _r bigint;
BEGIN
  WITH del AS (
    DELETE FROM public.usage_events
    WHERE created_at < now() - make_interval(days => _usage_days)
    RETURNING 1
  ) SELECT count(*) INTO _u FROM del;

  WITH del AS (
    DELETE FROM public.audit_logs
    WHERE created_at < now() - make_interval(days => _audit_days)
    RETURNING 1
  ) SELECT count(*) INTO _a FROM del;

  WITH del AS (
    DELETE FROM public.rate_limits
    WHERE window_start < now() - make_interval(days => _rate_limit_days)
    RETURNING 1
  ) SELECT count(*) INTO _r FROM del;

  RETURN jsonb_build_object(
    'usage_events_deleted', _u,
    'audit_logs_deleted', _a,
    'rate_limits_deleted', _r,
    'run_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_telemetry_retention(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_telemetry_retention(integer, integer, integer) TO service_role;
