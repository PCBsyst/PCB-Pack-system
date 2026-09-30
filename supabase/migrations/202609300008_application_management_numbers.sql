-- Application and internal management number allocation.
-- Requires 202609300007_number_allocations.sql.
create or replace function public.allocate_application_number(
  p_business_area text,
  p_received_at date
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  area_code text;
  number_prefix text;
  allocation_key text;
  existing_max integer;
  allocated integer;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;
  if p_received_at is null then raise exception 'Received date is required'; end if;
  area_code := case p_business_area when 'ISO' then 'ISO' when 'K_BEAUTY' then 'KB' else null end;
  if area_code is null then raise exception 'Invalid business area'; end if;

  number_prefix := 'APP-' || area_code || '-' || to_char(p_received_at, 'YYYY') || '-';
  allocation_key := 'APPLICATION:' || number_prefix;

  select coalesce(max(case when right(application_no, 3) ~ '^[0-9]{3}$' then right(application_no, 3)::integer end), 0)
    into existing_max
    from public.applications
   where left(application_no, length(number_prefix)) = number_prefix;

  insert into public.number_allocations(allocation_key, last_value)
  values (allocation_key, existing_max + 1)
  on conflict (allocation_key) do update
    set last_value = greatest(public.number_allocations.last_value, existing_max) + 1,
        updated_at = now()
  returning last_value into allocated;

  if allocated > 999 then raise exception 'Application number sequence exhausted for %', number_prefix; end if;
  return number_prefix || lpad(allocated::text, 3, '0');
end;
$$;

create or replace function public.allocate_management_numbers(
  p_count integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_max integer;
  allocated_last integer;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'Management number count must be between 1 and 100'; end if;

  select greatest(
    coalesce((select max(management_no) from public.jobs), 0),
    coalesce((select max(management_no_to) from public.applications), 0)
  ) into existing_max;

  insert into public.number_allocations(allocation_key, last_value)
  values ('MANAGEMENT:GLOBAL', existing_max + p_count)
  on conflict (allocation_key) do update
    set last_value = greatest(public.number_allocations.last_value, existing_max) + p_count,
        updated_at = now()
  returning last_value into allocated_last;

  return allocated_last - p_count + 1;
end;
$$;

revoke all on function public.allocate_application_number(text,date) from public;
revoke all on function public.allocate_management_numbers(integer) from public;
grant execute on function public.allocate_application_number(text,date) to authenticated;
grant execute on function public.allocate_management_numbers(integer) to authenticated;
