-- Run as the project owner after creating Auth users in the dashboard.
-- Replace example addresses with accounts you control; no passwords belong here.
begin;
insert into public.organization_memberships(user_id,org_id,role)
select id,'org-buildright','worker' from auth.users where email='worker@example.test'
on conflict(user_id,org_id) do nothing;
update public.workers set user_id=(select id from auth.users where email='worker@example.test')
where id='w-c1' and user_id is null and exists(select 1 from auth.users where email='worker@example.test');
insert into public.organization_memberships(user_id,org_id,role)
select id,'org-buildright','employer' from auth.users where email='employer@example.test'
on conflict(user_id,org_id) do nothing;
commit;