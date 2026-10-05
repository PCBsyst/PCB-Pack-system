-- Synthetic data only. This import stub checks 028 replacement, not the full 023 workflow.
create type public.business_area as enum ('ISO','K_BEAUTY');
create table public.jobs(business_area public.business_area not null, management_no integer not null unique);
create table public.applications(business_area public.business_area,management_no_to integer);
create table public.number_allocations(allocation_key text primary key,last_value integer);
insert into public.number_allocations values('MANAGEMENT:GLOBAL',100);
insert into public.jobs values('ISO',10),('K_BEAUTY',20);
create function public.is_active_staff() returns boolean language sql as $$select coalesce(current_setting('pcb.test_active',true),'false')='true'$$;
create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('pcb.test_owner',true),'false')='true'$$;
create function public.allocate_management_numbers(p_count integer) returns integer language sql as $$select 101$$;
create function public.import_legacy_certification_row(p_row jsonb) returns jsonb language plpgsql as $$
declare v_management_no integer;v_area public.business_area;label text;
begin
  -- Archived candidate requires explicit restoration before import
  v_area := (p_row->>'businessArea')::public.business_area;
  perform pg_advisory_xact_lock(hashtext('legacy-management-number'));
  if nullif(p_row->>'managementNo', '') is not null then
    v_management_no := (p_row->>'managementNo')::integer;
    if exists(select 1 from public.jobs where management_no = v_management_no) then raise exception 'Management number already exists: %', v_management_no; end if;
  else
    select coalesce(max(management_no), 0) + 1 into v_management_no from public.jobs;
  end if;
  label := 'LEGACY-' || lpad(v_management_no::text, 6, '0');
  insert into public.jobs values(v_area,v_management_no);
  return jsonb_build_object('label',label);
end;$$;
