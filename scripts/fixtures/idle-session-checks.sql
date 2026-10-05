insert into auth.sessions(id,user_id,created_at) values
 ('20000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',now()-interval '10 minutes'),
 ('20000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333',now()-interval '2 hours'),
 ('20000000-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333',now()-interval '10 minutes');
set role authenticated;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","session_id":"20000000-0000-0000-0000-000000000001"}';
do $$declare result jsonb;begin
 if not public.is_active_staff() then raise exception 'Fresh session rejected';end if;
 result:=public.get_staff_idle_status();
 if result->>'valid'<>'true' then raise exception 'Status read failed';end if;
 result:=public.touch_staff_session_activity();
 if result->>'valid'<>'true' or (result->>'expiresAt')::timestamptz-(result->>'serverNow')::timestamptz<>interval '1 hour' then raise exception 'Activity time mismatch';end if;
end;$$;
reset role;
do $$declare before_time timestamptz;begin
 select last_activity_at into before_time from public.staff_session_activity where session_id='20000000-0000-0000-0000-000000000001';
 perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","session_id":"20000000-0000-0000-0000-000000000001"}',false);
 perform public.get_staff_idle_status();
 if (select last_activity_at from public.staff_session_activity where session_id='20000000-0000-0000-0000-000000000001')<>before_time then raise exception 'Read renewed idle session';end if;
end;$$;
update public.staff_session_activity set last_activity_at=now()-interval '1 hour' where session_id='20000000-0000-0000-0000-000000000001';
set role authenticated;
do $$begin
 if public.is_active_staff() or (select count(*) from public.candidates)<>0 then raise exception 'Exact one-hour boundary allowed';end if;
 if public.touch_staff_session_activity()->>'valid'<>'false' then raise exception 'Expired session resurrected';end if;
 begin
  perform public.update_mfa_policy(false,'expired session',now());
  raise exception 'Expired session changed MFA';
 exception when raise_exception then if sqlerrm<>'Active live staff session required' then raise;end if;end;
end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","session_id":"20000000-0000-0000-0000-000000000002"}';
do $$begin if public.has_live_staff_session() or public.touch_staff_session_activity()->>'valid'<>'false' then raise exception 'Old unregistered session resurrected';end if;end;$$;
reset role;
update public.mfa_policy set required=false;
set role authenticated;
do $$begin if public.is_active_staff() then raise exception 'MFA OFF bypassed idle timeout';end if;end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1","session_id":"20000000-0000-0000-0000-000000000003"}';
do $$begin if not public.is_active_staff() or public.touch_staff_session_activity()->>'valid'<>'true' then raise exception 'MFA OFF blocks fresh session';end if;end;$$;
reset role;
update public.staff_session_activity set last_activity_at=now()+interval '1 minute' where session_id='20000000-0000-0000-0000-000000000003';
set role authenticated;
do $$begin if public.has_live_staff_session() then raise exception 'Future activity time allowed';end if;end;$$;
reset role;
do $$begin
 if has_table_privilege('authenticated','public.staff_session_activity','UPDATE') or has_table_privilege('authenticated','public.staff_session_activity','SELECT') then raise exception 'Activity ledger exposed';end if;
 if has_function_privilege('anon','public.touch_staff_session_activity()','EXECUTE') then raise exception 'Anonymous activity renewal exposed';end if;
end;$$;
