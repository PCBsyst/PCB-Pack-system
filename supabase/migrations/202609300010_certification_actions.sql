-- Formal suspension and withdrawal records used by notices and reports.
create table if not exists public.certification_actions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  certification_record_id uuid not null references public.certification_records(id),
  action_type text not null check (action_type in ('SUSPENDED', 'WITHDRAWN')),
  standard_reason text not null,
  detail_reason text not null,
  effective_date date not null,
  recorded_by uuid references public.profiles(id),
  recorded_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists certification_actions_job_id_idx on public.certification_actions(job_id, created_at desc);
create index if not exists certification_actions_record_id_idx on public.certification_actions(certification_record_id);

alter table public.certification_actions enable row level security;
drop policy if exists certification_actions_staff_select on public.certification_actions;
drop policy if exists certification_actions_staff_insert on public.certification_actions;
drop policy if exists certification_actions_admin_delete on public.certification_actions;
create policy certification_actions_staff_select on public.certification_actions for select to authenticated using (public.is_active_staff());
create policy certification_actions_staff_insert on public.certification_actions for insert to authenticated with check (public.is_active_staff() and (recorded_by = auth.uid() or recorded_by is null));
create policy certification_actions_admin_delete on public.certification_actions for delete to authenticated using (public.is_admin());

create or replace function public.record_certification_action(
  p_job_id uuid,
  p_action_type text,
  p_standard_reason text,
  p_detail_reason text,
  p_effective_date date
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  certification_row public.certification_records;
  actor_name text;
  action_id uuid;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;
  if p_action_type not in ('SUSPENDED', 'WITHDRAWN') then raise exception 'Invalid certification action'; end if;
  if nullif(trim(p_standard_reason), '') is null or nullif(trim(p_detail_reason), '') is null then raise exception 'Reason is required'; end if;
  if p_effective_date is null then raise exception 'Effective date is required'; end if;

  select * into certification_row
    from public.certification_records
   where job_id = p_job_id and history_state = 'CURRENT'
   order by issue_date desc limit 1
   for update;
  if certification_row.id is null then raise exception 'Current certification record not found'; end if;

  select display_name into actor_name from public.profiles where id = auth.uid();
  insert into public.certification_actions(job_id, certification_record_id, action_type, standard_reason, detail_reason, effective_date, recorded_by, recorded_by_name)
  values (p_job_id, certification_row.id, p_action_type, trim(p_standard_reason), trim(p_detail_reason), p_effective_date, auth.uid(), coalesce(actor_name, '담당자'))
  returning id into action_id;

  update public.certification_records set state = p_action_type::public.certification_state, updated_at = now() where id = certification_row.id;
  update public.jobs set certification_state = p_action_type::public.certification_state, updated_at = now() where id = p_job_id;
  return action_id;
end;
$$;

revoke all on function public.record_certification_action(uuid,text,text,text,date) from public;
grant execute on function public.record_certification_action(uuid,text,text,text,date) to authenticated;
