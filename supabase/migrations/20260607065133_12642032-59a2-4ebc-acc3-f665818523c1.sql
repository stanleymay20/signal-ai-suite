CREATE TYPE public.anomaly_status AS ENUM ('pending', 'running', 'ready', 'failed');

CREATE TABLE public.anomaly_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  computed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forecast_id UUID REFERENCES public.forecasts(id) ON DELETE SET NULL,
  date_column TEXT NOT NULL,
  target_column TEXT NOT NULL,
  granularity TEXT,
  aggregate TEXT NOT NULL DEFAULT 'mean',
  methods TEXT[] NOT NULL DEFAULT '{}',
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.anomaly_status NOT NULL DEFAULT 'pending',
  anomalies JSONB NOT NULL DEFAULT '[]'::jsonb,
  series JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX anomaly_runs_dataset_id_idx ON public.anomaly_runs(dataset_id);
CREATE INDEX anomaly_runs_workspace_id_idx ON public.anomaly_runs(workspace_id);
CREATE INDEX anomaly_runs_created_at_idx ON public.anomaly_runs(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anomaly_runs TO authenticated;
GRANT ALL ON public.anomaly_runs TO service_role;

ALTER TABLE public.anomaly_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view anomaly runs"
  ON public.anomaly_runs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert anomaly runs"
  ON public.anomaly_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND computed_by = auth.uid());

CREATE POLICY "Workspace members can update anomaly runs"
  ON public.anomaly_runs FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete anomaly runs"
  ON public.anomaly_runs FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER set_anomaly_runs_updated_at
  BEFORE UPDATE ON public.anomaly_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();