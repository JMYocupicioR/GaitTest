alter table if exists public.session_records
  add column if not exists estimated_height decimal,
  add column if not exists height_source text,
  add column if not exists leg_length_derived decimal,
  add column if not exists bmi_derived decimal;
