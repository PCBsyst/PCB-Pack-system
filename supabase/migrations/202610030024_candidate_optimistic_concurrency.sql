begin;
alter table public.candidates add column if not exists row_version bigint not null default 0;
create or replace function public.set_candidate_row_version() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    new.row_version := 0;
  elsif (to_jsonb(new) - 'updated_at' - 'row_version') is distinct from (to_jsonb(old) - 'updated_at' - 'row_version') then
    new.row_version := old.row_version + 1;
  else
    new.row_version := old.row_version;
  end if;
  return new;
end;
$$;
drop trigger if exists candidates_row_version on public.candidates;
create trigger candidates_row_version before insert or update on public.candidates
for each row execute function public.set_candidate_row_version();
create or replace function public.update_candidate_with_reason_v2(
  candidate_id uuid,
  candidate_name text,
  candidate_name_en text,
  candidate_birth_date date,
  candidate_nationality text,
  candidate_email text,
  candidate_phone text,
  candidate_address text,
  correction_reason text,
  expected_version bigint
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

  select * into updated_candidate from public.candidates where id = candidate_id for update;
  if updated_candidate.id is null then raise exception 'Candidate not found'; end if;
  if expected_version is null or updated_candidate.row_version <> expected_version then
    raise exception using errcode = '40001', message = 'Candidate changed. Reload latest values before saving';
  end if;
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

revoke all on function public.update_candidate_with_reason_v2(uuid,text,text,date,text,text,text,text,text,bigint) from public;
grant execute on function public.update_candidate_with_reason_v2(uuid,text,text,date,text,text,text,text,text,bigint) to authenticated;
-- Old save RPC cannot be used to bypass version validation after this migration.
do $$
begin
  if to_regprocedure('public.update_candidate_with_reason(uuid,text,text,date,text,text,text,text,text)') is not null then
    revoke execute on function public.update_candidate_with_reason(uuid,text,text,date,text,text,text,text,text) from public, anon, authenticated;
  end if;
end;
$$;
commit;
