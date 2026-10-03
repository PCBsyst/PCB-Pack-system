begin;
create table if not exists public.privacy_access_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  action text not null check(action in ('CANDIDATE_VIEW','DOCUMENT_RESPONSE')),
  resource_type text not null,
  resource_id text not null,
  detail text not null default ''
);
create index if not exists privacy_access_logs_time_idx on public.privacy_access_logs(occurred_at desc,id desc);
alter table public.privacy_access_logs enable row level security;
drop policy if exists privacy_access_logs_owner_select on public.privacy_access_logs;
create policy privacy_access_logs_owner_select on public.privacy_access_logs for select to authenticated using(public.is_admin());
revoke insert,update,delete,truncate on public.privacy_access_logs from anon,authenticated;
grant select on public.privacy_access_logs to authenticated;

create or replace function public.record_privacy_access(event_actor uuid,event_action text,target_type text,target_id text,event_detail text default '')
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.profiles where id=event_actor and active) then raise exception 'Active staff required'; end if;
  if event_action<>'DOCUMENT_RESPONSE' or target_type not in ('job','application','certification_action') then raise exception 'Invalid access event'; end if;
  if nullif(trim(target_id),'') is null or length(target_id)>150 or length(event_detail)>100 then raise exception 'Invalid access target'; end if;
  insert into public.privacy_access_logs(actor_id,action,resource_type,resource_id,detail)
    values(event_actor,event_action,target_type,target_id,event_detail);
end; $$;
revoke all on function public.record_privacy_access(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_privacy_access(uuid,text,text,text,text) to service_role;

-- Read and record together; failure to record prevents this read path from returning personal data.
create or replace function public.read_candidate_with_access_log(target_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare candidate jsonb;
begin
  if not public.is_active_staff() then raise exception 'Active staff required'; end if;
  select to_jsonb(c) into candidate from public.candidates c where id=target_id;
  if candidate is null then raise exception 'Candidate not found'; end if;
  insert into public.privacy_access_logs(actor_id,action,resource_type,resource_id)
    values(auth.uid(),'CANDIDATE_VIEW','candidate',target_id::text);
  return candidate;
end; $$;
revoke all on function public.read_candidate_with_access_log(uuid) from public,anon;
grant execute on function public.read_candidate_with_access_log(uuid) to authenticated;
commit;
