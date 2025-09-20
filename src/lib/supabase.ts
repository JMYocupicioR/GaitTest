import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types based on the CSV structure
export interface GaitAnalysisRecord {
  id?: string;
  patient_id: string;
  exam_id: string;
  side: 'L' | 'R';

  // Kinematic data
  hip_flex_ic?: number;
  hip_rot_mean?: number;
  knee_flex_mean_stance?: number;
  knee_flex_max_extension?: number;

  // Clinical data
  dx_mod?: string;
  dx_side?: string;
  faq?: number;
  gmfcs?: number;

  // Patient characteristics
  age?: number;
  height?: number;
  mass?: number;

  // Gait parameters
  cadence?: number;
  speed?: number;
  step_len?: number;
  leg_len?: number;
  bmi?: number;
  speed_norm?: number;
  step_len_norm?: number;
  cadence_norm?: number;

  // Metadata
  created_at?: string;
  updated_at?: string;
}

// Complete session data for longitudinal analysis
export interface SessionRecord {
  id?: string;
  patient_id: string;
  exam_id: string;
  session_date: string;

  // Session data as JSON
  session_data: any; // Complete SessionData object

  // Extracted key metrics for quick queries
  duration_seconds?: number;
  steps?: number;
  distance_meters?: number;
  avg_speed?: number;
  cadence?: number;

  // OGS scores
  ogs_left_total?: number;
  ogs_right_total?: number;
  ogs_quality_index?: number;
  ogs_asymmetry_index?: number;

  // Analysis results
  pathology_detected?: boolean;
  primary_pathology?: string;
  pathology_confidence?: number;

  // Patient info
  patient_name?: string;
  patient_age?: number;
  patient_height?: number;
  patient_weight?: number;

  created_at?: string;
  updated_at?: string;
}

// SQL for creating the tables
export const createTablesSQL = `
-- Table for individual gait analysis records (CSV format)
CREATE TABLE IF NOT EXISTS gait_analysis_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  side TEXT CHECK (side IN ('L', 'R')) NOT NULL,

  -- Kinematic data
  hip_flex_ic DECIMAL,
  hip_rot_mean DECIMAL,
  knee_flex_mean_stance DECIMAL,
  knee_flex_max_extension DECIMAL,

  -- Clinical data
  dx_mod TEXT,
  dx_side TEXT,
  faq INTEGER,
  gmfcs INTEGER,

  -- Patient characteristics
  age INTEGER,
  height DECIMAL,
  mass DECIMAL,

  -- Gait parameters
  cadence DECIMAL,
  speed DECIMAL,
  step_len DECIMAL,
  leg_len DECIMAL,
  bmi DECIMAL,
  speed_norm DECIMAL,
  step_len_norm DECIMAL,
  cadence_norm DECIMAL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(patient_id, exam_id, side)
);

-- Table for complete session records
CREATE TABLE IF NOT EXISTS session_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  session_date DATE NOT NULL,

  -- Complete session data as JSON
  session_data JSONB NOT NULL,

  -- Extracted metrics for indexing and quick queries
  duration_seconds INTEGER,
  steps INTEGER,
  distance_meters DECIMAL,
  avg_speed DECIMAL,
  cadence DECIMAL,

  -- OGS scores
  ogs_left_total INTEGER,
  ogs_right_total INTEGER,
  ogs_quality_index DECIMAL,
  ogs_asymmetry_index DECIMAL,

  -- Analysis results
  pathology_detected BOOLEAN DEFAULT FALSE,
  primary_pathology TEXT,
  pathology_confidence DECIMAL,

  -- Patient info (denormalized for quick access)
  patient_name TEXT,
  patient_age INTEGER,
  patient_height DECIMAL,
  patient_weight DECIMAL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(patient_id, exam_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gait_records_patient ON gait_analysis_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_gait_records_exam ON gait_analysis_records(exam_id);
CREATE INDEX IF NOT EXISTS idx_session_records_patient ON session_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_session_records_date ON session_records(session_date);
`;