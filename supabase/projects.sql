-- Projects and crew requests: a film project has a team; the owner invites people for a role and days, they accept or decline.
create table public.setup_projects(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  logline text not null default '' check (char_length(logline) <= 300),
  genre text not null default '' check (char_length(genre) <= 60),
  status text not null default 'development' check (status in ('development','pre_production','shooting','post_production','released')),
  city text not null default '' check (char_length(city) <= 80),
  description text not null default '' check (char_length(description) <= 3000),
  created_at timestamptz not null default now());
create index setup_projects_user on public.setup_projects(user_id);
create table public.setup_project_members(
  id bigint generated always as identity primary key,
  project_id bigint not null references public.setup_projects(id) on delete cascade,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  role text not null check (char_length(role) between 1 and 80),
  days text not null default '' check (char_length(days) <= 120),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'invited' check (status in ('invited','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(project_id, user_id));
create index setup_pm_user on public.setup_project_members(user_id);
alter table public.setup_projects enable row level security;
alter table public.setup_project_members enable row level security;

create policy setup_projects_read on public.setup_projects for select to anon, authenticated using (true);
create policy setup_projects_insert on public.setup_projects for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_projects_update on public.setup_projects for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy setup_projects_delete on public.setup_projects for delete to authenticated using (user_id = (select auth.uid()));

create policy setup_pm_read on public.setup_project_members for select to anon, authenticated
  using (status = 'accepted' or user_id = (select auth.uid())
    or exists(select 1 from public.setup_projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy setup_pm_insert on public.setup_project_members for insert to authenticated
  with check (status = 'invited' and user_id <> (select auth.uid())
    and exists(select 1 from public.setup_projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy setup_pm_respond on public.setup_project_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and status in ('accepted','declined'));
create policy setup_pm_delete on public.setup_project_members for delete to authenticated
  using (user_id = (select auth.uid()) or exists(select 1 from public.setup_projects p where p.id = project_id and p.user_id = (select auth.uid())));

grant select on public.setup_projects, public.setup_project_members to anon, authenticated;
grant insert, update, delete on public.setup_projects to authenticated;
grant insert, delete on public.setup_project_members to authenticated;
grant update (status) on public.setup_project_members to authenticated;

create function public.setup_trg_crew() returns trigger language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  select user_id, title into p from public.setup_projects where id = new.project_id;
  if tg_op = 'INSERT' then
    perform public.setup_notify(new.user_id, 'crew_invite', p.user_id, new.project_id, p.title);
  elsif new.status is distinct from old.status and new.status in ('accepted','declined') then
    perform public.setup_notify(p.user_id, case when new.status = 'accepted' then 'crew_accept' else 'crew_decline' end, new.user_id, new.project_id, p.title);
  end if;
  return new;
end $$;
revoke all on function public.setup_trg_crew() from public, anon, authenticated;
create trigger setup_crew_notify after insert or update on public.setup_project_members for each row execute function public.setup_trg_crew();
create trigger setup_rl_projects before insert on public.setup_projects for each row execute function public.setup_rate_limit('5', 'user_id');
