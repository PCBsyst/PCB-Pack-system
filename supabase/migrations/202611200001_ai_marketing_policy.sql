-- Repeatable; does not reset an existing policy or create any provider request.
begin;
create table if not exists public.ai_marketing_policy (
  id text primary key check(id='MARKETING'),
  enabled boolean not null default false,
  retention_reviewed boolean not null default false,
  privacy_reviewed boolean not null default false,
  review_reference text not null default '' check(length(review_reference)<=500),
  config_fingerprint text not null default '' check(config_fingerprint='' or config_fingerprint ~ '^[a-f0-9]{64}$'),
  revision bigint not null default 0 check(revision between 0 and 9007199254740990),
  updated_at timestamptz not null default clock_timestamp(),
  check(not enabled or (retention_reviewed and privacy_reviewed and length(trim(review_reference))>=10 and config_fingerprint<>'')),
  check(not(retention_reviewed or privacy_reviewed) or length(trim(review_reference))>=10)
);
insert into public.ai_marketing_policy(id) values('MARKETING') on conflict(id) do nothing;
create table if not exists public.ai_marketing_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid not null,
  event_kind text not null check(event_kind in ('POLICY_UPDATED','TRANSFER_PREPARED','TRANSFER_RESPONSE','TRANSFER_FAILED')),
  policy_revision bigint not null,
  reason text not null default '' check(length(reason)<=1000),
  enabled_before boolean,
  enabled_after boolean,
  retention_reviewed boolean,
  privacy_reviewed boolean,
  review_reference text check(review_reference is null or length(review_reference)<=500),
  config_changed boolean,
  request_id uuid,
  snapshot_sha256 text check(snapshot_sha256 is null or snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  group_count integer check(group_count is null or group_count between 1 and 100)
);
create index if not exists ai_marketing_audit_recent_idx on public.ai_marketing_audit(occurred_at desc,id desc);
create unique index if not exists ai_marketing_audit_request_kind_idx on public.ai_marketing_audit(request_id,event_kind) where request_id is not null;
create unique index if not exists ai_marketing_audit_terminal_idx on public.ai_marketing_audit(request_id) where event_kind in ('TRANSFER_RESPONSE','TRANSFER_FAILED');
alter table public.ai_marketing_policy enable row level security;
alter table public.ai_marketing_audit enable row level security;
revoke all on public.ai_marketing_policy,public.ai_marketing_audit from anon,authenticated,service_role;
grant select on public.ai_marketing_policy,public.ai_marketing_audit to authenticated;
drop policy if exists ai_marketing_policy_owner_select on public.ai_marketing_policy;
create policy ai_marketing_policy_owner_select on public.ai_marketing_policy for select to authenticated
  using(public.is_admin() and public.has_staff_idle_session() and exists(select 1 from public.profiles where id=auth.uid() and active and is_owner));
drop policy if exists ai_marketing_audit_owner_select on public.ai_marketing_audit;
create policy ai_marketing_audit_owner_select on public.ai_marketing_audit for select to authenticated
  using(public.is_admin() and public.has_staff_idle_session() and exists(select 1 from public.profiles where id=auth.uid() and active and is_owner));

create or replace function public.read_ai_marketing_policy()
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.ai_marketing_policy; events jsonb;
begin
  if public.is_admin() is not true or public.has_staff_idle_session() is not true or not exists(select 1 from public.profiles where id=auth.uid() and active and is_owner) then raise exception 'Owner session required' using errcode='42501'; end if;
  select * into strict p from public.ai_marketing_policy where id='MARKETING';
  select coalesce(jsonb_agg(to_jsonb(e)-'sort_id' order by e.occurred_at desc,e.sort_id desc),'[]'::jsonb) into events
    from (select id::text,id as sort_id,occurred_at,actor_id,event_kind,policy_revision,reason,enabled_before,enabled_after,retention_reviewed,privacy_reviewed,review_reference,config_changed
          from public.ai_marketing_audit order by occurred_at desc,id desc limit 20) e;
  return jsonb_build_object('schema_version','AI-MKT-POLICY-01','policy',to_jsonb(p),'events',events);
end; $$;

create or replace function public.update_ai_marketing_policy(
  p_enabled boolean,p_retention_reviewed boolean,p_privacy_reviewed boolean,p_review_reference text,
  p_config_fingerprint text,p_reason text,p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.ai_marketing_policy; next_row public.ai_marketing_policy;
begin
  if public.is_admin() is not true or public.has_staff_idle_session() is not true then raise exception 'Owner session required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=auth.uid() and active and is_owner for share;
  if not found then raise exception 'Owner required' using errcode='42501'; end if;
  if p_enabled is null or p_retention_reviewed is null or p_privacy_reviewed is null
    or p_review_reference is null or length(p_review_reference)>500 or p_reason is null
    or length(trim(p_reason))<5 or length(p_reason)>1000 or p_config_fingerprint is null
    or not(p_config_fingerprint='' or p_config_fingerprint ~ '^[a-f0-9]{64}$') then raise exception 'Invalid policy request' using errcode='22023'; end if;
  if p_enabled and (not p_retention_reviewed or not p_privacy_reviewed or length(trim(p_review_reference))<10 or p_config_fingerprint='') then raise exception 'Reviews and configuration required' using errcode='22023'; end if;
  if (p_retention_reviewed or p_privacy_reviewed) and length(trim(p_review_reference))<10 then raise exception 'Review reference required' using errcode='22023'; end if;
  select * into strict prior from public.ai_marketing_policy where id='MARKETING' for update;
  if p_expected_revision is null or p_expected_revision<>prior.revision then raise exception 'Policy changed; reload' using errcode='40001'; end if;
  if (prior.enabled,prior.retention_reviewed,prior.privacy_reviewed,prior.review_reference,prior.config_fingerprint)
     is not distinct from (p_enabled,p_retention_reviewed,p_privacy_reviewed,trim(p_review_reference),p_config_fingerprint) then raise exception 'No change' using errcode='22023'; end if;
  update public.ai_marketing_policy set enabled=p_enabled,retention_reviewed=p_retention_reviewed,privacy_reviewed=p_privacy_reviewed,
    review_reference=trim(p_review_reference),config_fingerprint=p_config_fingerprint,revision=prior.revision+1,updated_at=clock_timestamp()
    where id='MARKETING' returning * into next_row;
  -- The update and this audit insert are one transaction: neither succeeds alone.
  insert into public.ai_marketing_audit(actor_id,event_kind,policy_revision,reason,enabled_before,enabled_after,retention_reviewed,privacy_reviewed,review_reference,config_changed)
    values(auth.uid(),'POLICY_UPDATED',next_row.revision,trim(p_reason),prior.enabled,next_row.enabled,next_row.retention_reviewed,next_row.privacy_reviewed,next_row.review_reference,prior.config_fingerprint is distinct from next_row.config_fingerprint);
  return public.read_ai_marketing_policy();
end; $$;

-- Future server adapter only. PREPARED means permission/audit reservation, never delivery.
create or replace function public.begin_ai_marketing_transfer(
  p_actor_id uuid,p_request_id uuid,p_expected_revision bigint,p_config_fingerprint text,p_snapshot_sha256 text,p_group_count integer
) returns void language plpgsql security definer set search_path=public as $$
declare p public.ai_marketing_policy;
begin
  perform 1 from public.profiles where id=p_actor_id and active and is_owner for share;
  if not found then raise exception 'Active owner required' using errcode='42501'; end if;
  select * into strict p from public.ai_marketing_policy where id='MARKETING' for share;
  if not p.enabled or not p.retention_reviewed or not p.privacy_reviewed or p_expected_revision is null
    or p_expected_revision<>p.revision or p_config_fingerprint is null or p_config_fingerprint<>p.config_fingerprint then raise exception 'Policy disabled or changed' using errcode='42501'; end if;
  if p_request_id is null or p_snapshot_sha256 is null or p_snapshot_sha256 !~ '^[a-f0-9]{64}$'
    or p_group_count is null or p_group_count not between 1 and 100 then raise exception 'Invalid transfer metadata' using errcode='22023'; end if;
  insert into public.ai_marketing_audit(actor_id,event_kind,policy_revision,request_id,snapshot_sha256,group_count)
    values(p_actor_id,'TRANSFER_PREPARED',p.revision,p_request_id,p_snapshot_sha256,p_group_count);
end; $$;
create or replace function public.finish_ai_marketing_transfer(p_request_id uuid,p_outcome text)
returns void language plpgsql security definer set search_path=public as $$
declare prepared public.ai_marketing_audit;
begin
  if p_outcome is null or p_outcome not in ('TRANSFER_RESPONSE','TRANSFER_FAILED') then raise exception 'Invalid outcome'; end if;
  select * into strict prepared from public.ai_marketing_audit where request_id=p_request_id and event_kind='TRANSFER_PREPARED' for update;
  -- Keep recording outcomes after an OFF or account deactivation; do not erase an in-flight trail.
  insert into public.ai_marketing_audit(actor_id,event_kind,policy_revision,request_id,snapshot_sha256,group_count)
    values(prepared.actor_id,p_outcome,prepared.policy_revision,prepared.request_id,prepared.snapshot_sha256,prepared.group_count);
end; $$;
revoke all on function public.read_ai_marketing_policy() from public,anon,authenticated;
revoke all on function public.update_ai_marketing_policy(boolean,boolean,boolean,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.read_ai_marketing_policy(),public.update_ai_marketing_policy(boolean,boolean,boolean,text,text,text,bigint) to authenticated;
revoke all on function public.begin_ai_marketing_transfer(uuid,uuid,bigint,text,text,integer),public.finish_ai_marketing_transfer(uuid,text) from public,anon,authenticated;
grant execute on function public.begin_ai_marketing_transfer(uuid,uuid,bigint,text,text,integer),public.finish_ai_marketing_transfer(uuid,text) to service_role;
commit;
