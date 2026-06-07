ALTER TABLE public.forecasts
  ADD COLUMN backtest_points JSONB NOT NULL DEFAULT '[]'::jsonb;