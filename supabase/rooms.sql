-- Private rooms: invite-only spaces (programs, presentations, screenings) with QR invites and check-in.
create table public.setup_rooms(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'presentation' check (kind in ('presentation','program','screening','casting_day','other')),
  description text not null default '' check (char_length(description) <= 4000),
  starts_at timestamptz,
  location text not null default '' check (char_length(location) <= 160),
  link text not null default '' check (char_length(link) <= 500),
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 12),
  invite_open boolean not null default true,
  created_at timestamptz not null default now());
create index setup_rooms_user on public.setup_rooms(user_id);
create table public.setup_room_members(
  room_id bigint not null references public.setup_rooms(id) on delete cascade,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  checked_in_at timestamptz,
  primary key(room_id, user_id));
create index setup_rm_user on public.setup_room_members(user_id);
alter table public.setup_rooms enable row level security;
alter table public.setup_room_members enable row level security;

create function public.setup_is_room_member(rid bigint) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.setup_room_members where room_id = rid and user_id = (select auth.uid())) $$;
revoke all on function public.setup_is_room_member(bigint) from public, anon;
grant execute on function public.setup_is_room_member(bigint) to authenticated;

create policy setup_rooms_read on public.setup_rooms for select to authenticated
  using (user_id = (select auth.uid()) or public.setup_is_room_member(id));
create policy setup_rooms_insert on public.setup_rooms for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_rooms_update on public.setup_rooms for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy setup_rooms_delete on public.setup_rooms for delete to authenticated using (user_id = (select auth.uid()));
create policy setup_rm_read on public.setup_room_members for select to authenticated
  using (user_id = (select auth.uid()) or public.setup_is_room_member(room_id)
    or exists(select 1 from public.setup_rooms r where r.id = room_id and r.user_id = (select auth.uid())));
create policy setup_rm_update on public.setup_room_members for update to authenticated
  using (exists(select 1 from public.setup_rooms r where r.id = room_id and r.user_id = (select auth.uid())))
  with check (exists(select 1 from public.setup_rooms r where r.id = room_id and r.user_id = (select auth.uid())));
create policy setup_rm_delete on public.setup_room_members for delete to authenticated
  using (user_id = (select auth.uid()) or exists(select 1 from public.setup_rooms r where r.id = room_id and r.user_id = (select auth.uid())));

-- Invite landing: shows only the basics, nothing private.
create function public.setup_room_preview(code text)
returns table(id bigint, title text, kind text, starts_at timestamptz, location text, host text)
language sql stable security definer set search_path = public as
$$ select r.id, r.title, r.kind, r.starts_at, r.location, p.name from public.setup_rooms r join public.setup_profiles p on p.id = r.user_id
   where r.invite_code = code and r.invite_open $$;
revoke all on function public.setup_room_preview(text) from public;
grant execute on function public.setup_room_preview(text) to anon, authenticated;

create function public.setup_join_room(code text) returns bigint
language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  if (select auth.uid()) is null then raise exception 'Please log in' using errcode = '28000'; end if;
  select id into rid from public.setup_rooms where invite_code = code and invite_open;
  if rid is null then raise exception 'This invite is not valid or has been closed'; end if;
  insert into public.setup_room_members(room_id, user_id) values (rid, (select auth.uid())) on conflict do nothing;
  return rid;
end $$;
revoke all on function public.setup_join_room(text) from public, anon;
grant execute on function public.setup_join_room(text) to authenticated;

create trigger setup_rl_rooms before insert on public.setup_rooms for each row execute function public.setup_rate_limit('10', 'user_id');
grant select, insert, update, delete on public.setup_rooms, public.setup_room_members to authenticated;
create policy setup_rm_insert_owner on public.setup_room_members for insert to authenticated
  with check (user_id = (select auth.uid()) and exists(select 1 from public.setup_rooms r where r.id = room_id and r.user_id = (select auth.uid())));
