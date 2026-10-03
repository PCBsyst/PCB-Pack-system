begin;
create table if not exists public.package_generation_receipts (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default clock_timestamp(),
  application_id text not null,
  file_count integer not null check(file_count > 0),
  complete boolean not null,
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check(byte_size > 0),
  documents jsonb not null check(jsonb_typeof(documents) = 'array'),
  check(jsonb_array_length(documents) = file_count)
);
create index if not exists package_receipts_application_time on public.package_generation_receipts(application_id, occurred_at desc);
alter table public.package_generation_receipts enable row level security;
revoke all on public.package_generation_receipts from anon, authenticated;
grant select on public.package_generation_receipts to authenticated;
drop policy if exists package_receipts_staff_select on public.package_generation_receipts;
create policy package_receipts_staff_select on public.package_generation_receipts for select to authenticated using(public.is_active_staff());

create or replace function public.record_package_generation(event_actor uuid, target_application text, generated_documents jsonb, package_complete boolean, package_sha256 text, package_byte_size bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare receipt_id uuid;
begin
  if not exists(select 1 from public.profiles where id=event_actor and active) then raise exception 'Active staff required'; end if;
  if nullif(trim(target_application),'') is null or length(target_application)>150
    or jsonb_typeof(generated_documents) is distinct from 'array'
    or jsonb_array_length(generated_documents)=0 then raise exception 'Invalid generation metadata'; end if;
  insert into public.package_generation_receipts(actor_id,application_id,file_count,complete,sha256,byte_size,documents)
    values(event_actor,target_application,jsonb_array_length(generated_documents),package_complete,package_sha256,package_byte_size,generated_documents)
    returning id into receipt_id;
  return receipt_id;
end;
$$;
revoke all on function public.record_package_generation(uuid,text,jsonb,boolean,text,bigint) from public, anon, authenticated;
grant execute on function public.record_package_generation(uuid,text,jsonb,boolean,text,bigint) to service_role;
commit;
