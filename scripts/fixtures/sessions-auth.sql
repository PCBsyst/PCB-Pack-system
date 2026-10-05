-- Isolated DB only. This minimal auth.sessions fixture is not a production migration.
create table if not exists auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz not null default now());
insert into auth.sessions(id,user_id,not_after) values
 ('10000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',null),
 ('10000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333',now()-interval '1 minute'),
 ('10000000-0000-0000-0000-000000000003','44444444-4444-4444-4444-444444444444',null);
