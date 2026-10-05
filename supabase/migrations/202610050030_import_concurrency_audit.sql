begin;
-- Imports are infrequent administrative work: serialize imports across areas before identity lookup.
do $migration$
declare source text;guard text;
begin
 source:=pg_get_functiondef('public.import_legacy_certification_row(jsonb)'::regprocedure);
 if strpos(source,'::public.application_status')=0 then raise exception 'Apply 029 before 030';end if;
 if strpos(source,'legacy-import-identity')>0 then return;end if;
 guard:=$guard$if not public.is_admin() then raise exception 'Administrator account required'; end if;$guard$;
 if strpos(source,guard)=0 then raise exception 'Unexpected import function';end if;
 source:=replace(source,guard,guard || E'\n  perform pg_advisory_xact_lock(hashtext(''legacy-import-identity''));');
 execute source;
end;$migration$;
-- A batch row lock serializes completion, imports and failure recording for this batch.
do $migration$
declare source text;guard text;
begin
 source:=pg_get_functiondef('public.import_legacy_certification_row_v3(uuid,integer,jsonb)'::regprocedure);
 if strpos(source,'Import source row already recorded')>0 then return;end if;
 guard:=$guard$if not exists(select 1 from public.legacy_import_batches where id = p_batch_id and created_by = auth.uid() and status = 'RUNNING') then raise exception 'Active import batch not found'; end if;$guard$;
 if strpos(source,guard)=0 then raise exception 'Unexpected batch import function';end if;
 source:=replace(source,guard,$new$
  perform 1 from public.legacy_import_batches where id=p_batch_id and created_by=auth.uid() and status='RUNNING' for update;
  if not found then raise exception 'Active import batch not found';end if;
  if p_source_row is null or p_source_row<1 then raise exception 'Invalid source row';end if;
  if exists(select 1 from public.legacy_import_entries where batch_id=p_batch_id and source_row=p_source_row) then raise exception 'Import source row already recorded';end if;
  if (select success_count+failed_count>=total_rows from public.legacy_import_batches where id=p_batch_id) then raise exception 'Import batch capacity exceeded';end if;
 $new$);
 execute source;
end;$migration$;
create or replace function public.record_legacy_import_failure(p_batch_id uuid,p_source_row integer,p_row jsonb,p_error_message text)
returns void language plpgsql security definer set search_path=public as $$
declare recorded_status text;
begin
 if not public.is_admin() then raise exception 'Administrator account required';end if;
 perform 1 from public.legacy_import_batches where id=p_batch_id and created_by=auth.uid() and status='RUNNING' for update;
 if not found then raise exception 'Active import batch not found';end if;
 if p_source_row is null or p_source_row<1 then raise exception 'Invalid source row';end if;
 select status into recorded_status from public.legacy_import_entries where batch_id=p_batch_id and source_row=p_source_row;
 if recorded_status='FAILED' then return;end if;
 if recorded_status='SUCCESS' then raise exception 'Successful import evidence cannot become failure';end if;
 if (select success_count+failed_count>=total_rows from public.legacy_import_batches where id=p_batch_id) then raise exception 'Import batch capacity exceeded';end if;
 insert into public.legacy_import_entries(batch_id,source_row,job_no,certification_no,status,error_message)
 values(p_batch_id,p_source_row,nullif(trim(p_row->>'jobNo'),''),nullif(trim(p_row->>'certificationNo'),''),'FAILED',left(coalesce(p_error_message,'Unknown error'),2000));
 update public.legacy_import_batches set failed_count=failed_count+1 where id=p_batch_id;
end;$$;
revoke all on function public.record_legacy_import_failure(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.record_legacy_import_failure(uuid,integer,jsonb,text) to authenticated;
commit;
