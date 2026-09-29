create or replace function public.create_application_bundle_v2(
  existing_candidate_id uuid,
  candidate_name text,
  candidate_name_en text,
  candidate_birth_date date,
  candidate_nationality text,
  candidate_email text,
  candidate_phone text,
  application_no text,
  received_at date,
  business_area public.business_area,
  accreditation_scheme text,
  accreditation_track public.accreditation_track,
  accreditation_hidden boolean,
  application_type text,
  partner_name text,
  management_no integer,
  job_no text,
  standard text,
  grade text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate_row public.candidates;
  application_row public.applications;
  job_row public.jobs;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;

  if existing_candidate_id is null then
    if nullif(trim(candidate_name), '') is null then raise exception 'Candidate name is required'; end if;
    insert into public.candidates(name, name_en, birth_date, nationality, email, phone)
    values (trim(candidate_name), nullif(trim(candidate_name_en), ''), candidate_birth_date, nullif(trim(candidate_nationality), ''), nullif(trim(candidate_email), ''), nullif(trim(candidate_phone), ''))
    returning * into candidate_row;
  else
    select * into candidate_row from public.candidates where id = existing_candidate_id;
    if candidate_row.id is null then raise exception 'Existing candidate not found'; end if;
  end if;

  insert into public.applications(
    application_no, candidate_id, business_area, accreditation_scheme, accreditation_track,
    accreditation_hidden, application_type, received_at, partner_name_snapshot, status,
    management_no_from, management_no_to, primary_owner_id, created_by
  ) values (
    application_no, candidate_row.id, business_area, accreditation_scheme, accreditation_track,
    accreditation_hidden, application_type, received_at, partner_name, 'INTAKE_REVIEW',
    management_no, management_no, auth.uid(), auth.uid()
  ) returning * into application_row;

  insert into public.jobs(
    application_id, candidate_id, job_no, management_no, business_area,
    accreditation_track, standard, grade, primary_owner_id
  ) values (
    application_row.id, candidate_row.id, job_no, management_no, business_area,
    accreditation_track, standard, grade, auth.uid()
  ) returning * into job_row;

  insert into public.processing_cycles(job_id, sequence, application_type, status, application_date)
  values (job_row.id, 1, application_type, 'DOCUMENT_REVIEW', received_at);

  return jsonb_build_object('application_id', application_row.id, 'candidate_id', candidate_row.id, 'job_id', job_row.id);
end;
$$;

revoke all on function public.create_application_bundle_v2(uuid,text,text,date,text,text,text,text,date,public.business_area,text,public.accreditation_track,boolean,text,text,integer,text,text,text) from public;
grant execute on function public.create_application_bundle_v2(uuid,text,text,date,text,text,text,text,date,public.business_area,text,public.accreditation_track,boolean,text,text,integer,text,text,text) to authenticated;
