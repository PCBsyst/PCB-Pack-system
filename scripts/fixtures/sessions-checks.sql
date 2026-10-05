set role authenticated;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1","session_id":"10000000-0000-0000-0000-000000000001"}';
do $$begin
 if not public.has_live_staff_session() or not public.is_active_staff() then raise exception 'Live staff rejected with MFA off';end if;
 if (select count(*) from public.candidates)<>2 then raise exception 'Live staff customer read mismatch';end if;
end;$$;
reset role;
update public.mfa_policy set required=true;
set role authenticated;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1","session_id":"10000000-0000-0000-0000-000000000001"}';
do $$begin if not public.has_live_staff_session() or public.is_active_staff() then raise exception 'Session guard bypassed MFA ON';end if;end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","session_id":"10000000-0000-0000-0000-000000000001"}';
do $$begin if not public.is_active_staff() then raise exception 'Valid AAL2 rejected with MFA ON';end if;end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","session_id":"10000000-0000-0000-0000-000000000002"}';
do $$begin if public.has_live_staff_session() or public.is_active_staff() or (select count(*) from public.candidates)<>0 then raise exception 'Expired session allowed';end if;end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","session_id":"10000000-0000-0000-0000-000000000003"}';
do $$begin if public.has_live_staff_session() then raise exception 'Other user session accepted';end if;end;$$;
set request.jwt.claims='{"sub":"44444444-4444-4444-4444-444444444444","aal":"aal2","session_id":"10000000-0000-0000-0000-000000000003"}';
do $$begin if public.has_live_staff_session() then raise exception 'Inactive staff session accepted';end if;end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","session_id":"bad"}';
do $$begin if public.has_live_staff_session() then raise exception 'Malformed session accepted';end if;end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2"}';
do $$begin if public.has_live_staff_session() then raise exception 'Missing session accepted';end if;end;$$;
reset role;
delete from auth.sessions where id='10000000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","session_id":"10000000-0000-0000-0000-000000000001"}';
do $$begin
 if public.has_live_staff_session() or public.is_active_staff() or (select count(*) from public.candidates)<>0 then raise exception 'Revoked session still authorized';end if;
 begin
  perform public.read_candidate_with_access_log('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  raise exception 'Revoked session RPC was allowed';
 exception when raise_exception then if sqlerrm='Revoked session RPC was allowed' then raise;end if;end;
end;$$;
reset role;
do $$begin
 if has_function_privilege('anon','public.has_live_staff_session()','EXECUTE') then raise exception 'Anonymous session RPC exposed';end if;
 if has_table_privilege('authenticated','auth.sessions','SELECT') then raise exception 'Staff can directly read auth sessions';end if;
end;$$;
