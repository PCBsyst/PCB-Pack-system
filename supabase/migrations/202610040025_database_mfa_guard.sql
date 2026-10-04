-- Apply only after server MFA deployment and owner enrollment have been verified.
begin;
create or replace function public.has_staff_mfa_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active
      and auth.jwt()->>'aal' in ('aal1','aal2')
      and (not p.is_owner or exists (
        select 1 from auth.mfa_factors f where f.user_id=p.id and f.status='verified'
      ))
      and (auth.jwt()->>'aal'='aal2' or not exists (
        select 1 from auth.mfa_factors f where f.user_id=p.id and f.status='verified'
      ))
  );
$$;
revoke all on function public.has_staff_mfa_session() from public, anon;
grant execute on function public.has_staff_mfa_session() to authenticated;

create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_staff_mfa_session();
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_staff_mfa_session() and exists (
    select 1 from public.profiles where id=auth.uid() and active and is_owner
  );
$$;
create or replace function public.is_account_inviter() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_staff_mfa_session() and exists (
    select 1 from public.profiles where id=auth.uid() and active and role='ADMIN'
  );
$$;

-- Own identity remains readable for enrollment/approval screens, never writable.
drop policy if exists profiles_self_setup_select on public.profiles;
create policy profiles_self_setup_select on public.profiles
  for select to authenticated using (id=auth.uid());

-- Restrictive AND gate also closes self-owned lock policies that lacked a staff check.
do $$
declare target record;
begin
  for target in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
      and c.relname<>'profiles'
  loop
    execute format('drop policy if exists staff_mfa_session_guard on public.%I',target.relname);
    execute format('create policy staff_mfa_session_guard on public.%I as restrictive for all to authenticated using (public.has_staff_mfa_session()) with check (public.has_staff_mfa_session())',target.relname);
  end loop;
end $$;
commit;
