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

  insert into public.candidates(name, name_en)
  values (trim(p_row->>'candidateName'), nullif(trim(p_row->>'candidateNameEn'), '')) returning * into candidate_row;
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

  return jsonb_build_object('candidate_id', candidate_row.id, 'application_id', application_row.id, 'job_id', job_row.id, 'application_no', v_application_no, 'management_no', v_management_no);
end;
$$;

revoke all on function public.import_legacy_certification_row(jsonb) from public;
grant execute on function public.import_legacy_certification_row(jsonb) to authenticated;
