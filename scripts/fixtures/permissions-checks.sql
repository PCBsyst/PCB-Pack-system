insert into public.privacy_access_logs(actor_id,action,resource_type,resource_id) values('77aa599a-ba14-4cff-99f4-ab8180faaff4','CANDIDATE_VIEW','candidate','synthetic');
set role authenticated;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2"}';
do $$begin
 if not public.is_active_staff() or public.is_admin() or public.is_account_inviter() then raise exception 'Staff helper mismatch';end if;
 if (select count(*) from public.candidates)<>1 then raise exception 'Staff personal data read denied';end if;
 perform public.read_candidate_with_access_log('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 if (select count(*) from public.privacy_access_logs)<>0 then raise exception 'Staff sees access logs';end if;
 update public.profiles set role='ADMIN' where id=auth.uid();
 if found then raise exception 'Staff self promotion allowed';end if;
 insert into public.candidates(name) values('실무자 등록 시험');
 delete from public.candidates where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 if found then raise exception 'Staff customer deletion allowed';end if;
 begin
  update public.candidates set phone='reason-missing' where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';raise exception 'Expected correction reason denial';
 exception when raise_exception then if sqlerrm<>'Customer correction requires active staff and a reason' then raise;end if;end;
 perform public.set_candidate_archive_status('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true,'가상 보관 검사',null);
 begin
  perform public.update_mfa_policy(false,'unauthorized',now());raise exception 'Expected owner denial';
 exception when raise_exception then if sqlerrm<>'Owner account required' then raise;end if;end;
end;$$;
set request.jwt.claims='{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal2"}';
do $$begin
 if not public.is_account_inviter() or public.is_admin() then raise exception 'Sub administrator helper mismatch';end if;
 update public.profiles set active=true where id='44444444-4444-4444-4444-444444444444';
 if found then raise exception 'Sub administrator activated account';end if;
 if (select count(*) from public.candidates)<>2 then raise exception 'Sub administrator read mismatch';end if;
end;$$;
set request.jwt.claims='{"sub":"44444444-4444-4444-4444-444444444444","aal":"aal2"}';
do $$begin
 if public.is_active_staff() or (select count(*) from public.candidates)<>0 then raise exception 'Inactive data access';end if;
 if (select count(*) from public.profiles)<>1 then raise exception 'Inactive profile setup scope';end if;
 begin
  insert into public.candidates(name) values('차단되어야 함');raise exception 'Expected inactive insert denial';
 exception when insufficient_privilege then null;end;
end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1"}';
do $$begin if public.is_active_staff() or (select count(*) from public.candidates)<>0 then raise exception 'MFA bypass when required';end if;end;$$;
set request.jwt.claims='{"sub":"77aa599a-ba14-4cff-99f4-ab8180faaff4","aal":"aal2"}';
do $$declare policy jsonb;begin
 if not public.is_admin() or not public.is_account_inviter() then raise exception 'Owner helpers';end if;
 if (select count(*) from public.privacy_access_logs)<2 then raise exception 'Owner access log scope';end if;
 update public.profiles set active=true where id='44444444-4444-4444-4444-444444444444';
 if not found then raise exception 'Owner account activation denied';end if;
 update public.profiles set active=false where id='44444444-4444-4444-4444-444444444444';
 policy:=public.get_mfa_policy();
 perform public.update_mfa_policy(false,'가상 MFA 정책 검사',(policy->>'updatedAt')::timestamptz);
 begin
  update public.profiles set active=false where id=auth.uid();raise exception 'Expected owner protection';
 exception when raise_exception then if sqlerrm<>'Owner account cannot be removed, demoted or disabled' then raise;end if;end;
end;$$;
set request.jwt.claims='{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1"}';
do $$begin if not public.is_active_staff() or public.is_admin() then raise exception 'MFA off alters role';end if;if (select count(*) from public.candidates)<>2 then raise exception 'MFA off staff read';end if;end;$$;
set request.jwt.claims='{"sub":"44444444-4444-4444-4444-444444444444","aal":"aal1"}';
do $$begin if public.is_active_staff() then raise exception 'MFA off activates inactive account';end if;end;$$;
reset role;
set role anon;
set request.jwt.claims='{}';
do $$begin if (select count(*) from public.candidates)<>0 then raise exception 'Anonymous personal data access';end if;end;$$;
reset role;
do $$begin
 if has_function_privilege('authenticated','public.record_privacy_access(uuid,text,text,text,text)','EXECUTE') then raise exception 'Client can forge response log';end if;
 if has_table_privilege('authenticated','public.mfa_policy','UPDATE') then raise exception 'Direct MFA update allowed';end if;
end;$$;
