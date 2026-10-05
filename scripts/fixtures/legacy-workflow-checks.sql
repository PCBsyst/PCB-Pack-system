do $$declare a jsonb;b jsonb;payload jsonb;before_count integer;begin
 payload:='{"candidateName":"가상 후보자","candidateBirthDate":"1990-01-01","candidateEmail":"sample@example.invalid","businessArea":"ISO","managementNo":"5","jobNo":"TEST-ISO-1","standard":"ISO 9001","grade":"Auditor","receivedAt":"2026-01-01","certificationNo":"TEST-CERT-1","issueDate":"2026-01-02","expiryDate":"2029-01-02","certificationState":"SUSPENDED"}';
 a:=public.import_legacy_certification_row_v2(payload);
 b:=public.import_legacy_certification_row_v2(payload||'{"businessArea":"K_BEAUTY","jobNo":"TEST-BEAUTY-1","standard":"Skin care","certificationNo":"TEST-CERT-2","certificationState":"WITHDRAWN","candidatePhone":"000-test"}');
 if a->>'candidate_id'<>b->>'candidate_id' or (b->>'candidate_reused')::boolean is not true then raise exception 'Candidate not reused';end if;
 if (select count(*) from public.candidates)<>1 or (select count(*) from public.applications)<>2 or (select count(*) from public.processing_cycles)<>2 or (select count(*) from public.certification_records)<>2 then raise exception 'Incomplete workflow';end if;
 if (select phone from public.candidates)<>'000-test' then raise exception 'Reason-protected candidate update failed';end if;
 if (select certification_state from public.jobs where job_no='TEST-ISO-1')<>'SUSPENDED' or (select certification_state from public.jobs where job_no='TEST-BEAUTY-1')<>'WITHDRAWN' then raise exception 'State not preserved';end if;
 before_count:=(select count(*) from public.jobs);
 begin
  perform public.import_legacy_certification_row(payload||'{"jobNo":"FAILED-IMPORT","managementNo":"6","certificationNo":"FAILED-CERT","issueDate":""}');
  raise exception 'Expected incomplete dates denial';
 exception when raise_exception then if sqlerrm<>'Issue date and expiry date are required for a certification record' then raise;end if;end;
 if (select count(*) from public.jobs)<>before_count or exists(select 1 from public.applications where management_no_from=6) then raise exception 'Partial import survived failure';end if;
 begin
  perform public.import_legacy_certification_row(payload||'{"jobNo":"FAILED-IDENTITY","managementNo":"6","certificationNo":"FAILED-CERT","candidateName":"다른 후보자"}');
  raise exception 'Expected identity denial';
 exception when raise_exception then if sqlerrm<>'Email belongs to another candidate' then raise;end if;end;
 perform set_config('app.correction_reason','test archive',true);
 update public.candidates set archived_at=now();
 begin
  perform public.import_legacy_certification_row(payload||'{"jobNo":"FAILED-ARCHIVE","managementNo":"6","certificationNo":"FAILED-CERT"}');
  raise exception 'Expected archived denial';
 exception when raise_exception then if sqlerrm<>'Archived candidate requires explicit restoration before import' then raise;end if;end;
 insert into public.audit_logs values(1,'synthetic evidence');
 begin
  delete from public.audit_logs;
  raise exception 'Expected evidence denial';
 exception when raise_exception then if sqlerrm<>'Evidence cannot be updated, deleted or truncated through normal operations' then raise;end if;end;
 perform public.import_legacy_certification_row(payload||'{"jobNo":"TEST-NO-CERT","managementNo":"6","candidateName":"미발행 후보자","candidateEmail":"second@example.invalid","certificationNo":"","issueDate":"","expiryDate":""}');
 if (select certification_state from public.jobs where job_no='TEST-NO-CERT')<>'NONE' or (select status from public.applications where management_no_from=6)<>'DOCUMENT_REVIEW' then raise exception 'Unissued status mismatch';end if;
 if exists(select 1 from public.certification_records c join public.jobs j on c.job_id=j.id where j.job_no='TEST-NO-CERT') then raise exception 'Unexpected certification record';end if;
end;$$;
