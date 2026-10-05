-- Read-only catalog checks. No customer rows, secrets, or function source are returned.
-- Presence does NOT certify migration version, permissions, or functional correctness.
begin transaction read only;
with objects(label,kind,name) as (values
 ('019 보관','function','public.set_candidate_archive_status(uuid,boolean,text,timestamptz)'),
 ('020 삭제','function','public.delete_mistaken_candidate(uuid,text,text,timestamptz)'),
 ('021 기능 설정','table','public.feature_controls'),
 ('022 생성기록','table','public.package_generation_receipts'),
 ('024 동시 수정','function','public.set_candidate_row_version()'),
 ('025 MFA 보호','function','public.has_staff_mfa_session()'),
 ('026 MFA 설정','function','public.get_mfa_policy()'),
 ('027 운영 모드','function','public.get_operation_mode()'),
 ('028 번호 분리','function','public.allocate_management_numbers_for_area(text,integer,integer)'),
 ('031 종료 세션 확인','function','public.has_live_staff_session()')
)
select label,case when kind='table' then to_regclass(name) is not null else to_regprocedure(name) is not null end as object_present
from objects order by label;
with markers(label,signature,marker) as (values
 ('023 수정사유 보호','public.guard_candidate_correction_reason()','Customer correction requires active staff and a reason'),
 ('029 상태 변환','public.import_legacy_certification_row(jsonb)','::public.application_status'),
 ('030 동시 이관','public.import_legacy_certification_row(jsonb)','legacy-import-identity'),
 ('030 배치 보호','public.import_legacy_certification_row_v3(uuid,integer,jsonb)','Import source row already recorded'),
 ('031 RLS 세션 연결','public.has_staff_mfa_session()','has_live_staff_session')
)
select label,case when to_regprocedure(signature) is null then false else strpos(pg_get_functiondef(to_regprocedure(signature)),marker)>0 end as code_marker_present
from markers order by label;
select c.relname as table_name,c.relrowsecurity as rls_enabled,
 exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname='staff_mfa_session_guard') as mfa_guard_present
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('candidates','applications','jobs','profiles','privacy_access_logs','package_generation_receipts') order by c.relname;
commit;
