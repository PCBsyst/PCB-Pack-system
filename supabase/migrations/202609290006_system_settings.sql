create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;
drop policy if exists system_settings_staff_select on public.system_settings;
drop policy if exists system_settings_admin_insert on public.system_settings;
drop policy if exists system_settings_admin_update on public.system_settings;
create policy system_settings_staff_select on public.system_settings for select to authenticated using (public.is_active_staff());
create policy system_settings_admin_insert on public.system_settings for insert to authenticated with check (public.is_admin());
create policy system_settings_admin_update on public.system_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.system_settings(key, value)
values ('workflow_rules', '{"decisionDays":"5","deliveryDays":"1","suspensionReasons":"자격유지 요구사항 미충족\n인증서 오용\n시정조치 미이행\n기타","withdrawalReasons":"중대한 인증서 오용\n정지 후 시정조치 미이행\n본인 요청"}'::jsonb)
on conflict (key) do nothing;
