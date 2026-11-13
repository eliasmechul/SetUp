-- Moderation: a small list of admins, and admin-only functions to read reports and remove reported content.
create table if not exists public.setup_admins(
  user_id uuid primary key references public.setup_profiles(id) on delete cascade,
  created_at timestamptz not null default now());
alter table public.setup_admins enable row level security;
revoke all on public.setup_admins from anon, authenticated;

create or replace function public.setup_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.setup_admins where user_id = (select auth.uid()));
$$;

create or replace function public.setup_mod_reports() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare out jsonb;
begin
  if not public.setup_is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x order by x.last_at desc), '[]'::jsonb) into out from (
    select r.target_type, r.target_id, count(*) as reports, max(r.created_at) as last_at,
      jsonb_agg(jsonb_build_object('reason', r.reason, 'note', r.note, 'by', rp.name, 'at', r.created_at) order by r.created_at desc) as items,
      case r.target_type
        when 'post' then (select jsonb_build_object('text', left(p.body, 400), 'image', p.image, 'author', a.name, 'author_id', a.id) from public.setup_posts p join public.setup_profiles a on a.id = p.user_id where p.id::text = r.target_id)
        when 'comment' then (select jsonb_build_object('text', left(c.body, 400), 'author', a.name, 'author_id', a.id) from public.setup_comments c join public.setup_profiles a on a.id = c.user_id where c.id::text = r.target_id)
        when 'casting' then (select jsonb_build_object('text', c.title || ' — ' || left(c.description, 300), 'author', a.name, 'author_id', a.id) from public.setup_castings c join public.setup_profiles a on a.id = c.user_id where c.id::text = r.target_id)
        when 'community' then (select jsonb_build_object('text', c.name || ' — ' || left(c.description, 300), 'author', a.name, 'author_id', a.id) from public.setup_communities c join public.setup_profiles a on a.id = c.user_id where c.id::text = r.target_id)
        when 'profile' then (select jsonb_build_object('text', a.name || ' — ' || a.headline || ' ' || left(a.bio, 300), 'author', a.name, 'author_id', a.id) from public.setup_profiles a where a.id::text = r.target_id)
      end as target
    from public.setup_reports r join public.setup_profiles rp on rp.id = r.reporter_id
    group by r.target_type, r.target_id) x;
  return out;
end $$;

-- action: 'dismiss' closes the reports; 'remove' also deletes the reported post, comment, casting or community.
-- Profiles are never deleted from here: remove a member in the Supabase dashboard (Authentication > Users).
create or replace function public.setup_mod_resolve(t_type text, t_id text, action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.setup_is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if action not in ('dismiss', 'remove') then raise exception 'Unknown action'; end if;
  if action = 'remove' then
    if t_id !~ '^[0-9]{1,18}$' then raise exception 'This item cannot be removed here'; end if;
    case t_type
      when 'post' then delete from public.setup_posts where id = t_id::bigint;
      when 'comment' then delete from public.setup_comments where id = t_id::bigint;
      when 'casting' then delete from public.setup_castings where id = t_id::bigint;
      when 'community' then delete from public.setup_communities where id = t_id::bigint;
      else raise exception 'This item cannot be removed here';
    end case;
  end if;
  delete from public.setup_reports where target_type = t_type and target_id = t_id;
end $$;

revoke all on function public.setup_is_admin(), public.setup_mod_reports(), public.setup_mod_resolve(text, text, text) from public, anon;
grant execute on function public.setup_is_admin(), public.setup_mod_reports(), public.setup_mod_resolve(text, text, text) to authenticated;

-- Make someone an admin (run once in the SQL editor, with their login email):
-- insert into public.setup_admins(user_id) select id from auth.users where email = 'you@example.com';
