-- Disposable restore container only. Test rows and changes always roll back.
begin;
do $$
declare owner_id uuid;
begin
  select id into owner_id from public.profiles where active and is_owner;
  if owner_id is null then raise exception 'RESTORE_OWNER_REQUIRED'; end if;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub',owner_id,'role','authenticated')::text, true);
end $$;
set local role authenticated;
do $$
declare candidate public.candidates; rejected boolean;
begin
  if not public.is_admin() then raise exception 'OWNER_POLICY_CHECK_FAILED'; end if;
  insert into public.candidates(name) values ('격리 복원 시험 후보자') returning * into candidate;
  rejected := false;
  begin
    update public.candidates set name='사유 없는 변경' where id=candidate.id;
  exception when others then
    if sqlerrm not like '%correction requires%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'REASON_GUARD_FAILED'; end if;
  select * into candidate from public.update_candidate_with_reason_v2(
    candidate.id, '격리 복원 시험 정정', null,null,null,null,null,null,'복원 시험',candidate.row_version);
  if candidate.row_version <> 1 then raise exception 'VERSION_INCREMENT_FAILED'; end if;
  rejected := false;
  begin
    perform public.update_candidate_with_reason_v2(candidate.id,'충돌 시험',null,null,null,null,null,null,'복원 시험',0);
  exception when serialization_failure then rejected := true;
  end;
  if not rejected then raise exception 'STALE_VERSION_GUARD_FAILED'; end if;
  select * into candidate from public.set_candidate_archive_status(candidate.id,true,'복원 시험 보관',null);
  if candidate.archived_at is null then raise exception 'ARCHIVE_FAILED'; end if;
  select * into candidate from public.set_candidate_archive_status(candidate.id,false,'복원 시험 복원',candidate.archived_at);
  if candidate.archived_at is not null then raise exception 'UNARCHIVE_FAILED'; end if;
  rejected := false;
  begin
    delete from public.candidates where id=candidate.id;
  exception when others then
    if sqlerrm not like '%deletion operation%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'DIRECT_DELETE_GUARD_FAILED'; end if;
  perform public.delete_mistaken_candidate(candidate.id,candidate.name,'복원 시험 오등록 삭제',candidate.updated_at);
  if exists(select 1 from public.candidates where id=candidate.id) then raise exception 'OWNER_DELETE_FAILED'; end if;
  if not exists(select 1 from public.audit_logs where table_name='candidates' and before_data->>'id'=candidate.id::text) then
    raise exception 'DELETE_AUDIT_MISSING';
  end if;
  if has_table_privilege('authenticated','public.audit_logs','UPDATE')
    or has_table_privilege('authenticated','public.audit_logs','DELETE')
    or has_table_privilege('authenticated','public.package_generation_receipts','INSERT') then
    raise exception 'EVIDENCE_PERMISSION_CHECK_FAILED';
  end if;
end $$;
reset role;
-- A synthetic inactive account cannot use the active-staff write operations.
do $$
begin
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text, true);
end $$;
set local role authenticated;
do $$
declare rejected boolean := false;
begin
  if public.is_active_staff() or public.is_admin() then raise exception 'INACTIVE_ACCOUNT_POLICY_FAILED'; end if;
  if exists(select 1 from public.candidates) then raise exception 'INACTIVE_ACCOUNT_READ_FAILED'; end if;
  begin
    perform public.set_candidate_archive_status(gen_random_uuid(),true,'격리 시험',null);
  exception when others then
    if sqlerrm not like '%Active staff account required%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'INACTIVE_ACCOUNT_WRITE_FAILED'; end if;
  rejected := false;
  begin
    perform public.update_feature_control('DOCUMENT_GENERATION',false,'격리 시험',now());
  exception when others then
    if sqlerrm not like '%Owner account required%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'NONOWNER_FEATURE_CONTROL_FAILED'; end if;
end $$;
reset role;
rollback;
