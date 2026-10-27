begin;
create schema if not exists fairshift_private;
revoke all on schema fairshift_private from public;
grant usage on schema fairshift_private to authenticated;

create table if not exists public.organizations (
 id text primary key, name text not null, industry text not null, currency text not null default 'INR', symbol text not null default '₹',
 settings jsonb not null check ((settings->>'standardDailyHours')::numeric > 0 and (settings->>'overtimeMultiplier')::numeric >= 1), created_at timestamptz not null default now()
);
create table if not exists public.user_profiles (id uuid primary key references auth.users(id), full_name text not null default '', created_at timestamptz not null default now());
create table if not exists public.organization_memberships (user_id uuid not null references auth.users(id), org_id text not null references public.organizations(id), role text not null check(role in ('worker','employer','admin')), primary key(user_id,org_id));
create index if not exists memberships_org_idx on public.organization_memberships(org_id);
create table if not exists public.workers (
 id text primary key default gen_random_uuid()::text, org_id text not null references public.organizations(id), user_id uuid references auth.users(id), name text not null, role text not null,
 hourly_rate numeric(10,2) not null check(hourly_rate>=0), created_at timestamptz not null default now(), unique(id,org_id), unique(user_id,org_id)
);
create index if not exists workers_org_idx on public.workers(org_id);
create table if not exists public.shifts (
 id text primary key default gen_random_uuid()::text, org_id text not null, worker_id text not null, start_time timestamptz not null default now(), end_time timestamptz,
 hours numeric(12,2) not null default 0, hourly_rate numeric(10,2) not null check(hourly_rate>=0), standard_hours numeric not null check(standard_hours>0), overtime_multiplier numeric not null check(overtime_multiplier>=1),
 regular_hours numeric(12,2) not null default 0, overtime_hours numeric(12,2) not null default 0, regular_pay numeric(14,2) not null default 0, overtime_pay numeric(14,2) not null default 0, total_estimated_earnings numeric(14,2) not null default 0,
 notes text not null default '', foreign key(worker_id,org_id) references public.workers(id,org_id), check(end_time is null or end_time>=start_time)
);
create unique index if not exists one_active_shift_per_worker on public.shifts(worker_id) where end_time is null;
create index if not exists shifts_org_worker_idx on public.shifts(org_id,worker_id,start_time desc);
create table if not exists public.safety_reports (
 id text primary key default gen_random_uuid()::text, org_id text not null, worker_id text not null, category text not null check(category in ('SAFETY_HAZARD','EQUIPMENT_ISSUE','EXCESSIVE_FATIGUE','CHEMICAL_EXPOSURE','PAY_DISCREPANCY','WORKPLACE_HARASSMENT')),
 severity text not null check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')), title text not null check(length(trim(title)) between 1 and 180), description text not null check(length(trim(description)) between 1 and 10000),
 status text not null default 'OPEN' check(status in ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')), submitted_at timestamptz not null default now(), resolved_at timestamptz, resolution_note text not null default '', resolved_by uuid references auth.users(id),
 foreign key(worker_id,org_id) references public.workers(id,org_id)
);
create index if not exists safety_reports_org_worker_idx on public.safety_reports(org_id,worker_id,status);
create table if not exists public.skill_passport_entries (
 id uuid primary key default gen_random_uuid(), worker_id text not null, org_id text not null, skill text not null check(length(trim(skill)) between 1 and 160), industry text not null, proficiency text not null check(proficiency in ('Beginner','Intermediate','Advanced')),
 course text not null default '', issuer text not null default '', completion_date date, verification_status text not null default 'SELF_REPORTED' check(verification_status='SELF_REPORTED'), created_at timestamptz not null default now(),
 foreign key(worker_id,org_id) references public.workers(id,org_id)
);
create index if not exists skills_org_worker_idx on public.skill_passport_entries(org_id,worker_id);
create table if not exists public.worker_feedback (
 id uuid primary key default gen_random_uuid(), worker_id text not null, org_id text not null, environment integer not null check(environment between 1 and 5), fairness integer not null check(fairness between 1 and 5), safety integer not null check(safety between 1 and 5), communication integer not null check(communication between 1 and 5), satisfaction integer not null check(satisfaction between 1 and 5), comment text not null default '' check(length(comment)<=2000), created_at timestamptz not null default now(),
 foreign key(worker_id,org_id) references public.workers(id,org_id)
);
create index if not exists feedback_org_worker_idx on public.worker_feedback(org_id,worker_id);

create or replace function fairshift_private.is_member(p_org text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_memberships where org_id=p_org and user_id=(select auth.uid())) $$;
create or replace function fairshift_private.is_employer(p_org text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_memberships where org_id=p_org and user_id=(select auth.uid()) and role in ('employer','admin')) $$;
create or replace function fairshift_private.owns_worker(p_worker text,p_org text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.workers w join public.organization_memberships m on m.org_id=w.org_id and m.user_id=w.user_id where w.id=p_worker and w.org_id=p_org and w.user_id=(select auth.uid()) and m.role='worker') $$;

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.workers enable row level security;
alter table public.shifts enable row level security;
alter table public.safety_reports enable row level security;
alter table public.skill_passport_entries enable row level security;
alter table public.worker_feedback enable row level security;

-- Reapplying this migration replaces only FairShift's named policies and grants.
drop policy if exists fs_organizations_read on public.organizations;
create policy fs_organizations_read on public.organizations for select to authenticated using(fairshift_private.is_member(id));
drop policy if exists fs_profiles_read on public.user_profiles;
create policy fs_profiles_read on public.user_profiles for select to authenticated using(id=(select auth.uid()));
drop policy if exists fs_profiles_update on public.user_profiles;
create policy fs_profiles_update on public.user_profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists fs_memberships_read on public.organization_memberships;
create policy fs_memberships_read on public.organization_memberships for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists fs_workers_read on public.workers;
create policy fs_workers_read on public.workers for select to authenticated using(fairshift_private.owns_worker(id,org_id) or fairshift_private.is_employer(org_id));
drop policy if exists fs_shifts_read on public.shifts;
create policy fs_shifts_read on public.shifts for select to authenticated using(fairshift_private.owns_worker(worker_id,org_id) or fairshift_private.is_employer(org_id));
drop policy if exists fs_reports_read on public.safety_reports;
create policy fs_reports_read on public.safety_reports for select to authenticated using(fairshift_private.owns_worker(worker_id,org_id) or fairshift_private.is_employer(org_id));
drop policy if exists fs_reports_insert on public.safety_reports;
create policy fs_reports_insert on public.safety_reports for insert to authenticated with check(fairshift_private.owns_worker(worker_id,org_id) and status='OPEN' and resolution_note='' and resolved_by is null and resolved_at is null);
drop policy if exists fs_reports_update on public.safety_reports;
create policy fs_reports_update on public.safety_reports for update to authenticated using(fairshift_private.is_employer(org_id)) with check(fairshift_private.is_employer(org_id));
drop policy if exists fs_skills_read on public.skill_passport_entries;
create policy fs_skills_read on public.skill_passport_entries for select to authenticated using(fairshift_private.owns_worker(worker_id,org_id) or fairshift_private.is_employer(org_id));
drop policy if exists fs_skills_insert on public.skill_passport_entries;
create policy fs_skills_insert on public.skill_passport_entries for insert to authenticated with check(fairshift_private.owns_worker(worker_id,org_id) and verification_status='SELF_REPORTED');
drop policy if exists fs_skills_update on public.skill_passport_entries;
create policy fs_skills_update on public.skill_passport_entries for update to authenticated using(fairshift_private.owns_worker(worker_id,org_id)) with check(fairshift_private.owns_worker(worker_id,org_id) and verification_status='SELF_REPORTED');
drop policy if exists fs_feedback_read on public.worker_feedback;
create policy fs_feedback_read on public.worker_feedback for select to authenticated using(fairshift_private.owns_worker(worker_id,org_id));
drop policy if exists fs_feedback_insert on public.worker_feedback;
create policy fs_feedback_insert on public.worker_feedback for insert to authenticated with check(fairshift_private.owns_worker(worker_id,org_id));

revoke all on public.organizations, public.user_profiles, public.organization_memberships, public.workers, public.shifts, public.safety_reports, public.skill_passport_entries, public.worker_feedback from anon,authenticated;
grant select on public.organizations,public.user_profiles,public.organization_memberships,public.workers,public.shifts,public.safety_reports,public.skill_passport_entries,public.worker_feedback to authenticated;
grant update(full_name) on public.user_profiles to authenticated;
grant insert(org_id,worker_id,category,severity,title,description) on public.safety_reports to authenticated;
grant update(status,resolution_note) on public.safety_reports to authenticated;
grant insert(worker_id,org_id,skill,industry,proficiency,course,issuer,completion_date) on public.skill_passport_entries to authenticated;
grant update(skill,industry,proficiency,course,issuer,completion_date) on public.skill_passport_entries to authenticated;
grant insert(worker_id,org_id,environment,fairness,safety,communication,satisfaction,comment) on public.worker_feedback to authenticated;
-- No DELETE grants or policies: ordinary clients cannot delete shared records.

create or replace function fairshift_private.check_in(p_org_id text) returns public.shifts language plpgsql security definer set search_path='' as $$
declare w public.workers; o public.organizations; s public.shifts;
begin
 select * into w from public.workers where org_id=p_org_id and user_id=auth.uid() for update;
 if not found or not fairshift_private.owns_worker(w.id,p_org_id) then raise exception 'Worker access denied' using errcode='42501'; end if;
 select * into o from public.organizations where id=p_org_id;
 insert into public.shifts(org_id,worker_id,hourly_rate,standard_hours,overtime_multiplier) values(p_org_id,w.id,w.hourly_rate,(o.settings->>'standardDailyHours')::numeric,(o.settings->>'overtimeMultiplier')::numeric) returning * into s;
 return s;
end $$;
create or replace function fairshift_private.check_out(p_org_id text) returns public.shifts language plpgsql security definer set search_path='' as $$
declare w public.workers; s public.shifts; h numeric; r numeric; ot numeric; rp numeric; op numeric;
begin
 select * into w from public.workers where org_id=p_org_id and user_id=auth.uid() for update;
 if not found or not fairshift_private.owns_worker(w.id,p_org_id) then raise exception 'Worker access denied' using errcode='42501'; end if;
 select * into s from public.shifts where worker_id=w.id and org_id=p_org_id and end_time is null for update;
 if not found then raise exception 'No active shift'; end if;
 h:=greatest(0,round((extract(epoch from (now()-s.start_time))/3600)::numeric,2)); r:=least(h,s.standard_hours); ot:=greatest(0,h-s.standard_hours); rp:=round(r*s.hourly_rate,2); op:=round(ot*round(s.hourly_rate*s.overtime_multiplier,2),2);
 update public.shifts set end_time=now(),hours=h,regular_hours=r,overtime_hours=ot,regular_pay=rp,overtime_pay=op,total_estimated_earnings=rp+op where id=s.id returning * into s; return s;
end $$;
create or replace function public.fairshift_check_in(p_org_id text) returns public.shifts language sql security invoker set search_path='' as $$ select fairshift_private.check_in(p_org_id) $$;
create or replace function public.fairshift_check_out(p_org_id text) returns public.shifts language sql security invoker set search_path='' as $$ select fairshift_private.check_out(p_org_id) $$;

create or replace function fairshift_private.feedback_summary(p_org_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; n integer;
begin
 if not fairshift_private.is_employer(p_org_id) then raise exception 'Employer access denied' using errcode='42501'; end if;
 select count(distinct worker_id) into n from public.worker_feedback where org_id=p_org_id;
 if n<3 then return jsonb_build_object('suppressed',true,'minimumContributors',3); end if;
 -- One latest response per worker: repeated submissions cannot reveal or overweight a person.
 select jsonb_build_object('suppressed',false,'responses',count(*),'environment',round(avg(environment),2),'fairness',round(avg(fairness),2),'safety',round(avg(safety),2),'communication',round(avg(communication),2),'satisfaction',round(avg(satisfaction),2)) into result from (select distinct on(worker_id) environment,fairness,safety,communication,satisfaction from public.worker_feedback where org_id=p_org_id order by worker_id,created_at desc,id desc) f;
 return result;
end $$;
create or replace function public.fairshift_feedback_summary(p_org_id text) returns jsonb language sql security invoker set search_path='' as $$ select fairshift_private.feedback_summary(p_org_id) $$;

create or replace function fairshift_private.report_audit() returns trigger language plpgsql security definer set search_path='' as $$ begin new.resolved_by:=auth.uid(); new.resolved_at:=case when new.status in ('RESOLVED','DISMISSED') then now() else null end; return new; end $$;
drop trigger if exists fs_report_audit on public.safety_reports;
create trigger fs_report_audit before update on public.safety_reports for each row execute function fairshift_private.report_audit();

revoke all on all functions in schema fairshift_private from public,anon;
grant execute on function fairshift_private.is_member(text),fairshift_private.is_employer(text),fairshift_private.owns_worker(text,text),fairshift_private.check_in(text),fairshift_private.check_out(text),fairshift_private.feedback_summary(text) to authenticated;
revoke all on function public.fairshift_check_in(text),public.fairshift_check_out(text),public.fairshift_feedback_summary(text) from public,anon;
grant execute on function public.fairshift_check_in(text),public.fairshift_check_out(text),public.fairshift_feedback_summary(text) to authenticated;
commit;