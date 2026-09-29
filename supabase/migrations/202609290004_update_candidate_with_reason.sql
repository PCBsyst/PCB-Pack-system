create or replace function public.update_candidate_with_reason(
  candidate_id uuid,
  candidate_name text,
  candidate_name_en text,
  candidate_birth_date date,
  candidate_nationality text,
  candidate_email text,
  candidate_phone text,
  candidate_address text,
  correction_reason text
) returns public.candidates
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_candidate public.candidates;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;
  if nullif(trim(candidate_name), '') is null then raise exception 'Candidate name is required'; end if;
  if nullif(trim(correction_reason), '') is null then raise exception 'Correction reason is required'; end if;

  perform set_config('app.correction_reason', trim(correction_reason), true);
  update public.candidates
  set name = trim(candidate_name),
      name_en = nullif(trim(candidate_name_en), ''),
      birth_date = candidate_birth_date,
      nationality = nullif(trim(candidate_nationality), ''),
      email = nullif(trim(candidate_email), ''),
      phone = nullif(trim(candidate_phone), ''),
      address = nullif(trim(candidate_address), '')
  where id = candidate_id
  returning * into updated_candidate;

  if updated_candidate.id is null then raise exception 'Candidate not found'; end if;
  return updated_candidate;
end;
$$;

revoke all on function public.update_candidate_with_reason(uuid,text,text,date,text,text,text,text,text) from public;
grant execute on function public.update_candidate_with_reason(uuid,text,text,date,text,text,text,text,text) to authenticated;
