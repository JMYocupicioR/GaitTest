create table if not exists public.clinical_exports (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null check (format in ('c3d', 'trc', 'mot')),
  storage_path text not null,
  file_size_bytes integer,
  target_system text,
  created_at timestamptz not null default now()
);

alter table public.clinical_exports enable row level security;

drop policy if exists "users can read their exports" on public.clinical_exports;
create policy "users can read their exports"
  on public.clinical_exports
  for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert their exports" on public.clinical_exports;
create policy "users can insert their exports"
  on public.clinical_exports
  for insert
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('clinical-exports', 'clinical-exports', false)
on conflict (id) do nothing;

drop policy if exists "users can read own clinical exports objects" on storage.objects;
create policy "users can read own clinical exports objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'clinical-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can upload own clinical exports objects" on storage.objects;
create policy "users can upload own clinical exports objects"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'clinical-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
