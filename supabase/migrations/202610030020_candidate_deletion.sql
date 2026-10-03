-- Apply after account approval (016). No cascade or automatic retention deletion.
create or replace function public.candidate_has_business_history(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.applications where candidate_id = target_id)
    or exists(select 1 from public.jobs where candidate_id = target_id)
    or exists(select 1 from public.audit_logs where table_name in ('applications', 'jobs')
      and (before_data->>'candidate_id' = target_id::text or after_data->>'candidate_id' = target_id::text));
$$;
revoke all on function public.candidate_has_business_history(uuid) from public, authenticated;

create or replace function public.candidate_deletion_eligibility(target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target public.candidates;
begin
  if not public.is_admin() then raise exception 'Owner account required'; end if;
  select * into target from public.candidates where id = target_id;
  if target.id is null then raise exception 'Candidate not found'; end if;
  return jsonb_build_object('allowed', not public.candidate_has_business_history(target_id),
    'name', target.name, 'updated_at', target.updated_at);
end;
$$;
revoke all on function public.candidate_deletion_eligibility(uuid) from public;
grant execute on function public.candidate_deletion_eligibility(uuid) to authenticated;

create or replace function public.guard_candidate_deletion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() or current_setting('app.candidate_delete', true) is distinct from 'allowed'
    or nullif(trim(current_setting('app.correction_reason', true)), '') is null then
    raise exception 'Owner deletion operation and reason required';
  end if;
  if public.candidate_has_business_history(old.id) then
    raise exception 'Business history exists. Archive instead of deleting';
  end if;
  return old;
end;
$$;
drop trigger if exists guard_candidate_deletion on public.candidates;
create trigger guard_candidate_deletion before delete on public.candidates
for each row execute function public.guard_candidate_deletion();

create or replace function public.delete_mistaken_candidate(target_id uuid, confirmation_name text, reason text, expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare target public.candidates;
begin
  if not public.is_admin() then raise exception 'Owner account required'; end if;
  if nullif(trim(reason), '') is null then raise exception 'Deletion reason required'; end if;
  select * into target from public.candidates where id = target_id for update;
  if target.id is null then raise exception 'Candidate not found'; end if;
  if confirmation_name is distinct from target.name then raise exception 'Candidate name confirmation mismatch'; end if;
  if expected_updated_at is null or target.updated_at is distinct from expected_updated_at then
    raise exception 'Candidate changed. Refresh before retrying';
  end if;
  perform set_config('app.correction_reason', trim(reason), true);
  perform set_config('app.candidate_delete', 'allowed', true);
  -- BEFORE trigger rechecks business history; existing AFTER audit trigger preserves actor/reason/before values.
  -- Foreign keys remain in place and prohibit deletion if new related rows were created concurrently.
  delete from public.candidates where id = target_id;
  perform set_config('app.candidate_delete', '', true);
  return target_id;
end;
$$;
revoke all on function public.delete_mistaken_candidate(uuid,text,text,timestamptz) from public;
grant execute on function public.delete_mistaken_candidate(uuid,text,text,timestamptz) to authenticated;
