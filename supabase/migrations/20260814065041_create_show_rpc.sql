-- APPLIED — run successfully via the Supabase SQL Editor and verified
-- end-to-end via the anon client (RPC call, generated UUID + game code,
-- matching live_show_state row created, direct anon writes still blocked).
--
-- Minimum reusable show-creation RPC (development/POC mechanism).
-- Lets an unauthenticated host create a new show + its live_show_state row
-- without opening INSERT access on shows/teams/live_show_state directly.
-- shows and teams remain fully locked (RLS enabled, zero grants/policies),
-- exactly as the original core schema migration left them. This is the only
-- object created by this migration.

create or replace function public.create_show(
  p_name text,
  p_table_count integer
)
returns table (id uuid, game_code varchar(12))
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Uppercase letters and digits, with visually ambiguous characters
  -- removed: no I, O, 0, or 1.
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code_length int := 6;
  v_candidate_code text;
  v_new_id uuid;
  v_attempt int := 0;
  v_max_attempts int := 10;
begin
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > v_max_attempts then
      raise exception 'Could not generate a unique game code after % attempts', v_max_attempts;
    end if;

    v_candidate_code := '';
    for i in 1..v_code_length loop
      v_candidate_code := v_candidate_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;

    begin
      insert into public.shows (name, game_code, table_count)
      values (p_name, v_candidate_code, p_table_count)
      returning public.shows.id into v_new_id;

      exit;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  insert into public.live_show_state (show_id)
  values (v_new_id);

  return query
    select v_new_id, v_candidate_code::varchar(12);
end;
$$;

revoke execute on function public.create_show(text, integer) from public;
grant execute on function public.create_show(text, integer) to anon;
