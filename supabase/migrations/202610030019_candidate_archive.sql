-- Optional until applied: UI detects column availability and disables archive actions.
alter table public.candidates add column if not exists archived_at timestamptz;
alter table public.candidates add column if not exists archived_by uuid references auth.users(id);
alter table public.candidates add column if not exists archive_reason text;

create or replace function public.guard_candidate_archive() returns trigger
language plpgsql set search_path = public as $$
begin
  if (TG_OP = 'INSERT' and (new.archived_at is not null or new.archived_by is not null or new.archive_reason is not null))
    or (TG_OP = 'UPDATE' and (new.archived_at, new.archived_by, new.archive_reason) is distinct from (old.archived_at, old.archived_by, old.archive_reason)) then
    if current_setting('app.candidate_archive', true) is distinct from 'allowed'
      or not public.is_active_staff()
      or nullif(trim(current_setting('app.correction_reason', true)), '') is null then
      raise exception 'Archive changes require the authorized archive operation and a reason';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_candidate_archive on public.candidates;
create trigger guard_candidate_archive before insert or update on public.candidates
for each row execute function public.guard_candidate_archive();

create or replace function public.set_candidate_archive_status(target_id uuid, archive boolean, reason text, expected_archived_at timestamptz)
returns public.candidates language plpgsql security invoker set search_path = public as $$
declare result public.candidates;
begin
  if not public.is_active_staff() then raise exception 'Active staff account required'; end if;
  if archive is null or nullif(trim(reason), '') is null then raise exception 'Archive state and reason are required'; end if;
  select * into result from public.candidates where id = target_id for update;
  if result.id is null then raise exception 'Candidate not found'; end if;
  if result.archived_at is distinct from expected_archived_at then raise exception 'State changed. Refresh before retrying'; end if;
  if (result.archived_at is not null) = archive then raise exception 'Candidate is already in the requested state'; end if;
  perform set_config('app.candidate_archive', 'allowed', true);
  perform set_config('app.correction_reason', trim(reason), true);
  update public.candidates set archived_at = case when archive then clock_timestamp() else null end,
    archived_by = case when archive then auth.uid() else null end,
    archive_reason = case when archive then trim(reason) else null end
    where id = target_id returning * into result;
  perform set_config('app.candidate_archive', '', true);
  return result;
end;
$$;
revoke all on function public.set_candidate_archive_status(uuid,boolean,text,timestamptz) from public;
grant execute on function public.set_candidate_archive_status(uuid,boolean,text,timestamptz) to authenticated;
