-- Atomic number allocation for concurrent staff registrations.
-- Allocated values are intentionally never returned or reused.
create table if not exists public.number_allocations (
  allocation_key text primary key,
  last_value integer not null check (last_value between 1 and 9999),
  updated_at timestamptz not null default now()
);

alter table public.number_allocations enable row level security;

create or replace function public.allocate_job_number(
  p_job_prefix text,
  p_received_at date
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  year_code text;
  number_prefix text;
  allocation_key text;
  existing_max integer;
  allocated integer;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;
  if p_received_at is null then raise exception 'Received date is required'; end if;
  if nullif(trim(p_job_prefix), '') is null or p_job_prefix !~ '^[A-Za-z0-9-]{1,16}$' then
    raise exception 'Invalid Job number prefix';
  end if;

  year_code := to_char(p_received_at, 'YY');
  number_prefix := upper(trim(p_job_prefix)) || year_code;
  allocation_key := 'JOB:' || number_prefix;

  select coalesce(max(case when right(job_no, 4) ~ '^[0-9]{4}$' then right(job_no, 4)::integer end), 0)
    into existing_max
    from public.jobs
   where left(job_no, length(number_prefix)) = number_prefix
     and right(job_no, 4) ~ '^[0-9]{4}$';

  insert into public.number_allocations(allocation_key, last_value)
  values (allocation_key, existing_max + 1)
  on conflict (allocation_key) do update
    set last_value = greatest(public.number_allocations.last_value, existing_max) + 1,
        updated_at = now()
  returning last_value into allocated;

  if allocated > 9999 then raise exception 'Job number sequence exhausted for %', number_prefix; end if;
  return number_prefix || lpad(allocated::text, 4, '0');
end;
$$;

create or replace function public.allocate_certification_number(
  p_number_prefix text,
  p_sequence_scope text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  allocation_key text;
  existing_max integer;
  allocated integer;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;
  if nullif(trim(p_number_prefix), '') is null or p_number_prefix !~ '^[A-Za-z0-9-]{2,24}$' then
    raise exception 'Invalid certification number prefix';
  end if;
  if nullif(trim(p_sequence_scope), '') is null then raise exception 'Certification sequence scope is required'; end if;

  allocation_key := 'CERT:' || upper(trim(p_sequence_scope));
  select coalesce(max(case when right(certification_no, 4) ~ '^[0-9]{4}$' then right(certification_no, 4)::integer end), 0)
    into existing_max
    from public.certification_records
   where left(certification_no, length(p_number_prefix)) = p_number_prefix
     and right(certification_no, 4) ~ '^[0-9]{4}$';

  insert into public.number_allocations(allocation_key, last_value)
  values (allocation_key, existing_max + 1)
  on conflict (allocation_key) do update
    set last_value = greatest(public.number_allocations.last_value, existing_max) + 1,
        updated_at = now()
  returning last_value into allocated;

  if allocated > 9999 then raise exception 'Certification number sequence exhausted for %', p_sequence_scope; end if;
  return p_number_prefix || lpad(allocated::text, 4, '0');
end;
$$;

revoke all on table public.number_allocations from anon, authenticated;
revoke all on function public.allocate_job_number(text,date) from public;
revoke all on function public.allocate_certification_number(text,text) from public;
grant execute on function public.allocate_job_number(text,date) to authenticated;
grant execute on function public.allocate_certification_number(text,text) to authenticated;
