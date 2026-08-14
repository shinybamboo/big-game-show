"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

// TEMPORARY — hard-coded for this realtime proof-of-concept only.
const SHOW_ID = "a6df39a6-6552-4288-85e6-0406e85aff18";

type LiveRow = {
  live_state: Record<string, unknown> | null;
  state_version: number;
};

export default function DisplayPage() {
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [stateVersion, setStateVersion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function applyRow(row: LiveRow) {
      if (cancelled) return;
      const liveState = row.live_state;
      setTestMessage(typeof liveState?.test_message === "string" ? liveState.test_message : null);
      setStateVersion(row.state_version);
    }

    async function loadInitial() {
      const { data, error } = await supabase
        .from("live_show_state")
        .select("live_state, state_version")
        .eq("show_id", SHOW_ID)
        .single();

      if (!error && data) {
        applyRow(data);
      }
    }

    loadInitial();

    const channel = supabase
      .channel(`live_show_state:${SHOW_ID}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_show_state",
          filter: `show_id=eq.${SHOW_ID}`,
        },
        (payload) => {
          applyRow(payload.new as LiveRow);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>/display (realtime POC)</h1>
      <p>show_id: {SHOW_ID}</p>
      <p>test_message: {testMessage ?? "(none)"}</p>
      <p>state_version: {stateVersion ?? "(loading)"}</p>
    </main>
  );
}
