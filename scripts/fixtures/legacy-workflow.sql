-- Minimal schema for executing the REAL 023 import function and 028 migration.
-- Authentication helpers are test doubles; production RLS is not reproduced.
create type public.business_area as enum ('ISO','K_BEAUTY');
create type public.accreditation_track as enum ('ACCREDITED','NON_ACCREDITED');
create type public.certification_state as enum ('NONE','ACTIVE','SUSPENDED','WITHDRAWN');
create type public.application_status as enum ('DOCUMENT_REVIEW','COMPLETED');
create type public.processing_status as enum ('DOCUMENT_REVIEW','COMPLETED');
create or replace function auth.uid() returns uuid language sql as $$select '11111111-1111-1111-1111-111111111111'::uuid$$;
create function public.is_active_staff() returns boolean language sql as $$select true$$;
create function public.is_admin() returns boolean language sql as $$select true$$;
create table public.candidates(id uuid primary key default gen_random_uuid(),name text,name_en text,birth_date date,nationality text,email text,phone text,archived_at timestamptz,updated_at timestamptz);
create table public.applications(id uuid primary key default gen_random_uuid(),application_no text unique,candidate_id uuid references public.candidates,business_area public.business_area,accreditation_scheme text,accreditation_track public.accreditation_track,accreditation_hidden boolean,application_type text,received_at date,partner_name_snapshot text,status public.application_status,management_no_from integer,management_no_to integer,primary_owner_id uuid,created_by uuid);
create table public.jobs(id uuid primary key default gen_random_uuid(),application_id uuid references public.applications,candidate_id uuid references public.candidates,job_no text unique,management_no integer unique,business_area public.business_area,accreditation_track public.accreditation_track,standard text,grade text,primary_owner_id uuid,certification_state public.certification_state);
create table public.processing_cycles(id uuid primary key default gen_random_uuid(),job_id uuid references public.jobs,sequence integer,application_type text,status public.processing_status,application_date date,planned_issue_date date,completed_at timestamptz);
create table public.certification_records(id uuid primary key default gen_random_uuid(),job_id uuid references public.jobs,cycle_id uuid references public.processing_cycles,certification_no text unique,revision integer,issue_date date,valid_from date,valid_until date,state public.certification_state,history_state text);
create table public.number_allocations(allocation_key text primary key,last_value integer);
create table public.audit_logs(id integer,detail text);
create table public.concurrent_allocations(area text,number integer,unique(area,number));
