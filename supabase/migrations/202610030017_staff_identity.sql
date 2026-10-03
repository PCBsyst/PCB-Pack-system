-- Apply once in SQL Editor. Safe to rerun. Only the server service role can call this.
begin;
create or replace function public.save_staff_identity(
  target_id uuid, actor_id uuid, staff_name text, staff_email text, reason text,
  expected_name text, expected_email text, validate_only boolean default false
) returns void language plpgsql security definer set search_path=public as $$
declare previous public.profiles; updated public.profiles;
begin
  if not exists(select 1 from public.profiles p where p.id=actor_id and p.is_owner and p.active) then
    raise exception 'Owner required';
  end if;
  if validate_only then return; end if;
  if nullif(trim(reason),'') is null then raise exception 'Reason required'; end if;
  select * into previous from public.profiles where id=target_id for update;
  if not found then raise exception 'Profile not found'; end if;
  if previous.display_name is distinct from expected_name or previous.email is distinct from expected_email then
    raise exception 'Profile changed; reload before editing';
  end if;
  if previous.is_owner and previous.email<>staff_email then raise exception 'Owner email change not allowed'; end if;
  if not exists(select 1 from auth.users where id=target_id and email=staff_email) then
    raise exception 'Auth email does not match';
  end if;
  perform set_config('app.correction_reason',trim(reason),true);
  update public.profiles set display_name=trim(staff_name),email=staff_email,updated_at=now()
    where id=target_id returning * into updated;
  insert into public.audit_logs(table_name,record_id,action,actor_id,before_data,after_data,correction_reason)
    values('staff_identity_changes',target_id,'UPDATE',actor_id,
      jsonb_build_object('display_name',previous.display_name,'email',previous.email),
      jsonb_build_object('display_name',updated.display_name,'email',updated.email),trim(reason));
end; $$;
revoke all on function public.save_staff_identity(uuid,uuid,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.save_staff_identity(uuid,uuid,text,text,text,text,text,boolean) to service_role;
commit;
