-- Requires 023. No existing business rows or numbers are changed.
begin;
alter table public.jobs drop constraint if exists jobs_management_no_key;
do $$ begin
 if exists(select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attname='management_no'
  where i.indrelid='public.jobs'::regclass and i.indisunique and i.indnkeyatts=1 and i.indkey[0]=a.attnum) then
  raise exception 'Unexpected global management number index. Review before applying 028';
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.jobs'::regclass and conname='jobs_business_area_management_no_key') then
  alter table public.jobs add constraint jobs_business_area_management_no_key unique(business_area,management_no);
 end if;
end;$$;
create table if not exists public.management_number_allocations (
 business_area public.business_area primary key,
 last_value integer not null check(last_value>=0), updated_at timestamptz not null default clock_timestamp()
);
alter table public.management_number_allocations enable row level security;
revoke all on public.management_number_allocations from public,anon,authenticated;
-- Preserve the old shared reservation high-water mark conservatively for BOTH areas.
insert into public.management_number_allocations(business_area,last_value)
select area,greatest(coalesce((select max(management_no) from public.jobs where business_area=area),0),
 coalesce((select max(management_no_to) from public.applications where business_area=area),0),
 coalesce((select last_value from public.number_allocations where allocation_key='MANAGEMENT:GLOBAL'),0))
from unnest(array['ISO'::public.business_area,'K_BEAUTY'::public.business_area]) area
on conflict(business_area) do nothing;

create or replace function public.allocate_management_numbers_for_area(p_business_area text,p_count integer,p_requested_start integer default null) returns integer
language plpgsql security definer set search_path='' as $$
declare area public.business_area;existing_max bigint;allocated_last bigint;reserved public.management_number_allocations;
begin
 if not public.is_active_staff() then raise exception 'Active staff required'; end if;
 if p_business_area not in ('ISO','K_BEAUTY') or p_business_area is null then raise exception 'Explicit business area required'; end if;
 if p_count is null or p_count<1 or p_count>100 then raise exception 'Count must be between 1 and 100'; end if;
 if p_requested_start is not null and not public.is_admin() then raise exception 'Only owner can reserve historical numbers'; end if;
 area:=p_business_area::public.business_area;
 select * into reserved from public.management_number_allocations where business_area=area for update;
 if reserved.business_area is null then raise exception 'Allocation policy unavailable'; end if;
 select greatest(reserved.last_value,coalesce((select max(management_no) from public.jobs where business_area=area),0),
  coalesce((select max(management_no_to) from public.applications where business_area=area),0)) into existing_max;
 if p_requested_start is not null then
  if p_requested_start<0 then raise exception 'Invalid management number'; end if;
  allocated_last:=p_requested_start::bigint+p_count-1;
  if exists(select 1 from public.jobs where business_area=area and management_no between p_requested_start and allocated_last) then raise exception 'Management number already exists within area'; end if;
 else allocated_last:=existing_max+p_count; end if;
 if allocated_last>2147483647 then raise exception 'Management number range exhausted'; end if;
 update public.management_number_allocations set last_value=greatest(existing_max,allocated_last),updated_at=clock_timestamp() where business_area=area;
 return case when p_requested_start is not null then p_requested_start else (allocated_last-p_count+1)::integer end;
end;$$;
revoke all on function public.allocate_management_numbers_for_area(text,integer,integer) from public,anon;
grant execute on function public.allocate_management_numbers_for_area(text,integer,integer) to authenticated;

-- Patch only the known 023 numbering block; retain candidate reuse, mandatory reasons and evidence guards.
do $migration$
declare source text;old_block text;new_block text;
begin
 source:=pg_get_functiondef('public.import_legacy_certification_row(jsonb)'::regprocedure);
 source:=replace(source,E'\r\n',E'\n');
 if strpos(source,'allocate_management_numbers_for_area')>0 then return; end if;
 if strpos(source,'Archived candidate requires explicit restoration before import')=0 then raise exception 'Apply migration 023 before 028'; end if;
 old_block:=$old$  perform pg_advisory_xact_lock(hashtext('legacy-management-number'));
  if nullif(p_row->>'managementNo', '') is not null then
    v_management_no := (p_row->>'managementNo')::integer;
    if exists(select 1 from public.jobs where management_no = v_management_no) then raise exception 'Management number already exists: %', v_management_no; end if;
  else
    select coalesce(max(management_no), 0) + 1 into v_management_no from public.jobs;
  end if;$old$;
 new_block:=$new$  if coalesce(p_row->>'businessArea','') not in ('ISO','K_BEAUTY') then raise exception 'Explicit business area required'; end if;
  v_management_no := public.allocate_management_numbers_for_area(v_area::text,1,nullif(p_row->>'managementNo','')::integer);$new$;
 old_block:=replace(old_block,E'\r\n',E'\n');
 if strpos(source,old_block)=0 or strpos(source,'''LEGACY-'' || lpad(v_management_no::text, 6, ''0'')')=0 then raise exception 'Unexpected import function. No changes applied'; end if;
 source:=replace(source,old_block,new_block);
 source:=replace(source,'''LEGACY-'' || lpad(v_management_no::text, 6, ''0'')','''LEGACY-'' || v_area::text || ''-'' || lpad(v_management_no::text, 6, ''0'')');
 execute source;
end;$migration$;
-- Old clients must refresh instead of allocating against the obsolete global counter.
create or replace function public.allocate_management_numbers(p_count integer) returns integer
language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Business area required. Refresh the application before registering';
end;$$;
create or replace function public.get_management_number_policy() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_active_staff() then raise exception 'Active staff required'; end if;
 return jsonb_build_object('areasSeparated',true);
end;$$;
revoke all on function public.get_management_number_policy() from public,anon;
grant execute on function public.get_management_number_policy() to authenticated;
commit;
