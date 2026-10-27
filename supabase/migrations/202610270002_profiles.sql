
-- Auth metadata never assigns roles. Only an operator provisions memberships.
create or replace function fairshift_private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.user_profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing; return new; end $$;
drop trigger if exists fs_create_profile on auth.users;
create trigger fs_create_profile after insert on auth.users for each row execute function fairshift_private.create_profile();
revoke all on function fairshift_private.create_profile() from public,anon,authenticated;
insert into public.user_profiles(id,full_name) select id,coalesce(raw_user_meta_data->>'full_name','') from auth.users on conflict(id) do nothing;