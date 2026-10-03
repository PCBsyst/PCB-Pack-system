-- Owner UUID explicitly supplied by the user on 2026-10-03.
-- Abort on missing profile or conflicting owner rather than changing ownership silently.
begin;
alter table public.profiles add column if not exists is_owner boolean not null default false;
alter table public.profiles alter column active set default false;
create unique index if not exists profiles_single_owner on public.profiles(is_owner) where is_owner;
do $$
declare owner_id uuid := '77aa599a-ba14-4cff-99f4-ab8180faaff4'::uuid;
begin
  if not exists(select 1 from public.profiles where id=owner_id) then
    raise exception 'Specified owner profile not found';
  end if;
  if exists(select 1 from public.profiles where is_owner and id<>owner_id) then
    raise exception 'A different owner is already assigned';
  end if;
  if not exists(select 1 from public.profiles where is_owner and active) then
    if owner_id is null then raise exception 'Set verified owner UUID in this migration before running'; end if;
    update public.profiles set is_owner=true, role='ADMIN', active=true where id=owner_id;
    if not found then raise exception 'Owner profile not found'; end if;
  end if;
end; $$;

-- Legacy ADMIN becomes sub administrator; existing management policies now require owner.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and is_owner);
$$;
create or replace function public.is_account_inviter() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role='ADMIN');
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,display_name,role,active,is_owner)
 values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),new.email),'STAFF',false,false);
 return new;
end; $$;

create or replace function public.protect_owner_profile() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' then
   if old.is_owner then raise exception 'Owner account cannot be deleted'; end if;
   return old;
 end if;
 if old.is_owner and (not new.is_owner or not new.active or new.role<>'ADMIN') then
   raise exception 'Owner account cannot be removed, demoted or disabled';
 end if;
 return new;
end; $$;
drop trigger if exists protect_owner_profile on public.profiles;
create trigger protect_owner_profile before update or delete on public.profiles for each row execute function public.protect_owner_profile();
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after insert or update or delete on public.profiles for each row execute function public.write_audit_log();
commit;
