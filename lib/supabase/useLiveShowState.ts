"use client";

import { useEffect, useState } from "react";
import { supabase } from "./client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LiveShowStateRow = {
  show_id: string;
  current_game: string | null;
  current_item: string | null;
  phase: string;
  is_paused: boolean;
  state_version: number;
  live_state: Record<string, unknown>;
};

export type LiveShowStateStatus = "invalid_id" | "loading" | "not_found" | "ready";

// Shared by /control/[showId] and /display/[showId]: validates the show ID,
// loads the current live_show_state row, and keeps it in sync via Supabase
// Realtime. Re-subscribes cleanly whenever showId changes or the component
// remounts.
export function useLiveShowState(showId: string | undefined) {
  const isValid = !!showId && UUID_RE.test(showId);

  const [trackedShowId, setTrackedShowId] = useState(showId);
  const [status, setStatus] = useState<LiveShowStateStatus>(isValid ? "loading" : "invalid_id");
  const [row, setRow] = useState<LiveShowStateRow | null>(null);

  // Reset immediately (during render) when showId changes, since Next.js
  // reuses this component instance across sibling dynamic routes rather than
  // remounting it — an effect alone would leave stale data on screen until
  // the new fetch resolves.
  if (showId !== trackedShowId) {
    setTrackedShowId(showId);
    setStatus(isValid ? "loading" : "invalid_id");
    setRow(null);
  }

  useEffect(() => {
    if (!showId || !isValid) {
      return;
    }

    let cancelled = false;

    async function loadInitial() {
      const { data, error } = await supabase
        .from("live_show_state")
        .select("show_id, current_game, current_item, phase, is_paused, state_version, live_state")
        .eq("show_id", showId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setStatus("not_found");
        return;
      }

      setRow(data as LiveShowStateRow);
      setStatus("ready");
    }

    loadInitial();

    const channel = supabase
      .channel(`live_show_state:${showId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_show_state",
          filter: `show_id=eq.${showId}`,
        },
        (payload) => {
          if (cancelled) return;
          setRow(payload.new as LiveShowStateRow);
          setStatus("ready");
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [showId, isValid]);

  return { status, row };
}
