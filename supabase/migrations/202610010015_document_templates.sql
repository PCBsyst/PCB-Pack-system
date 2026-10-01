create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('APPLICATION_REVIEW', 'CERTIFICATION_DECISION_REPORT', 'DELIVERY_CONFIRMATION')),
  language text not null check (language in ('KR', 'EN')),
  version text not null,
  storage_path text not null unique,
  original_file_name text not null,
  active boolean not null default true,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists document_templates_one_active
  on public.document_templates (document_type, language)
  where active;

alter table public.document_templates enable row level security;

drop policy if exists "Active staff can read document templates" on public.document_templates;
create policy "Active staff can read document templates"
  on public.document_templates for select to authenticated
  using (public.is_active_staff());

drop policy if exists "Admins can insert document templates" on public.document_templates;
create policy "Admins can insert document templates"
  on public.document_templates for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update document templates" on public.document_templates;
create policy "Admins can update document templates"
  on public.document_templates for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete document templates" on public.document_templates;
create policy "Admins can delete document templates"
  on public.document_templates for delete to authenticated
  using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-templates',
  'document-templates',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active staff can read document template files" on storage.objects;
create policy "Active staff can read document template files"
  on storage.objects for select to authenticated
  using (bucket_id = 'document-templates' and public.is_active_staff());

drop policy if exists "Admins can upload document template files" on storage.objects;
create policy "Admins can upload document template files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'document-templates' and public.is_admin());

drop policy if exists "Admins can update document template files" on storage.objects;
create policy "Admins can update document template files"
  on storage.objects for update to authenticated
  using (bucket_id = 'document-templates' and public.is_admin())
  with check (bucket_id = 'document-templates' and public.is_admin());

drop policy if exists "Admins can delete document template files" on storage.objects;
create policy "Admins can delete document template files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'document-templates' and public.is_admin());

