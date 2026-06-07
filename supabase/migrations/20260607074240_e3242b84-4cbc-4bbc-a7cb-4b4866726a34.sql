
CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  status TEXT NOT NULL CHECK (status IN ('success','error')),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  provider TEXT,
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own usage events"
  ON public.usage_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Users read their own usage events"
  ON public.usage_events FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

CREATE POLICY "Admins read all usage events"
  ON public.usage_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX usage_events_created_at_idx ON public.usage_events (created_at DESC);
CREATE INDEX usage_events_action_idx ON public.usage_events (action);
CREATE INDEX usage_events_actor_idx ON public.usage_events (actor_id);
CREATE INDEX usage_events_status_idx ON public.usage_events (status);
