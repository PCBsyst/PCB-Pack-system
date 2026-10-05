do $$declare batch uuid;payload jsonb;begin
 payload:='{"candidateName":"배치 후보자","candidateEmail":"batch@example.invalid","businessArea":"ISO","jobNo":"BATCH-1","standard":"TEST","grade":"TEST","receivedAt":"2026-01-01"}';
 batch:=public.start_legacy_import_batch('synthetic.csv',2);
 perform public.import_legacy_certification_row_v3(batch,2,payload);
 begin
  perform public.record_legacy_import_failure(batch,2,payload,'overwrite');raise exception 'Expected success protection';
 exception when raise_exception then if sqlerrm<>'Successful import evidence cannot become failure' then raise;end if;end;
 begin
  perform public.import_legacy_certification_row_v3(batch,2,payload||'{"jobNo":"BATCH-DUP"}');raise exception 'Expected duplicate row denial';
 exception when raise_exception then if sqlerrm<>'Import source row already recorded' then raise;end if;end;
 if exists(select 1 from public.jobs where job_no='BATCH-DUP') then raise exception 'Duplicate row leaked job';end if;
 perform public.record_legacy_import_failure(batch,3,'{}','synthetic failure');
 perform public.record_legacy_import_failure(batch,3,'{}','repeated failure');
 if not exists(select 1 from public.legacy_import_batches where id=batch and success_count=1 and failed_count=1) then raise exception 'Batch counter mismatch';end if;
 if not exists(select 1 from public.legacy_import_entries e join public.jobs j on j.id=e.job_id where e.batch_id=batch and e.status='SUCCESS' and e.candidate_id=j.candidate_id and e.application_id=j.application_id) then raise exception 'Audit linkage mismatch';end if;
 perform public.complete_legacy_import_batch(batch);
 begin
  perform public.import_legacy_certification_row_v3(batch,4,payload||'{"jobNo":"BATCH-CLOSED"}');raise exception 'Expected closed batch denial';
 exception when raise_exception then if sqlerrm<>'Active import batch not found' then raise;end if;end;
 begin
  perform public.verify_legacy_import_batch(batch);raise exception 'Expected failed verification denial';
 exception when raise_exception then if sqlerrm<>'Only a fully successful completed batch can be verified' then raise;end if;end;
 batch:=public.start_legacy_import_batch('success.csv',1);
 perform public.import_legacy_certification_row_v3(batch,2,payload||'{"jobNo":"BATCH-2"}');
 perform public.complete_legacy_import_batch(batch);perform public.verify_legacy_import_batch(batch);
 if not exists(select 1 from public.legacy_import_batches where id=batch and verification_status='VERIFIED' and success_count=1) then raise exception 'Batch verification missing';end if;
end;$$;
-- Widen the new-candidate race window so concurrent requests exercise serialization.
create function public.delay_parallel_candidate() returns trigger language plpgsql as $$
begin if new.email='parallel@example.invalid' then perform pg_sleep(0.1);end if;return new;end;$$;
create trigger delay_parallel_candidate before insert on public.candidates for each row execute function public.delay_parallel_candidate();
