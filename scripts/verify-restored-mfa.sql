-- Disposable restore database only; no production changes or real MFA secrets.
begin;
do $$
declare owner_id uuid;
begin
  select id into owner_id from public.profiles where active and is_owner;
  if owner_id is null then raise exception 'MFA_TEST_OWNER_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated','aal','aal1')::text,true);
end $$;
set local role authenticated;
do $$
declare rejected boolean := false;
begin
  if public.is_active_staff() or public.is_admin() or public.is_account_inviter() then
    raise exception 'MFA_LOW_ASSURANCE_HELPER_BYPASS';
  end if;
  if exists(select 1 from public.candidates) or exists(select 1 from public.applications)
     or exists(select 1 from public.jobs) then raise exception 'MFA_DIRECT_READ_BYPASS'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then
    raise exception 'MFA_SETUP_PROFILE_UNAVAILABLE';
  end if;
  if exists(select 1 from public.profiles where id<>auth.uid()) then
    raise exception 'MFA_OTHER_PROFILE_LEAK';
  end if;
  begin
    perform public.read_candidate_with_access_log(gen_random_uuid());
  exception when others then
    if sqlerrm not like '%Active staff required%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'MFA_RPC_BYPASS'; end if;
end $$;
reset role;
-- Verified factor presence is checked from Auth, not caller-supplied metadata.
do $$
declare owner_id uuid; expected boolean;
begin
  select id into owner_id from public.profiles where active and is_owner;
  select exists(select 1 from auth.mfa_factors where user_id=owner_id and status='verified') into expected;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated','aal','aal2')::text,true);
  if public.is_admin() is distinct from expected then raise exception 'MFA_FACTOR_CHECK_FAILED'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,true);
  if public.is_active_staff() then raise exception 'MFA_MISSING_ASSURANCE_BYPASS'; end if;
end $$;
rollback;
