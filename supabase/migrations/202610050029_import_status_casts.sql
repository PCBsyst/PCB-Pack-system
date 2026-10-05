-- Apply after 023 and 028. Retain all existing import guards; cast CASE results to enum columns.
begin;
do $migration$
declare source text;old_status text;old_cert text;
begin
 source:=pg_get_functiondef('public.import_legacy_certification_row(jsonb)'::regprocedure);
 if strpos(source,'allocate_management_numbers_for_area')=0 then raise exception 'Apply 028 before 029';end if;
 if strpos(source,'::public.application_status')>0 and strpos(source,'::public.processing_status')>0 and strpos(source,'::public.certification_state')>0 then return;end if;
 old_status:=$old$case when nullif(p_row->>'certificationNo', '') is null then 'DOCUMENT_REVIEW' else 'COMPLETED' end$old$;
 old_cert:=$old$case when nullif(p_row->>'certificationNo', '') is null then 'NONE' else 'ACTIVE' end$old$;
 if strpos(source,old_status || ', v_management_no')=0 or strpos(source,old_status || ', v_received_at')=0 or strpos(source,old_cert)=0 then raise exception 'Unexpected import function. No changes applied';end if;
 source:=replace(source,old_status || ', v_management_no','(' || old_status || ')::public.application_status, v_management_no');
 source:=replace(source,old_status || ', v_received_at','(' || old_status || ')::public.processing_status, v_received_at');
 source:=replace(source,old_cert,'(' || old_cert || ')::public.certification_state');
 execute source;
end;$migration$;
commit;
