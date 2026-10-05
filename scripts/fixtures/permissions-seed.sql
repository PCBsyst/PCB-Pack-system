insert into auth.users(id,email,raw_user_meta_data) values
 ('77aa599a-ba14-4cff-99f4-ab8180faaff4','owner@example.invalid','{}'),
 ('22222222-2222-2222-2222-222222222222','sub@example.invalid','{}'),
 ('33333333-3333-3333-3333-333333333333','staff@example.invalid','{}'),
 ('44444444-4444-4444-4444-444444444444','inactive@example.invalid','{}');
update public.profiles set active=true,role='ADMIN' where id='22222222-2222-2222-2222-222222222222';
update public.profiles set active=true where id='33333333-3333-3333-3333-333333333333';
update public.profiles set active=false where id='44444444-4444-4444-4444-444444444444';
insert into auth.mfa_factors(user_id,status) select id,'verified' from public.profiles;
insert into public.candidates(id,name) values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','권한검사 가상 후보자');
-- Supabase API table grants, explicit for this fixture. RLS is tested as authenticated, not superuser.
grant usage on schema public,auth to authenticated,anon;
grant select,insert,update,delete on public.candidates,public.profiles to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.candidates to anon;
