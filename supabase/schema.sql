-- Set UP — complete database setup (final state). Run once in a NEW Supabase project (SQL editor).
-- Replace __REF__ with the project reference (the part before .supabase.co) before running.

create table public.setup_profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  role text not null default 'Other',
  headline text not null default '' check (char_length(headline) <= 120),
  city text not null default '' check (char_length(city) <= 80),
  bio text not null default '' check (char_length(bio) <= 1500),
  skills text not null default '' check (char_length(skills) <= 300),
  avatar text not null default '' check (avatar = '' or avatar like 'https://__REF__.supabase.co/storage/v1/object/public/setup-uploads/%'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  open_to_work boolean not null default false,
  available_from text not null default '' check (available_from = '' or available_from ~ '^\d{4}-\d{2}-\d{2}$'),
  reel_url text not null default '' check (reel_url = '' or (reel_url ~ '^https://' and char_length(reel_url) <= 300)),
  created_at timestamptz not null default now());
create index setup_profiles_geo on public.setup_profiles(lat, lng) where lat is not null;

create table public.setup_communities(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  topic text not null default 'General' check (topic in ('General','Acting','Directing','Producing','Cinematography','Editing','Sound','Writing','Crew','Students','Local')),
  city text not null default '' check (char_length(city) <= 80),
  description text not null default '' check (char_length(description) <= 1000),
  created_at timestamptz not null default now());
create index setup_communities_user on public.setup_communities(user_id);

create table public.setup_community_members(
  community_id bigint not null references public.setup_communities(id) on delete cascade,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(community_id, user_id));
create index setup_cm_user on public.setup_community_members(user_id);

create table public.setup_posts(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 3000),
  image text not null default '' check (image = '' or image like 'https://__REF__.supabase.co/storage/v1/object/public/setup-uploads/%'),
  community_id bigint references public.setup_communities(id) on delete cascade,
  kind text not null default 'update' check (kind in ('update','showcase','question','tip','job','collab','event','news')),
  created_at timestamptz not null default now(),
  check (body <> '' or image <> ''));
create index setup_posts_created on public.setup_posts(created_at desc);
create index setup_posts_user on public.setup_posts(user_id);
create index setup_posts_community on public.setup_posts(community_id);

create table public.setup_likes(
  post_id bigint not null references public.setup_posts(id) on delete cascade,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  primary key(post_id, user_id));
create index setup_likes_user on public.setup_likes(user_id);

create table public.setup_comments(
  id bigint generated always as identity primary key,
  post_id bigint not null references public.setup_posts(id) on delete cascade,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now());
create index setup_comments_post on public.setup_comments(post_id);
create index setup_comments_user on public.setup_comments(user_id);

create table public.setup_follows(
  follower_id uuid not null references public.setup_profiles(id) on delete cascade,
  followee_id uuid not null references public.setup_profiles(id) on delete cascade,
  primary key(follower_id, followee_id), check (follower_id <> followee_id));
create index setup_follows_followee on public.setup_follows(followee_id);

create table public.setup_connections(
  id bigint generated always as identity primary key,
  from_id uuid not null references public.setup_profiles(id) on delete cascade,
  to_id uuid not null references public.setup_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique(from_id, to_id), check (from_id <> to_id));
create index setup_connections_to on public.setup_connections(to_id);

create table public.setup_castings(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'Other' check (category in ('Acting','Crew','Voice','Extras','Other')),
  production text not null default '' check (char_length(production) <= 120),
  city text not null default '' check (char_length(city) <= 80),
  pay text not null default '' check (char_length(pay) <= 80),
  deadline text not null default '' check (deadline = '' or deadline ~ '^\d{4}-\d{2}-\d{2}$'),
  description text not null default '' check (char_length(description) <= 4000),
  created_at timestamptz not null default now());
create index setup_castings_user on public.setup_castings(user_id);
create index setup_castings_created on public.setup_castings(created_at desc);

create table public.setup_applications(
  id bigint generated always as identity primary key,
  casting_id bigint not null references public.setup_castings(id) on delete cascade,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 1500),
  created_at timestamptz not null default now(),
  unique(casting_id, user_id));
create index setup_applications_user on public.setup_applications(user_id);

create table public.setup_meetups(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  city text not null default '' check (char_length(city) <= 80),
  venue text not null default '' check (char_length(venue) <= 120),
  starts text not null check (starts ~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$'),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now());
create index setup_meetups_user on public.setup_meetups(user_id);
create index setup_meetups_starts on public.setup_meetups(starts);

create table public.setup_rsvps(
  meetup_id bigint not null references public.setup_meetups(id) on delete cascade,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  primary key(meetup_id, user_id));
create index setup_rsvps_user on public.setup_rsvps(user_id);

create table public.setup_messages(
  id bigint generated always as identity primary key,
  from_id uuid not null references public.setup_profiles(id) on delete cascade,
  to_id uuid not null references public.setup_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read boolean not null default false, check (from_id <> to_id));
create index setup_messages_from on public.setup_messages(from_id);
create index setup_messages_to on public.setup_messages(to_id);

create table public.setup_notifications(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  kind text not null,
  actor_id uuid not null references public.setup_profiles(id) on delete cascade,
  ref bigint not null default 0,
  label text not null default '',
  created_at timestamptz not null default now(),
  read boolean not null default false);
create index setup_notifications_user on public.setup_notifications(user_id, read);
create index setup_notifications_actor on public.setup_notifications(actor_id);

create table public.setup_credits(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.setup_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  role text not null default '' check (char_length(role) <= 80),
  kind text not null default '' check (char_length(kind) <= 40),
  year text not null default '' check (year = '' or year ~ '^\d{4}$'),
  description text not null default '' check (char_length(description) <= 600),
  created_at timestamptz not null default now());
create index setup_credits_user on public.setup_credits(user_id);

-- row level security
alter table public.setup_profiles enable row level security;
alter table public.setup_communities enable row level security;
alter table public.setup_community_members enable row level security;
alter table public.setup_posts enable row level security;
alter table public.setup_likes enable row level security;
alter table public.setup_comments enable row level security;
alter table public.setup_follows enable row level security;
alter table public.setup_connections enable row level security;
alter table public.setup_castings enable row level security;
alter table public.setup_applications enable row level security;
alter table public.setup_meetups enable row level security;
alter table public.setup_rsvps enable row level security;
alter table public.setup_messages enable row level security;
alter table public.setup_notifications enable row level security;
alter table public.setup_credits enable row level security;

create policy setup_profiles_read on public.setup_profiles for select to anon, authenticated using (true);
create policy setup_profiles_insert on public.setup_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy setup_profiles_update on public.setup_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy setup_communities_read on public.setup_communities for select to anon, authenticated using (true);
create policy setup_communities_insert on public.setup_communities for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_communities_update on public.setup_communities for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy setup_communities_delete on public.setup_communities for delete to authenticated using (user_id = (select auth.uid()));
create policy setup_cm_read on public.setup_community_members for select to anon, authenticated using (true);
create policy setup_cm_insert on public.setup_community_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_cm_delete on public.setup_community_members for delete to authenticated using (user_id = (select auth.uid()));

create policy setup_posts_read on public.setup_posts for select to anon, authenticated using (true);
create policy setup_posts_insert on public.setup_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and (community_id is null or exists(select 1 from public.setup_community_members m
    where m.community_id = setup_posts.community_id and m.user_id = (select auth.uid()))));
create policy setup_posts_delete on public.setup_posts for delete to authenticated using (user_id = (select auth.uid()));
create policy setup_likes_read on public.setup_likes for select to anon, authenticated using (true);
create policy setup_likes_insert on public.setup_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_likes_delete on public.setup_likes for delete to authenticated using (user_id = (select auth.uid()));
create policy setup_comments_read on public.setup_comments for select to anon, authenticated using (true);
create policy setup_comments_insert on public.setup_comments for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_comments_delete on public.setup_comments for delete to authenticated using (user_id = (select auth.uid()));

create policy setup_follows_read on public.setup_follows for select to anon, authenticated using (true);
create policy setup_follows_insert on public.setup_follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy setup_follows_delete on public.setup_follows for delete to authenticated using (follower_id = (select auth.uid()));

create policy setup_connections_read on public.setup_connections for select to authenticated using (from_id = (select auth.uid()) or to_id = (select auth.uid()));
create policy setup_connections_insert on public.setup_connections for insert to authenticated with check (from_id = (select auth.uid()) and status = 'pending');
create policy setup_connections_accept on public.setup_connections for update to authenticated
  using (to_id = (select auth.uid()) and status = 'pending') with check (to_id = (select auth.uid()) and status = 'accepted');
create policy setup_connections_delete on public.setup_connections for delete to authenticated using (from_id = (select auth.uid()) or to_id = (select auth.uid()));

create policy setup_castings_read on public.setup_castings for select to anon, authenticated using (true);
create policy setup_castings_insert on public.setup_castings for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_castings_update on public.setup_castings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy setup_castings_delete on public.setup_castings for delete to authenticated using (user_id = (select auth.uid()));
create policy setup_applications_read on public.setup_applications for select to authenticated
  using (user_id = (select auth.uid()) or exists(select 1 from public.setup_castings c where c.id = casting_id and c.user_id = (select auth.uid())));
create policy setup_applications_insert on public.setup_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and not exists(select 1 from public.setup_castings c where c.id = casting_id and c.user_id = (select auth.uid())));
create policy setup_applications_delete on public.setup_applications for delete to authenticated using (user_id = (select auth.uid()));

create policy setup_meetups_read on public.setup_meetups for select to anon, authenticated using (true);
create policy setup_meetups_insert on public.setup_meetups for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_meetups_delete on public.setup_meetups for delete to authenticated using (user_id = (select auth.uid()));
create policy setup_rsvps_read on public.setup_rsvps for select to anon, authenticated using (true);
create policy setup_rsvps_insert on public.setup_rsvps for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_rsvps_delete on public.setup_rsvps for delete to authenticated using (user_id = (select auth.uid()));

create policy setup_messages_read on public.setup_messages for select to authenticated using (from_id = (select auth.uid()) or to_id = (select auth.uid()));
create policy setup_messages_insert on public.setup_messages for insert to authenticated
  with check (from_id = (select auth.uid()) and exists(select 1 from public.setup_connections c where c.status = 'accepted'
    and ((c.from_id = (select auth.uid()) and c.to_id = setup_messages.to_id) or (c.to_id = (select auth.uid()) and c.from_id = setup_messages.to_id))));
create policy setup_messages_mark_read on public.setup_messages for update to authenticated using (to_id = (select auth.uid())) with check (to_id = (select auth.uid()));

create policy setup_notifications_read on public.setup_notifications for select to authenticated using (user_id = (select auth.uid()));
create policy setup_notifications_mark_read on public.setup_notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy setup_credits_read on public.setup_credits for select to anon, authenticated using (true);
create policy setup_credits_insert on public.setup_credits for insert to authenticated with check (user_id = (select auth.uid()));
create policy setup_credits_update on public.setup_credits for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy setup_credits_delete on public.setup_credits for delete to authenticated using (user_id = (select auth.uid()));

-- grants: anonymous visitors may only read public tables; signed-in users are limited by the policies above
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on public.setup_connections, public.setup_messages, public.setup_notifications, public.setup_applications from anon;
revoke update on public.setup_messages, public.setup_notifications, public.setup_connections from authenticated;
grant update (read) on public.setup_messages to authenticated;
grant update (read) on public.setup_notifications to authenticated;
grant update (status) on public.setup_connections to authenticated;

-- public counts
create function public.setup_stats(uid uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'followers', (select count(*) from public.setup_follows where followee_id = uid),
    'connections', (select count(*) from public.setup_connections where status = 'accepted' and (from_id = uid or to_id = uid)));
$$;
revoke all on function public.setup_stats(uuid) from public;
grant execute on function public.setup_stats(uuid) to anon, authenticated;

-- notifications are created only by triggers
create function public.setup_notify(target uuid, k text, actor uuid, r bigint, l text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if target is not null and target <> actor then
    insert into public.setup_notifications(user_id, kind, actor_id, ref, label) values (target, k, actor, r, coalesce(l, ''));
  end if;
end $$;
revoke all on function public.setup_notify(uuid, text, uuid, bigint, text) from public, anon, authenticated;

create function public.setup_trg_like() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform public.setup_notify((select user_id from public.setup_posts where id = new.post_id), 'like', new.user_id, new.post_id, ''); return new; end $$;
create trigger setup_like_notify after insert on public.setup_likes for each row execute function public.setup_trg_like();
create function public.setup_trg_comment() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform public.setup_notify((select user_id from public.setup_posts where id = new.post_id), 'comment', new.user_id, new.post_id, ''); return new; end $$;
create trigger setup_comment_notify after insert on public.setup_comments for each row execute function public.setup_trg_comment();
create function public.setup_trg_follow() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform public.setup_notify(new.followee_id, 'follow', new.follower_id, 0, ''); return new; end $$;
create trigger setup_follow_notify after insert on public.setup_follows for each row execute function public.setup_trg_follow();
create function public.setup_trg_connection() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then perform public.setup_notify(new.to_id, 'connect_request', new.from_id, 0, '');
  elsif new.status = 'accepted' and old.status <> 'accepted' then perform public.setup_notify(new.from_id, 'connect_accept', new.to_id, 0, ''); end if;
  return new;
end $$;
create trigger setup_connection_notify after insert or update on public.setup_connections for each row execute function public.setup_trg_connection();
create function public.setup_trg_application() returns trigger language plpgsql security definer set search_path = '' as $$
declare c record;
begin select user_id, title into c from public.setup_castings where id = new.casting_id;
  perform public.setup_notify(c.user_id, 'application', new.user_id, new.casting_id, c.title); return new; end $$;
create trigger setup_application_notify after insert on public.setup_applications for each row execute function public.setup_trg_application();
create function public.setup_trg_rsvp() returns trigger language plpgsql security definer set search_path = '' as $$
declare m record;
begin select user_id, title into m from public.setup_meetups where id = new.meetup_id;
  perform public.setup_notify(m.user_id, 'rsvp', new.user_id, new.meetup_id, m.title); return new; end $$;
create trigger setup_rsvp_notify after insert on public.setup_rsvps for each row execute function public.setup_trg_rsvp();
revoke all on function public.setup_trg_like(), public.setup_trg_comment(), public.setup_trg_follow(), public.setup_trg_connection(),
  public.setup_trg_application(), public.setup_trg_rsvp() from public, anon, authenticated;

-- storage: member uploads (own folder, images up to 5 MB) and brand files (dashboard upload only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('setup-uploads', 'setup-uploads', true, 5242880, array['image/png','image/jpeg','image/gif','image/webp']),
  ('setup-brand', 'setup-brand', true, 10485760, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;
create policy setup_uploads_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'setup-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy setup_uploads_delete on storage.objects for delete to authenticated
  using (bucket_id = 'setup-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ===== v2: reposts, reports, hourly rate limits =====
alter table public.setup_posts add column if not exists repost_of bigint references public.setup_posts(id) on delete set null;
create index if not exists setup_posts_repost on public.setup_posts(repost_of);
alter table public.setup_posts drop constraint if exists setup_posts_check;
alter table public.setup_posts add constraint setup_posts_check check (body <> '' or image <> '' or repost_of is not null);

create table public.setup_reports(
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.setup_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','profile','casting','community')),
  target_id text not null check (char_length(target_id) <= 60),
  reason text not null default 'other' check (reason in ('spam','harassment','misleading','inappropriate','other')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique(reporter_id, target_type, target_id));
create index setup_reports_reporter on public.setup_reports(reporter_id);
alter table public.setup_reports enable row level security;
create policy setup_reports_insert on public.setup_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
revoke all on public.setup_reports from anon;
revoke select, update, delete, truncate, references, trigger on public.setup_reports from authenticated;

create function public.setup_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cnt int;
begin
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - interval ''1 hour''', tg_table_name, tg_argv[1])
    into cnt using (to_jsonb(new) ->> tg_argv[1])::uuid;
  if cnt >= tg_argv[0]::int then
    raise exception 'Slow down: too many in the last hour. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.setup_rate_limit() from public, anon, authenticated;
create trigger setup_rl_posts before insert on public.setup_posts for each row execute function public.setup_rate_limit('30', 'user_id');
create trigger setup_rl_comments before insert on public.setup_comments for each row execute function public.setup_rate_limit('60', 'user_id');
create trigger setup_rl_messages before insert on public.setup_messages for each row execute function public.setup_rate_limit('120', 'from_id');
create trigger setup_rl_communities before insert on public.setup_communities for each row execute function public.setup_rate_limit('5', 'user_id');
create trigger setup_rl_castings before insert on public.setup_castings for each row execute function public.setup_rate_limit('10', 'user_id');
create trigger setup_rl_applications before insert on public.setup_applications for each row execute function public.setup_rate_limit('30', 'user_id');
create trigger setup_rl_connections before insert on public.setup_connections for each row execute function public.setup_rate_limit('60', 'from_id');
create trigger setup_rl_reports before insert on public.setup_reports for each row execute function public.setup_rate_limit('30', 'reporter_id');
-- (post "kind" column: see v1 definition above; it is part of setup_posts)
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

-- Meetup QR tickets: hosts check guests in.
alter table public.setup_rsvps add column if not exists checked_in_at timestamptz;
create policy setup_rsvps_update_host on public.setup_rsvps for update to authenticated
  using (exists(select 1 from public.setup_meetups m where m.id = meetup_id and m.user_id = (select auth.uid())))
  with check (exists(select 1 from public.setup_meetups m where m.id = meetup_id and m.user_id = (select auth.uid())));
grant update (checked_in_at) on public.setup_rsvps to authenticated;
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

-- Tighten column grants: crew answers and check-ins may only touch their one column.
revoke all on public.setup_project_members from anon, authenticated;
grant select on public.setup_project_members to anon, authenticated;
grant insert, delete on public.setup_project_members to authenticated;
grant update (status) on public.setup_project_members to authenticated;
revoke all on public.setup_projects from anon;
grant select on public.setup_projects to anon;
revoke update on public.setup_rsvps from authenticated;
grant update (checked_in_at) on public.setup_rsvps to authenticated;
revoke all on public.setup_rooms, public.setup_room_members from anon;
revoke update on public.setup_room_members from authenticated;
grant update (checked_in_at) on public.setup_room_members to authenticated;
