create table if not exists public.feature_controls (
  id text primary key check (id in ('DOCUMENT_GENERATION', 'PACKAGE_DOWNLOAD')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.feature_controls enable row level security;
revoke all on public.feature_controls from anon, authenticated;
grant select on public.feature_controls to authenticated;
drop policy if exists feature_controls_staff_select on public.feature_controls;
create policy feature_controls_staff_select on public.feature_controls for select to authenticated using (public.is_active_staff());
insert into public.feature_controls(id) values ('DOCUMENT_GENERATION'), ('PACKAGE_DOWNLOAD') on conflict (id) do nothing;

drop trigger if exists feature_controls_audit on public.feature_controls;
create trigger feature_controls_audit after update on public.feature_controls
for each row execute function public.write_audit_log();

create or replace function public.update_feature_control(feature_id text, feature_enabled boolean, reason text, expected_updated_at timestamptz)
returns public.feature_controls language plpgsql security definer set search_path = public as $$
declare target public.feature_controls;
begin
  if not public.is_admin() then raise exception 'Owner account required'; end if;
  if feature_enabled is null or nullif(trim(reason), '') is null then raise exception 'Feature state and change reason required'; end if;
  select * into target from public.feature_controls where id = feature_id for update;
  if target.id is null then raise exception 'Unknown or non-configurable feature'; end if;
  if expected_updated_at is null or target.updated_at is distinct from expected_updated_at then raise exception 'Setting changed. Refresh before retrying'; end if;
  if target.enabled = feature_enabled then raise exception 'Feature already in requested state'; end if;
  perform set_config('app.correction_reason', trim(reason), true);
  update public.feature_controls set enabled = feature_enabled, updated_at = clock_timestamp()
    where id = feature_id returning * into target;
  return target;
end;
$$;
revoke all on function public.update_feature_control(text,boolean,text,timestamptz) from public;
grant execute on function public.update_feature_control(text,boolean,text,timestamptz) to authenticated;
