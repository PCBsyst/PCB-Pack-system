-- Administrative reconciliation sign-off for completed historical imports.
alter table public.legacy_import_batches
  add column if not exists verification_status text not null default 'PENDING' check (verification_status in ('PENDING', 'VERIFIED')),
  add column if not exists verified_by uuid references public.profiles(id),
  add column if not exists verified_by_name text,
  add column if not exists verified_at timestamptz;

create or replace function public.verify_legacy_import_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare batch_row public.legacy_import_batches; actor_name text;
begin
  if not public.is_admin() then raise exception 'Administrator account required'; end if;
  select * into batch_row from public.legacy_import_batches where id = p_batch_id for update;
  if batch_row.id is null then raise exception 'Import batch not found'; end if;
  if batch_row.status <> 'COMPLETED' or batch_row.failed_count <> 0 or batch_row.success_count <> batch_row.total_rows then
    raise exception 'Only a fully successful completed batch can be verified';
  end if;
  select display_name into actor_name from public.profiles where id = auth.uid();
  update public.legacy_import_batches
     set verification_status = 'VERIFIED', verified_by = auth.uid(), verified_by_name = coalesce(actor_name, '관리자'), verified_at = now()
   where id = p_batch_id;
end;
$$;

revoke all on function public.verify_legacy_import_batch(uuid) from public;
grant execute on function public.verify_legacy_import_batch(uuid) to authenticated;
