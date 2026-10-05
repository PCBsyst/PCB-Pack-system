-- Synthetic claims, not a real signed session. Authorization functions remain production code.
create table if not exists auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create table if not exists auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid,status text);
create or replace function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
