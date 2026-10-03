begin;
-- Mandatory customer correction reason: direct REST updates cannot bypass the RPC.
create or replace function public.guard_candidate_correction_reason() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    if not public.is_active_staff() or nullif(trim(current_setting('app.correction_reason', true)), '') is null then
      raise exception 'Customer correction requires active staff and a reason';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists candidate_correction_reason on public.candidates;
create trigger candidate_correction_reason before update on public.candidates
for each row execute function public.guard_candidate_correction_reason();

-- Append-only evidence. Applies to service-role requests too; privileged DB maintenance remains out of scope.
create or replace function public.guard_immutable_evidence() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'Evidence cannot be updated, deleted or truncated through normal operations';
end;
$$;
do $$
declare target_table text;
begin
  foreach target_table in array array['audit_logs','privacy_access_logs','package_generation_receipts'] loop
    if to_regclass('public.' || target_table) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', target_table);
      execute format('drop trigger if exists immutable_evidence on public.%I', target_table);
      execute format('create trigger immutable_evidence before update or delete or truncate on public.%I for each statement execute function public.guard_immutable_evidence()', target_table);
    end if;
  end loop;
end;
$$;

-- Import no longer creates and deletes a temporary candidate.
-- Import one verified historical record atomically into the operational model.
create or replace function public.import_legacy_certification_row(p_row jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate_row public.candidates;
  application_row public.applications;
  job_row public.jobs;
  cycle_row public.processing_cycles;
  v_management_no integer;
  v_area public.business_area;
  v_track public.accreditation_track;
  v_received_at date;
  v_issue_date date;
  v_expiry_date date;
  v_application_type text;
  v_application_no text;
  v_state public.certification_state;
  v_birth_date date;
  v_email text;
  v_reused boolean := false;
  v_match_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator account required'; end if;
  if nullif(trim(p_row->>'candidateName'), '') is null then raise exception 'Candidate name is required'; end if;
  if nullif(trim(p_row->>'jobNo'), '') is null then raise exception 'Job number is required'; end if;
  if nullif(trim(p_row->>'standard'), '') is null or nullif(trim(p_row->>'grade'), '') is null then raise exception 'Standard and grade are required'; end if;
  if exists(select 1 from public.jobs where job_no = trim(p_row->>'jobNo')) then raise exception 'Job number already exists: %', p_row->>'jobNo'; end if;
  if nullif(trim(p_row->>'certificationNo'), '') is not null and exists(select 1 from public.certification_records where certification_no = trim(p_row->>'certificationNo')) then raise exception 'Certification number already exists: %', p_row->>'certificationNo'; end if;

  v_area := case upper(replace(coalesce(p_row->>'businessArea', 'ISO'), '-', '_')) when 'K_BEAUTY' then 'K_BEAUTY'::public.business_area when 'KBEAUTY' then 'K_BEAUTY'::public.business_area else 'ISO'::public.business_area end;
  v_track := case upper(replace(coalesce(p_row->>'accreditationTrack', 'ACCREDITED'), '-', '_')) when 'NON_ACCREDITED' then 'NON_ACCREDITED'::public.accreditation_track when '비인정' then 'NON_ACCREDITED'::public.accreditation_track else 'ACCREDITED'::public.accreditation_track end;
  v_received_at := nullif(p_row->>'receivedAt', '')::date;
  if v_received_at is null then raise exception 'Received date is required'; end if;
  v_application_type := case trim(coalesce(p_row->>'applicationType', '최초')) when '갱신' then '갱신' when '등급변경' then '등급변경' when '전환' then '전환' when '기타' then '기타' else '최초' end;

  perform pg_advisory_xact_lock(hashtext('legacy-management-number'));
  if nullif(p_row->>'managementNo', '') is not null then
    v_management_no := (p_row->>'managementNo')::integer;
    if exists(select 1 from public.jobs where management_no = v_management_no) then raise exception 'Management number already exists: %', v_management_no; end if;
  else
    select coalesce(max(management_no), 0) + 1 into v_management_no from public.jobs;
  end if;
  v_application_no := 'LEGACY-' || lpad(v_management_no::text, 6, '0');
  while exists(select 1 from public.applications where application_no = v_application_no) loop
    v_application_no := v_application_no || '-X';
  end loop;

  perform set_config('app.correction_reason', '기존 기록 이관: Job ' || trim(p_row->>'jobNo'), true);
  v_birth_date := nullif(p_row->>'candidateBirthDate', '')::date;
  v_email := lower(nullif(trim(p_row->>'candidateEmail'), ''));
  if v_email is not null then
    select count(*) into v_match_count from public.candidates where lower(email) = v_email;
    if v_match_count > 1 then raise exception 'Ambiguous candidate email. Manual verification required'; end if;
    select * into candidate_row from public.candidates where lower(email) = v_email for update;
    if candidate_row.id is not null and trim(candidate_row.name) <> trim(p_row->>'candidateName') then
      raise exception 'Email belongs to another candidate';
    end if;
    if candidate_row.id is not null and candidate_row.birth_date is not null and v_birth_date is not null and candidate_row.birth_date <> v_birth_date then
      raise exception 'Candidate birth date mismatch. Manual verification required';
    end if;
  elsif v_birth_date is not null then
    select count(*) into v_match_count from public.candidates where name = trim(p_row->>'candidateName') and birth_date = v_birth_date;
    if v_match_count > 1 then raise exception 'Ambiguous candidate identity. Manual verification required'; end if;
    select * into candidate_row from public.candidates where name = trim(p_row->>'candidateName') and birth_date = v_birth_date for update;
  end if;
  v_reused := candidate_row.id is not null;
  if v_reused then
    if candidate_row.archived_at is not null then raise exception 'Archived candidate requires explicit restoration before import'; end if;
    update public.candidates set
      name_en = coalesce(name_en, nullif(trim(p_row->>'candidateNameEn'), '')),
      birth_date = coalesce(birth_date, v_birth_date),
      nationality = coalesce(nationality, nullif(trim(p_row->>'candidateNationality'), '')),
      email = coalesce(email, nullif(trim(p_row->>'candidateEmail'), '')),
      phone = coalesce(phone, nullif(trim(p_row->>'candidatePhone'), ''))
      where id = candidate_row.id returning * into candidate_row;
  else
    insert into public.candidates(name, name_en, birth_date, nationality, email, phone)
    values (trim(p_row->>'candidateName'), nullif(trim(p_row->>'candidateNameEn'), ''), v_birth_date,
      nullif(trim(p_row->>'candidateNationality'), ''), nullif(trim(p_row->>'candidateEmail'), ''), nullif(trim(p_row->>'candidatePhone'), ''))
      returning * into candidate_row;
  end if;
  insert into public.applications(application_no, candidate_id, business_area, accreditation_scheme, accreditation_track, accreditation_hidden, application_type, received_at, partner_name_snapshot, status, management_no_from, management_no_to, primary_owner_id, created_by)
  values (v_application_no, candidate_row.id, v_area, 'IAS', v_track, false, v_application_type, v_received_at, coalesce(nullif(trim(p_row->>'partnerName'), ''), '개인'), case when nullif(p_row->>'certificationNo', '') is null then 'DOCUMENT_REVIEW' else 'COMPLETED' end, v_management_no, v_management_no, auth.uid(), auth.uid()) returning * into application_row;
  insert into public.jobs(application_id, candidate_id, job_no, management_no, business_area, accreditation_track, standard, grade, primary_owner_id, certification_state)
  values (application_row.id, candidate_row.id, trim(p_row->>'jobNo'), v_management_no, v_area, v_track, trim(p_row->>'standard'), trim(p_row->>'grade'), auth.uid(), case when nullif(p_row->>'certificationNo', '') is null then 'NONE' else 'ACTIVE' end) returning * into job_row;
  insert into public.processing_cycles(job_id, sequence, application_type, status, application_date, planned_issue_date, completed_at)
  values (job_row.id, 1, v_application_type, case when nullif(p_row->>'certificationNo', '') is null then 'DOCUMENT_REVIEW' else 'COMPLETED' end, v_received_at, nullif(p_row->>'issueDate', '')::date, case when nullif(p_row->>'certificationNo', '') is null then null else now() end) returning * into cycle_row;

  if nullif(trim(p_row->>'certificationNo'), '') is not null then
    v_issue_date := nullif(p_row->>'issueDate', '')::date;
    v_expiry_date := nullif(p_row->>'expiryDate', '')::date;
    if v_issue_date is null or v_expiry_date is null then raise exception 'Issue date and expiry date are required for a certification record'; end if;
    v_state := case trim(coalesce(p_row->>'certificationState', '')) when '인증 정지' then 'SUSPENDED' when 'SUSPENDED' then 'SUSPENDED' when '인증 철회' then 'WITHDRAWN' when 'WITHDRAWN' then 'WITHDRAWN' else 'ACTIVE' end;
    insert into public.certification_records(job_id, cycle_id, certification_no, revision, issue_date, valid_from, valid_until, state, history_state)
    values (job_row.id, cycle_row.id, trim(p_row->>'certificationNo'), 0, v_issue_date, v_issue_date, v_expiry_date, v_state, 'CURRENT');
    update public.jobs set certification_state = v_state where id = job_row.id;
  end if;

  return jsonb_build_object('candidate_id', candidate_row.id, 'application_id', application_row.id, 'job_id', job_row.id, 'application_no', v_application_no, 'management_no', v_management_no, 'candidate_reused', v_reused);
end;
$$;

revoke all on function public.import_legacy_certification_row(jsonb) from public;
grant execute on function public.import_legacy_certification_row(jsonb) to authenticated;
create or replace function public.import_legacy_certification_row_v2(p_row jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  return public.import_legacy_certification_row(p_row);
end;
$$;
revoke all on function public.import_legacy_certification_row_v2(jsonb) from public;
grant execute on function public.import_legacy_certification_row_v2(jsonb) to authenticated;
commit;

