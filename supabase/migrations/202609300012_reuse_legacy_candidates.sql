-- Reuse an existing candidate during legacy import when reliable identity data matches.
create or replace function public.import_legacy_certification_row_v2(p_row jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_candidate public.candidates;
  created_candidate_id uuid;
  imported jsonb;
  v_birth_date date;
  v_email text;
begin
  if not public.is_admin() then raise exception 'Administrator account required'; end if;
  v_birth_date := nullif(p_row->>'candidateBirthDate', '')::date;
  v_email := lower(nullif(trim(p_row->>'candidateEmail'), ''));

  if v_email is not null then
    select * into existing_candidate
      from public.candidates
     where lower(email) = v_email
     order by created_at
     limit 1;
    if existing_candidate.id is not null and trim(existing_candidate.name) <> trim(p_row->>'candidateName') then
      raise exception 'Email belongs to another candidate: %', existing_candidate.name;
    end if;
  elsif v_birth_date is not null then
    select * into existing_candidate
      from public.candidates
     where name = trim(p_row->>'candidateName') and birth_date = v_birth_date
     order by created_at
     limit 1;
  end if;

  imported := public.import_legacy_certification_row(p_row);
  created_candidate_id := (imported->>'candidate_id')::uuid;

  if existing_candidate.id is not null then
    update public.applications set candidate_id = existing_candidate.id where id = (imported->>'application_id')::uuid;
    update public.jobs set candidate_id = existing_candidate.id where id = (imported->>'job_id')::uuid;
    delete from public.candidates where id = created_candidate_id;
    update public.candidates set
      name_en = coalesce(name_en, nullif(trim(p_row->>'candidateNameEn'), '')),
      birth_date = coalesce(birth_date, v_birth_date),
      nationality = coalesce(nationality, nullif(trim(p_row->>'candidateNationality'), '')),
      email = coalesce(email, nullif(trim(p_row->>'candidateEmail'), '')),
      phone = coalesce(phone, nullif(trim(p_row->>'candidatePhone'), ''))
    where id = existing_candidate.id;
    imported := jsonb_set(imported, '{candidate_id}', to_jsonb(existing_candidate.id));
  else
    update public.candidates set
      name_en = nullif(trim(p_row->>'candidateNameEn'), ''),
      birth_date = v_birth_date,
      nationality = nullif(trim(p_row->>'candidateNationality'), ''),
      email = nullif(trim(p_row->>'candidateEmail'), ''),
      phone = nullif(trim(p_row->>'candidatePhone'), '')
    where id = created_candidate_id;
  end if;

  return imported || jsonb_build_object('candidate_reused', existing_candidate.id is not null);
end;
$$;

revoke all on function public.import_legacy_certification_row_v2(jsonb) from public;
grant execute on function public.import_legacy_certification_row_v2(jsonb) to authenticated;
