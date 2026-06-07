
CREATE TYPE public.forecast_status AS ENUM ('pending', 'running', 'ready', 'failed');

CREATE TABLE public.forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  computed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date_column TEXT,
  target_column TEXT,
  granularity TEXT,
  model_name TEXT NOT NULL,
  horizon INTEGER NOT NULL,
  train_range JSONB NOT NULL DEFAULT '{}'::jsonb,
  forecast_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_intervals JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_comparison JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.forecast_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX forecasts_dataset_id_idx ON public.forecasts(dataset_id);
CREATE INDEX forecasts_workspace_id_idx ON public.forecasts(workspace_id);
CREATE INDEX forecasts_created_at_idx ON public.forecasts(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecasts TO authenticated;
GRANT ALL ON public.forecasts TO service_role;

ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view forecasts"
  ON public.forecasts FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can create forecasts"
  ON public.forecasts FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND computed_by = auth.uid());

CREATE POLICY "Members can update forecasts"
  ON public.forecasts FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can delete forecasts"
  ON public.forecasts FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER forecasts_set_updated_at
  BEFORE UPDATE ON public.forecasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
