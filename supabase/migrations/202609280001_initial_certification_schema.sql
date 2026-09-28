-- Certification Record Management System
-- Initial operational schema for Supabase PostgreSQL

create extension if not exists pgcrypto;

create type public.staff_role as enum ('STAFF', 'ADMIN');
create type public.business_area as enum ('ISO', 'K_BEAUTY');
create type public.accreditation_track as enum ('ACCREDITED', 'NON_ACCREDITED');
create type public.application_status as enum ('INTAKE_REVIEW', 'DOCUMENT_REVIEW', 'SUPPLEMENT_PENDING', 'INVOICE_PENDING', 'PAYMENT_PENDING', 'DECISION_PENDING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED');
create type public.processing_status as enum ('DOCUMENT_REVIEW', 'INVOICE_PENDING', 'PAYMENT_PENDING', 'DECISION_PENDING', 'SUPPLEMENT_PENDING', 'CERTIFICATE_DRAFT_PENDING', 'CERTIFICATION_INFO_PENDING', 'DELIVERY_PENDING', 'COMPLETED', 'APPLICATION_CANCELLED');
create type public.certification_state as enum ('ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'NONE');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.staff_role not null default 'STAFF',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.panel_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation_no text not null unique,
  valid_from date not null,
  valid_until date not null,
  standards text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until >= valid_from)
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_en text,
  birth_date date,
  nationality text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_no text not null unique,
  candidate_id uuid not null references public.candidates(id),
  business_area public.business_area not null,
  accreditation_scheme text not null,
  accreditation_track public.accreditation_track not null,
  accreditation_hidden boolean not null default false,
  application_type text not null check (application_type in ('최초', '갱신', '등급변경', '전환', '기타')),
  received_at date not null,
  partner_id uuid references public.partners(id),
  partner_name_snapshot text not null,
  status public.application_status not null default 'INTAKE_REVIEW',
  management_no_from integer not null,
  management_no_to integer not null,
  primary_owner_id uuid references public.profiles(id),
  dropbox_folder_name text,
  dropbox_path text,
  documents_stored boolean not null default false,
  package_status text not null default 'NOT_READY' check (package_status in ('NOT_READY', 'READY', 'GENERATED')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (management_no_to >= management_no_from),
  check (not accreditation_hidden or accreditation_track = 'ACCREDITED')
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id),
  candidate_id uuid not null references public.candidates(id),
  job_no text not null unique,
  management_no integer not null unique,
  business_area public.business_area not null,
  accreditation_track public.accreditation_track not null,
  standard text not null,
  grade text not null,
  primary_owner_id uuid references public.profiles(id),
  certification_state public.certification_state not null default 'NONE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.processing_cycles (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  sequence integer not null,
  application_type text not null,
  status public.processing_status not null default 'DOCUMENT_REVIEW',
  application_date date not null,
  planned_issue_date date,
  document_review_date date,
  decision_date date,
  delivery_date date,
  completed_at timestamptz,
  applied_date_rule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, sequence)
);

create table public.document_reviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.processing_cycles(id),
  round integer not null default 1,
  stored_documents jsonb not null default '{}'::jsonb,
  requirements jsonb not null default '{}'::jsonb,
  overall_result text not null check (overall_result in ('적합', '보완필요', '부적합')),
  comment text,
  reviewer_id uuid references public.profiles(id),
  reviewer_name_snapshot text not null,
  reviewed_at date not null,
  verification_result text check (verification_result in ('확인', '재검토요청')),
  verification_comment text,
  verifier_id uuid references public.profiles(id),
  verifier_name_snapshot text,
  verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, round)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  recipient_type text not null check (recipient_type in ('INDIVIDUAL', 'PARTNER')),
  recipient_name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  issued_at date not null,
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PAID', 'CHECK_REQUIRED')),
  paid_amount numeric(14,2),
  paid_at date,
  payer_name text,
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_jobs (
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  job_id uuid not null references public.jobs(id),
  primary key (invoice_id, job_id)
);

create table public.certification_decisions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null unique references public.processing_cycles(id),
  result text not null check (result in ('승인', '보완', '불승인', '재승인')),
  comment text,
  decision_date date not null,
  final_approver text not null,
  final_approval_date date not null,
  entered_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decision_panel_entries (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.certification_decisions(id) on delete cascade,
  panel_member_id uuid not null references public.panel_members(id),
  result text not null check (result in ('승인', '불승인', '재승인')),
  comment text,
  unique (decision_id, panel_member_id)
);

create table public.certification_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  cycle_id uuid not null references public.processing_cycles(id),
  certification_no text not null unique,
  revision integer not null default 0 check (revision >= 0),
  draft_issued_at date,
  issue_date date not null,
  valid_from date not null,
  valid_until date not null,
  state public.certification_state not null default 'ACTIVE',
  history_state text not null default 'CURRENT',
  replaced_record_id uuid references public.certification_records(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until >= valid_from),
  unique (job_id, cycle_id)
);

create table public.document_deliveries (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null unique references public.processing_cycles(id),
  document_checklist jsonb not null default '{}'::jsonb,
  delivery_method text,
  electronic_issued_at date,
  original_sent_at date,
  tracking_number text,
  delivered_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.package_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  cycle_id uuid not null references public.processing_cycles(id),
  document_type text not null,
  language text not null check (language in ('KR', 'EN')),
  format text not null check (format in ('WORD', 'PDF', 'ZIP')),
  template_version text not null,
  storage_path text,
  generated_at timestamptz,
  generated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (cycle_id, document_type, language, format)
);

create table public.record_locks (
  resource_type text not null,
  resource_id uuid not null,
  locked_by uuid not null references public.profiles(id),
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (resource_type, resource_id),
  check (expires_at > locked_at)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb,
  correction_reason text
);

create index applications_candidate_idx on public.applications(candidate_id);
create index applications_status_idx on public.applications(status);
create index jobs_candidate_idx on public.jobs(candidate_id);
create index jobs_application_idx on public.jobs(application_id);
create index cycles_job_idx on public.processing_cycles(job_id, sequence desc);
create index certification_records_job_idx on public.certification_records(job_id, issue_date desc);
create index audit_logs_record_idx on public.audit_logs(table_name, record_id, occurred_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.write_audit_log() returns trigger language plpgsql security definer set search_path = public as $$
declare target_id text;
begin
  target_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  insert into public.audit_logs(table_name, record_id, action, actor_id, before_data, after_data, correction_reason)
  values (tg_table_name, target_id, tg_op, auth.uid(), case when tg_op = 'INSERT' then null else to_jsonb(old) end, case when tg_op = 'DELETE' then null else to_jsonb(new) end, nullif(current_setting('app.correction_reason', true), ''));
  return coalesce(new, old);
end;
$$;

create or replace function public.is_active_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active and role = 'ADMIN');
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','partners','panel_members','training_institutions','candidates','applications','jobs','processing_cycles','document_reviews','invoices','certification_decisions','certification_records','document_deliveries'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['candidates','applications','jobs','processing_cycles','document_reviews','invoices','certification_decisions','decision_panel_entries','certification_records','document_deliveries','package_documents'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.write_audit_log()', table_name, table_name);
  end loop;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['candidates','applications','jobs','processing_cycles','document_reviews','invoices','invoice_jobs','certification_decisions','decision_panel_entries','certification_records','document_deliveries','package_documents'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I_staff_select on public.%I for select to authenticated using (public.is_active_staff())', table_name, table_name);
    execute format('create policy %I_staff_insert on public.%I for insert to authenticated with check (public.is_active_staff())', table_name, table_name);
    execute format('create policy %I_staff_update on public.%I for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff())', table_name, table_name);
    execute format('create policy %I_admin_delete on public.%I for delete to authenticated using (public.is_admin())', table_name, table_name);
  end loop;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['partners','panel_members','training_institutions'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I_staff_select on public.%I for select to authenticated using (public.is_active_staff())', table_name, table_name);
    execute format('create policy %I_admin_insert on public.%I for insert to authenticated with check (public.is_admin())', table_name, table_name);
    execute format('create policy %I_admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
    execute format('create policy %I_admin_delete on public.%I for delete to authenticated using (public.is_admin())', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy profiles_staff_select on public.profiles for select to authenticated using (public.is_active_staff());
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin());

alter table public.record_locks enable row level security;
create policy record_locks_staff_select on public.record_locks for select to authenticated using (public.is_active_staff());
create policy record_locks_owner_insert on public.record_locks for insert to authenticated with check (public.is_active_staff() and locked_by = auth.uid());
create policy record_locks_owner_update on public.record_locks for update to authenticated using (locked_by = auth.uid()) with check (locked_by = auth.uid());
create policy record_locks_owner_delete on public.record_locks for delete to authenticated using (locked_by = auth.uid() or public.is_admin());

alter table public.audit_logs enable row level security;
create policy audit_logs_staff_select on public.audit_logs for select to authenticated using (public.is_active_staff());

create or replace function public.acquire_record_lock(target_type text, target_id uuid, lock_minutes integer default 15)
returns public.record_locks language plpgsql security definer set search_path = public as $$
declare acquired public.record_locks;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;
  insert into public.record_locks(resource_type, resource_id, locked_by, expires_at)
  values (target_type, target_id, auth.uid(), now() + make_interval(mins => greatest(lock_minutes, 1)))
  on conflict (resource_type, resource_id) do update
    set locked_by = excluded.locked_by, locked_at = now(), expires_at = excluded.expires_at
    where public.record_locks.locked_by = auth.uid() or public.record_locks.expires_at <= now()
  returning * into acquired;
  return acquired;
end;
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
