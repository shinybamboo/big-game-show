-- APPLIED — every statement below (policy, grant, publication, function)
-- has been run successfully via the Supabase SQL Editor and verified
-- end-to-end at the database level (RPC write, state_version increment,
-- direct writes still blocked).
--
-- Realtime proof-of-concept support for live_show_state:
--   /control -> Supabase -> Realtime -> /display
--
-- Adds ONLY what /control and /display need to prove the pipeline. Does not
-- touch shows or teams, and does not add any INSERT/UPDATE/DELETE policy to
-- live_show_state. Write access is granted narrowly through a single
-- SECURITY DEFINER function rather than a table-level policy, so RLS on the
-- table stays fully locked for writes exactly as the prior migration left it.

-- ---------------------------------------------------------------------------
-- 1. Read access for /display (and required for Realtime — see note below).
--
-- live_show_state holds no secrets (no controller_token, no PII), and
-- broadcasting the live state publicly is inherent to what /display is for.
-- Supabase Realtime "Postgres Changes" subscriptions are filtered by the
-- SAME RLS SELECT policy as a normal query for the connecting role, so this
-- policy is required for the auto-update requirement, not just for a
-- one-off read.
-- ---------------------------------------------------------------------------
create policy live_show_state_select_anon
  on public.live_show_state
  for select
  to anon
  using (true);

-- RLS policies only filter rows within an operation a role can already
-- perform; they do not grant the operation itself. Without this, anon still
-- gets a role-level "permission denied" before RLS is evaluated. Scoped to
-- SELECT only — INSERT/UPDATE/DELETE remain ungranted, so direct writes stay
-- blocked and the RPC in section 3 remains the only write path.
grant select on public.live_show_state to anon;

-- ---------------------------------------------------------------------------
-- 2. Enable Realtime on live_show_state.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.live_show_state;

-- ---------------------------------------------------------------------------
-- 3. Narrow write path for /control.
--
-- Rather than adding an UPDATE policy (which would let any anon caller
-- rewrite arbitrary columns on any row), this function can ONLY set the
-- "test_message" key inside live_state for a given show. It runs as
-- SECURITY DEFINER so it can perform the update despite no UPDATE policy
-- existing, but the surface it exposes to anon is limited to exactly this
-- one operation.
--
-- This is a temporary proof-of-concept helper. It should be dropped once
-- real host-authenticated write logic replaces it.
-- ---------------------------------------------------------------------------
create or replace function public.poc_set_live_state_test_message(
  p_show_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.live_show_state
  set live_state = jsonb_set(live_state, '{test_message}', to_jsonb(p_message), true)
  where show_id = p_show_id;
end;
$$;

revoke execute on function public.poc_set_live_state_test_message(uuid, text) from public;
grant execute on function public.poc_set_live_state_test_message(uuid, text) to anon;
