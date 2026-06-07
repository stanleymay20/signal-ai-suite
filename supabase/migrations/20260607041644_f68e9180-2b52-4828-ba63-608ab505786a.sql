
CREATE TYPE public.dataset_status AS ENUM ('uploading','profiling','ready','failed');
CREATE TYPE public.column_data_type AS ENUM ('numeric','integer','boolean','date','datetime','string','categorical','unknown');

CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv','xlsx')),
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  row_count INTEGER,
  column_count INTEGER,
  status public.dataset_status NOT NULL DEFAULT 'uploading',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_datasets_workspace ON public.datasets(workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view datasets" ON public.datasets FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Members insert datasets" ON public.datasets FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "Uploader or owner update" ON public.datasets FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_workspace_owner(workspace_id, auth.uid()))
  WITH CHECK (uploaded_by = auth.uid() OR public.is_workspace_owner(workspace_id, auth.uid()));
CREATE POLICY "Uploader or owner delete" ON public.datasets FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_workspace_owner(workspace_id, auth.uid()));

CREATE TRIGGER datasets_set_updated_at BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dataset_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  column_name TEXT NOT NULL,
  position INTEGER NOT NULL,
  data_type public.column_data_type NOT NULL DEFAULT 'unknown',
  nullable BOOLEAN NOT NULL DEFAULT true,
  unique_ratio NUMERIC(6,5),
  missing_percentage NUMERIC(6,3),
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dataset_id, column_name)
);
CREATE INDEX idx_dataset_columns_dataset ON public.dataset_columns(dataset_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_columns TO authenticated;
GRANT ALL ON public.dataset_columns TO service_role;
ALTER TABLE public.dataset_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view dataset columns" ON public.dataset_columns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.datasets d
    WHERE d.id = dataset_id AND public.is_workspace_member(d.workspace_id, auth.uid())));
CREATE POLICY "Members manage dataset columns" ON public.dataset_columns FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.datasets d
    WHERE d.id = dataset_id AND public.is_workspace_member(d.workspace_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.datasets d
    WHERE d.id = dataset_id AND public.is_workspace_member(d.workspace_id, auth.uid())));

CREATE TABLE public.dataset_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE UNIQUE,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  issues_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_profiles TO authenticated;
GRANT ALL ON public.dataset_profiles TO service_role;
ALTER TABLE public.dataset_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view dataset profiles" ON public.dataset_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.datasets d
    WHERE d.id = dataset_id AND public.is_workspace_member(d.workspace_id, auth.uid())));
CREATE POLICY "Members manage dataset profiles" ON public.dataset_profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.datasets d
    WHERE d.id = dataset_id AND public.is_workspace_member(d.workspace_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.datasets d
    WHERE d.id = dataset_id AND public.is_workspace_member(d.workspace_id, auth.uid())));

CREATE TRIGGER dataset_profiles_set_updated_at BEFORE UPDATE ON public.dataset_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
