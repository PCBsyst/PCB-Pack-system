-- Owner-only, audited MFA requirement toggle. Starts ON; applying twice preserves the setting.
begin;
create table if not exists public.mfa_policy (
  id text primary key check (id = 'LOGIN'),
  required boolean not null default true,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.mfa_policy enable row level security;
revoke all on public.mfa_policy from public, anon, authenticated;
insert into public.mfa_policy(id) values ('LOGIN') on conflict (id) do nothing;
drop trigger if exists mfa_policy_audit on public.mfa_policy;
create trigger mfa_policy_audit after update on public.mfa_policy
  for each row execute function public.write_audit_log();

-- Readable before the MFA challenge, but only after password authentication and activation.
create or replace function public.get_mfa_policy() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare setting public.mfa_policy;
begin
  if auth.jwt()->>'aal' is null or auth.jwt()->>'aal' not in ('aal1','aal2')
    or not exists (select 1 from public.profiles where id=auth.uid() and active)
  then raise exception 'Active authenticated staff required'; end if;
  select * into setting from public.mfa_policy where id='LOGIN';
  if setting.id is null then raise exception 'MFA policy unavailable'; end if;
  return jsonb_build_object('required',setting.required,'updatedAt',setting.updated_at);
end;
$$;
revoke all on function public.get_mfa_policy() from public, anon;
grant execute on function public.get_mfa_policy() to authenticated;

create or replace function public.update_mfa_policy(mfa_required boolean, reason text, expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare setting public.mfa_policy;
begin
  if auth.jwt()->>'aal' is null or auth.jwt()->>'aal' not in ('aal1','aal2')
    or not exists (select 1 from public.profiles where id=auth.uid() and active and is_owner)
  then raise exception 'Owner account required'; end if;
  -- When ON, changing a security requirement also requires the existing MFA session.
  select * into setting from public.mfa_policy where id='LOGIN' for update;
  if setting.id is null then raise exception 'MFA policy unavailable'; end if;
  if setting.required and (auth.jwt()->>'aal'<>'aal2' or not exists (
    select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'
  )) then raise exception 'Owner MFA session required'; end if;
  if mfa_required is null or nullif(trim(reason),'') is null or length(reason)>1000
    then raise exception 'MFA state and change reason required'; end if;
  if expected_updated_at is null or setting.updated_at is distinct from expected_updated_at
    then raise exception 'Setting changed. Refresh before retrying'; end if;
  if setting.required=mfa_required then raise exception 'MFA already in requested state'; end if;
  perform set_config('app.correction_reason',trim(reason),true);
  update public.mfa_policy set required=mfa_required, updated_at=clock_timestamp() where id='LOGIN'
    returning * into setting;
  return jsonb_build_object('required',setting.required,'updatedAt',setting.updated_at);
end;
$$;
revoke all on function public.update_mfa_policy(boolean,text,timestamptz) from public, anon;
grant execute on function public.update_mfa_policy(boolean,text,timestamptz) to authenticated;

-- All ordinary staff/owner authorization stays required even when MFA is OFF.
create or replace function public.has_staff_mfa_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.active
      and auth.jwt()->>'aal' in ('aal1','aal2')
      and (not coalesce((select required from public.mfa_policy where id='LOGIN'),true)
        or (auth.jwt()->>'aal'='aal2' and exists (
          select 1 from auth.mfa_factors f where f.user_id=p.id and f.status='verified'
        )))
  );
$$;
revoke all on function public.has_staff_mfa_session() from public, anon;
grant execute on function public.has_staff_mfa_session() to authenticated;
create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = '' as $$ select public.has_staff_mfa_session(); $$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_staff_mfa_session() and exists (select 1 from public.profiles where id=auth.uid() and active and is_owner);
$$;
create or replace function public.is_account_inviter() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_staff_mfa_session() and exists (select 1 from public.profiles where id=auth.uid() and active and role='ADMIN');
$$;
drop policy if exists profiles_self_setup_select on public.profiles;
create policy profiles_self_setup_select on public.profiles for select to authenticated using (id=auth.uid());
do $$
declare target record;
begin
  for target in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity and c.relname not in ('profiles','mfa_policy')
  loop
    execute format('drop policy if exists staff_mfa_session_guard on public.%I',target.relname);
    execute format('create policy staff_mfa_session_guard on public.%I as restrictive for all to authenticated using (public.has_staff_mfa_session()) with check (public.has_staff_mfa_session())',target.relname);
  end loop;
end $$;
commit;
