-- Apply after 026. No security, feature-control, notification or business records are deleted.
begin;
create table if not exists public.operation_mode (
 id text primary key check(id='OPERATIONS'), active boolean not null default false,
 paused text[] not null default '{}', ends_on date, updated_at timestamptz not null default clock_timestamp(),
 check(paused <@ array['NOTIFICATIONS','AUTOMATIC_DATES','DOCUMENT_GENERATION','PACKAGE_DOWNLOAD','INVITATION_EMAIL']::text[]),
 check(not active or ends_on is not null)
);
alter table public.operation_mode enable row level security;
revoke all on public.operation_mode from public,anon,authenticated;
insert into public.operation_mode(id) values('OPERATIONS') on conflict(id) do nothing;
drop trigger if exists operation_mode_audit on public.operation_mode;
create trigger operation_mode_audit after update on public.operation_mode for each row execute function public.write_audit_log();
create or replace function public.get_operation_mode() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare setting public.operation_mode;
begin
 if not public.is_active_staff() then raise exception 'Active staff required'; end if;
 select * into setting from public.operation_mode where id='OPERATIONS';
 if setting.id is null then raise exception 'Operation mode unavailable'; end if;
 return jsonb_build_object('active',setting.active,'paused',setting.paused,'endsOn',setting.ends_on,'updatedAt',setting.updated_at);
end;$$;
revoke all on function public.get_operation_mode() from public,anon;
grant execute on function public.get_operation_mode() to authenticated;
create or replace function public.update_operation_mode(mode_active boolean,paused_features text[],ends_on date,reason text,expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare setting public.operation_mode;
begin
 if not public.is_admin() then raise exception 'Owner account required'; end if;
 if mode_active is null or nullif(trim(reason),'') is null or length(reason)>1000 then raise exception 'State and reason required'; end if;
 if paused_features is null or not(paused_features <@ array['NOTIFICATIONS','AUTOMATIC_DATES','DOCUMENT_GENERATION','PACKAGE_DOWNLOAD','INVITATION_EMAIL']::text[]) or array_position(paused_features,null) is not null
 then raise exception 'Unknown configurable feature'; end if;
 if mode_active and (ends_on is null or ends_on < (clock_timestamp() at time zone 'Asia/Seoul')::date) then raise exception 'Future end date required'; end if;
 select * into setting from public.operation_mode where id='OPERATIONS' for update;
 if setting.id is null then raise exception 'Operation mode unavailable'; end if;
 if expected_updated_at is null or setting.updated_at is distinct from expected_updated_at then raise exception 'Setting changed. Refresh before retrying'; end if;
 perform set_config('app.correction_reason',trim(reason),true);
 update public.operation_mode set active=mode_active,
 paused=case when mode_active then array(select distinct unnest(paused_features)) else '{}'::text[] end,
 ends_on=case when mode_active then update_operation_mode.ends_on else null end,
 updated_at=clock_timestamp() where id='OPERATIONS' returning * into setting;
 return jsonb_build_object('active',setting.active,'paused',setting.paused,'endsOn',setting.ends_on,'updatedAt',setting.updated_at);
end;$$;
revoke all on function public.update_operation_mode(boolean,text[],date,text,timestamptz) from public,anon;
grant execute on function public.update_operation_mode(boolean,text[],date,text,timestamptz) to authenticated;
commit;
