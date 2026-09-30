-- Auditable batch history for historical data imports.
create table if not exists public.legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_rows integer not null check (total_rows >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null default 'RUNNING' check (status in ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS')),
  created_by uuid not null references public.profiles(id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.legacy_import_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.legacy_import_batches(id) on delete cascade,
  source_row integer not null,
  job_no text,
  certification_no text,
  status text not null check (status in ('SUCCESS', 'FAILED')),
  error_message text,
  candidate_id uuid references public.candidates(id),
  application_id uuid references public.applications(id),
  job_id uuid references public.jobs(id),
  created_at timestamptz not null default now(),
  unique(batch_id, source_row)
);

create index if not exists legacy_import_batches_created_at_idx on public.legacy_import_batches(created_at desc);
create index if not exists legacy_import_entries_batch_id_idx on public.legacy_import_entries(batch_id, source_row);
alter table public.legacy_import_batches enable row level security;
alter table public.legacy_import_entries enable row level security;
drop policy if exists legacy_import_batches_admin_select on public.legacy_import_batches;
drop policy if exists legacy_import_entries_admin_select on public.legacy_import_entries;
create policy legacy_import_batches_admin_select on public.legacy_import_batches for select to authenticated using (public.is_admin());
create policy legacy_import_entries_admin_select on public.legacy_import_entries for select to authenticated using (public.is_admin());

create or replace function public.start_legacy_import_batch(p_file_name text, p_total_rows integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.is_admin() then raise exception 'Administrator account required'; end if;
  select display_name into v_name from public.profiles where id = auth.uid();
  insert into public.legacy_import_batches(file_name, total_rows, created_by, created_by_name)
  values (coalesce(nullif(trim(p_file_name), ''), 'unnamed.csv'), p_total_rows, auth.uid(), coalesce(v_name, '관리자')) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.import_legacy_certification_row_v3(p_batch_id uuid, p_source_row integer, p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare imported jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator account required'; end if;
  if not exists(select 1 from public.legacy_import_batches where id = p_batch_id and created_by = auth.uid() and status = 'RUNNING') then raise exception 'Active import batch not found'; end if;
  imported := public.import_legacy_certification_row_v2(p_row);
  insert into public.legacy_import_entries(batch_id, source_row, job_no, certification_no, status, candidate_id, application_id, job_id)
  values (p_batch_id, p_source_row, nullif(trim(p_row->>'jobNo'), ''), nullif(trim(p_row->>'certificationNo'), ''), 'SUCCESS', (imported->>'candidate_id')::uuid, (imported->>'application_id')::uuid, (imported->>'job_id')::uuid);
  update public.legacy_import_batches set success_count = success_count + 1 where id = p_batch_id;
  return imported;
end; $$;

create or replace function public.record_legacy_import_failure(p_batch_id uuid, p_source_row integer, p_row jsonb, p_error_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator account required'; end if;
  if not exists(select 1 from public.legacy_import_batches where id = p_batch_id and created_by = auth.uid() and status = 'RUNNING') then raise exception 'Active import batch not found'; end if;
  insert into public.legacy_import_entries(batch_id, source_row, job_no, certification_no, status, error_message)
  values (p_batch_id, p_source_row, nullif(trim(p_row->>'jobNo'), ''), nullif(trim(p_row->>'certificationNo'), ''), 'FAILED', left(coalesce(p_error_message, 'Unknown error'), 2000))
  on conflict (batch_id, source_row) do update set status = 'FAILED', error_message = excluded.error_message, created_at = now();
  update public.legacy_import_batches set failed_count = failed_count + 1 where id = p_batch_id;
end; $$;

create or replace function public.complete_legacy_import_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator account required'; end if;
  update public.legacy_import_batches
     set status = case when failed_count > 0 then 'COMPLETED_WITH_ERRORS' else 'COMPLETED' end,
         completed_at = now()
   where id = p_batch_id and created_by = auth.uid() and status = 'RUNNING';
  if not found then raise exception 'Active import batch not found'; end if;
end; $$;

revoke all on table public.legacy_import_batches, public.legacy_import_entries from anon, authenticated;
grant select on table public.legacy_import_batches, public.legacy_import_entries to authenticated;
revoke all on function public.start_legacy_import_batch(text,integer) from public;
revoke all on function public.import_legacy_certification_row_v3(uuid,integer,jsonb) from public;
revoke all on function public.record_legacy_import_failure(uuid,integer,jsonb,text) from public;
revoke all on function public.complete_legacy_import_batch(uuid) from public;
grant execute on function public.start_legacy_import_batch(text,integer) to authenticated;
grant execute on function public.import_legacy_certification_row_v3(uuid,integer,jsonb) to authenticated;
grant execute on function public.record_legacy_import_failure(uuid,integer,jsonb,text) to authenticated;
grant execute on function public.complete_legacy_import_batch(uuid) to authenticated;
