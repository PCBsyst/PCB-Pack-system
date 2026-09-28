-- Shared draft state for the operational application workspace.
create table public.application_workspaces (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger application_workspaces_set_updated_at
before update on public.application_workspaces
for each row execute function public.set_updated_at();

create trigger application_workspaces_audit
after insert or update or delete on public.application_workspaces
for each row execute function public.write_audit_log();

alter table public.application_workspaces enable row level security;
create policy application_workspaces_staff_select on public.application_workspaces for select to authenticated using (public.is_active_staff());
create policy application_workspaces_staff_insert on public.application_workspaces for insert to authenticated with check (public.is_active_staff() and (updated_by is null or updated_by = auth.uid()));
create policy application_workspaces_staff_update on public.application_workspaces for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff() and (updated_by is null or updated_by = auth.uid()));
create policy application_workspaces_admin_delete on public.application_workspaces for delete to authenticated using (public.is_admin());
