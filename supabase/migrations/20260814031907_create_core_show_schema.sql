-- Big Game Show minimum database foundation.
-- shows -> teams, live_show_state
--
-- Schema only: no auth, no RLS policies, no realtime publication, no game
-- content, no application/game logic beyond generic structure + integrity.

create extension if not exists pgcrypto;

-- Shared trigger function to keep updated_at current on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- shows: one Big Game Show event/session.
-- ---------------------------------------------------------------------------
create table public.shows (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  game_code varchar(12) not null
    check (game_code ~ '^[A-Z0-9]{4,12}$'),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'live', 'completed')),
  table_count integer not null check (table_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shows_game_code_unique unique (game_code)
);

comment on table public.shows is 'One Big Game Show event/session.';
comment on column public.shows.game_code is 'Short unique join/game code, must be stored uppercase (digits pass through unchanged). No code-generation logic yet; values are supplied by the application.';
comment on column public.shows.table_count is 'Number of tables/teams available for this show.';

create trigger shows_set_updated_at
  before update on public.shows
  for each row
  execute function public.set_updated_at();

alter table public.shows enable row level security;

-- ---------------------------------------------------------------------------
-- teams: one table/team participating in a specific show.
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  table_number integer not null check (table_number > 0),
  team_name text not null
    check (char_length(trim(team_name)) > 0 and char_length(team_name) <= 20),
  total_score integer not null default 0,
  controller_token uuid not null default gen_random_uuid(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_show_table_unique unique (show_id, table_number),
  constraint teams_controller_token_unique unique (controller_token)
);

comment on table public.teams is 'One table/team participating in a specific show. Table numbers are unique within a show only; different shows may reuse the same table numbers.';
comment on column public.teams.controller_token is 'Opaque secret used to securely associate a team''s phone session (/play) with this team, without a full auth system. Must be treated as a credential once issued.';
comment on column public.teams.joined_at is 'Set when a phone session actually claims/joins this team; null until then. Distinct from created_at, which is when the host created the team row.';

create trigger teams_set_updated_at
  before update on public.teams
  for each row
  execute function public.set_updated_at();

alter table public.teams enable row level security;

-- ---------------------------------------------------------------------------
-- live_show_state: authoritative current state of a live show, followed by
-- /control, /display, and /play. show_id is the primary key, which
-- guarantees at most one state row per show. Deliberately generic — no
-- reference to any specific game/games table yet.
-- ---------------------------------------------------------------------------
create table public.live_show_state (
  show_id uuid primary key references public.shows(id) on delete cascade,
  current_game text,
  current_item text,
  phase text not null default 'idle',
  is_paused boolean not null default false,
  state_version bigint not null default 0,
  live_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.live_show_state is 'Authoritative live state of a show. One row per show, enforced by show_id being the primary key. Intended to be subscribed to via Supabase Realtime by /control, /display, and /play.';
comment on column public.live_show_state.current_game is 'Generic identifier/slug for the active game. Not tied to any specific game implementation or table.';
comment on column public.live_show_state.current_item is 'Generic identifier for the current question/item within the active game.';
comment on column public.live_show_state.phase is 'Generic current phase/state label; meaning is defined by whichever game is active.';
comment on column public.live_show_state.state_version is 'Monotonically increasing counter, bumped on every update, so realtime clients can detect and order state changes.';
comment on column public.live_show_state.live_state is 'Additional temporary, game-specific live state that does not warrant a dedicated column.';

create or replace function public.bump_live_show_state_version()
returns trigger
language plpgsql
as $$
begin
  new.state_version = old.state_version + 1;
  new.updated_at = now();
  return new;
end;
$$;

create trigger live_show_state_bump_version
  before update on public.live_show_state
  for each row
  execute function public.bump_live_show_state_version();

alter table public.live_show_state enable row level security;

-- ---------------------------------------------------------------------------
-- Row Level Security: secure-by-default.
--
-- No policies are created by this migration. With RLS enabled and zero
-- policies, the anon and authenticated API roles have NO read or write
-- access to any of these three tables. Only the service_role key
-- (server-side only, never shipped to the browser) can bypass RLS.
--
-- Host (/control), display (/display), and team (/play) access policies will
-- be designed and added in a later migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Realtime (documentation only — nothing below is executed by this
-- migration):
--
-- To later allow Supabase Realtime "Postgres Changes" subscriptions on
-- live_show_state from /control, /display, and /play, once an access model
-- exists this will additionally need:
--   1. A SELECT policy scoping which role/rows may be read (postgres_changes
--      subscriptions are filtered by RLS).
--   2. Adding the table to the realtime publication:
--        alter publication supabase_realtime add table public.live_show_state;
--      and optionally:
--        alter table public.live_show_state replica identity full;
--      if old row values are needed in change payloads.
--
-- Neither step is performed here, to avoid opening access before an auth /
-- authorization model exists.
-- ---------------------------------------------------------------------------
