-- Auth + lightweight persistence migration for Supabase

ALTER TABLE public.session_records
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.gait_analysis_records
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.session_records
  DROP COLUMN IF EXISTS video_url;

CREATE TABLE IF NOT EXISTS public.gait_kinematic_series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  patient_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  joint TEXT NOT NULL CHECK (joint IN ('hip_flex', 'knee_flex', 'ankle_flex')),
  side TEXT NOT NULL CHECK (side IN ('L', 'R')),
  percent_cycle REAL[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (exam_id, joint, side)
);

CREATE TABLE IF NOT EXISTS public.gait_key_frames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  exam_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  foot TEXT NOT NULL CHECK (foot IN ('L', 'R')),
  timestamp_sec REAL NOT NULL,
  landmark_snapshot JSONB NOT NULL,
  thumbnail_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_records_user ON public.session_records (user_id);
CREATE INDEX IF NOT EXISTS idx_gait_analysis_records_user ON public.gait_analysis_records (user_id);
CREATE INDEX IF NOT EXISTS idx_gait_kinematic_series_user_exam ON public.gait_kinematic_series (user_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_gait_key_frames_user_exam ON public.gait_key_frames (user_id, exam_id);

ALTER TABLE public.session_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gait_analysis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gait_kinematic_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gait_key_frames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own session_records" ON public.session_records;
CREATE POLICY "Users see own session_records" ON public.session_records
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own gait_analysis_records" ON public.gait_analysis_records;
CREATE POLICY "Users see own gait_analysis_records" ON public.gait_analysis_records
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own gait_kinematic_series" ON public.gait_kinematic_series;
CREATE POLICY "Users see own gait_kinematic_series" ON public.gait_kinematic_series
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own gait_key_frames" ON public.gait_key_frames;
CREATE POLICY "Users see own gait_key_frames" ON public.gait_key_frames
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('gait-thumbnails', 'gait-thumbnails', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users read own thumbnails" ON storage.objects;
CREATE POLICY "Users read own thumbnails" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gait-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users upload own thumbnails" ON storage.objects;
CREATE POLICY "Users upload own thumbnails" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gait-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own thumbnails" ON storage.objects;
CREATE POLICY "Users update own thumbnails" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gait-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'gait-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
