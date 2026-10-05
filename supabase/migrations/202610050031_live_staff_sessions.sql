-- Requires 026. Read auth session existence; never expose tokens/session IDs or alter auth tables.
-- This is NOT a one-hour inactivity policy. Browser idle logout remains separate.
begin;
do $$ begin
 if to_regprocedure('public.get_mfa_policy()') is null
   or to_regclass('auth.sessions') is null
   or not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='not_after')
 then raise exception 'Session guard prerequisites unavailable. Verify 026 and auth schema'; end if;
end; $$;

create or replace function public.has_live_staff_session() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare session_claim text := auth.jwt()->>'session_id';
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','') not in ('aal1','aal2')
   or session_claim is null or session_claim !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then return false; end if;
 return exists(select 1 from public.profiles p where p.id=auth.uid() and p.active)
   and exists(select 1 from auth.sessions s where s.id=session_claim::uuid and s.user_id=auth.uid()
     and (s.not_after is null or s.not_after>now()));
end; $$;
revoke all on function public.has_live_staff_session() from public,anon;
grant execute on function public.has_live_staff_session() to authenticated;

-- Existing RLS and security-definer business RPCs call this helper. Keep 026 MFA semantics.
create or replace function public.has_staff_mfa_session() returns boolean
language sql stable security definer set search_path='' as $$
 select public.has_live_staff_session() and exists (
   select 1 from public.profiles p where p.id=auth.uid() and p.active
     and auth.jwt()->>'aal' in ('aal1','aal2')
     and (not coalesce((select required from public.mfa_policy where id='LOGIN'),true)
       or (auth.jwt()->>'aal'='aal2' and exists (
         select 1 from auth.mfa_factors f where f.user_id=p.id and f.status='verified'
       )))
 );
$$;
revoke all on function public.has_staff_mfa_session() from public,anon;
grant execute on function public.has_staff_mfa_session() to authenticated;
commit;
