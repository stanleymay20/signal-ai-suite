
CREATE TYPE public.analysis_status AS ENUM ('pending', 'running', 'ready', 'failed');

CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  computed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date_column TEXT,
  target_column TEXT,
  granularity TEXT,
  status public.analysis_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  results_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  insights_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  anomalies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX analyses_dataset_idx ON public.analyses(dataset_id, created_at DESC);
CREATE INDEX analyses_workspace_idx ON public.analyses(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO authenticated;
GRANT ALL ON public.analyses TO service_role;

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view analyses"
  ON public.analyses FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members insert analyses"
  ON public.analyses FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members update analyses"
  ON public.analyses FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members delete analyses"
  ON public.analyses FOR DELETE
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER analyses_set_updated_at
  BEFORE UPDATE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
