-- Apply after 031. Server time only; no background request renews activity.
begin;
do $$begin
 if to_regprocedure('public.has_live_staff_session()') is null or not exists (
   select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='created_at'
 ) then raise exception 'Verify 031 and auth.sessions.created_at before applying 032'; end if;
end;$$;
create table if not exists public.staff_session_activity (
 session_id uuid primary key,
 user_id uuid not null,
 last_activity_at timestamptz not null
);
alter table public.staff_session_activity enable row level security;
revoke all on public.staff_session_activity from public,anon,authenticated;

create or replace function public.has_staff_idle_session() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare sid text:=auth.jwt()->>'session_id'; last_seen timestamptz;
begin
 if auth.uid() is null or sid is null or sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
 select coalesce(a.last_activity_at,s.created_at) into last_seen from auth.sessions s
 left join public.staff_session_activity a on a.session_id=s.id and a.user_id=s.user_id
 where s.id=sid::uuid and s.user_id=auth.uid();
 return coalesce(last_seen<=statement_timestamp() and last_seen>statement_timestamp()-interval '1 hour',false);
end;$$;
revoke all on function public.has_staff_idle_session() from public,anon;
grant execute on function public.has_staff_idle_session() to authenticated;

create or replace function public.has_live_staff_session() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare sid text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','') not in ('aal1','aal2') or sid is null
   or sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
 return exists(select 1 from public.profiles p where p.id=auth.uid() and p.active)
   and exists(select 1 from auth.sessions s where s.id=sid::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>statement_timestamp()))
   and public.has_staff_idle_session();
end;$$;
revoke all on function public.has_live_staff_session() from public,anon;
grant execute on function public.has_live_staff_session() to authenticated;

create or replace function public.get_staff_idle_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare last_seen timestamptz;
begin
 if not public.has_staff_mfa_session() then return jsonb_build_object('valid',false);end if;
 select coalesce(a.last_activity_at,s.created_at) into last_seen from auth.sessions s
 left join public.staff_session_activity a on a.session_id=s.id and a.user_id=s.user_id
 where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid();
 return jsonb_build_object('valid',true,'serverNow',statement_timestamp(),'expiresAt',last_seen+interval '1 hour');
end;$$;
revoke all on function public.get_staff_idle_status() from public,anon;
grant execute on function public.get_staff_idle_status() to authenticated;

create or replace function public.touch_staff_session_activity() returns jsonb
language plpgsql security definer set search_path='' as $$
declare server_time timestamptz:=clock_timestamp(); touched timestamptz;
begin
 if not public.has_staff_mfa_session() then return jsonb_build_object('valid',false);end if;
 insert into public.staff_session_activity(session_id,user_id,last_activity_at)
 values((auth.jwt()->>'session_id')::uuid,auth.uid(),server_time)
 on conflict(session_id) do update set last_activity_at=excluded.last_activity_at
 where staff_session_activity.user_id=auth.uid()
   and staff_session_activity.last_activity_at>server_time-interval '1 hour'
   and staff_session_activity.last_activity_at<=server_time
 returning last_activity_at into touched;
 if touched is null then return jsonb_build_object('valid',false);end if;
 return jsonb_build_object('valid',true,'serverNow',server_time,'expiresAt',touched+interval '1 hour');
end;$$;
revoke all on function public.touch_staff_session_activity() from public,anon;
grant execute on function public.touch_staff_session_activity() to authenticated;

-- 026's MFA mutation has an explicit owner check rather than the shared staff helper.
-- Add live/idle enforcement here too; keep its MFA challenge, reason and version rules.
create or replace function public.update_mfa_policy(mfa_required boolean, reason text, expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare setting public.mfa_policy;
begin
 if not public.has_live_staff_session() then raise exception 'Active live staff session required';end if;
 if coalesce(auth.jwt()->>'aal','') not in ('aal1','aal2')
   or not exists(select 1 from public.profiles where id=auth.uid() and active and is_owner)
 then raise exception 'Owner account required';end if;
 select * into setting from public.mfa_policy where id='LOGIN' for update;
 if setting.id is null then raise exception 'MFA policy unavailable';end if;
 if setting.required and (auth.jwt()->>'aal'<>'aal2' or not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))
 then raise exception 'Owner MFA session required';end if;
 if mfa_required is null or nullif(trim(reason),'') is null or length(reason)>1000 then raise exception 'MFA state and change reason required';end if;
 if expected_updated_at is null or setting.updated_at is distinct from expected_updated_at then raise exception 'Setting changed. Refresh before retrying';end if;
 if setting.required=mfa_required then raise exception 'MFA already in requested state';end if;
 perform set_config('app.correction_reason',trim(reason),true);
 update public.mfa_policy set required=mfa_required,updated_at=clock_timestamp() where id='LOGIN' returning * into setting;
 return jsonb_build_object('required',setting.required,'updatedAt',setting.updated_at);
end;$$;
revoke all on function public.update_mfa_policy(boolean,text,timestamptz) from public,anon;
grant execute on function public.update_mfa_policy(boolean,text,timestamptz) to authenticated;
commit;
