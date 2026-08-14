"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

// TEMPORARY — hard-coded for this realtime proof-of-concept only.
const SHOW_ID = "a6df39a6-6552-4288-85e6-0406e85aff18";

export default function ControlPage() {
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentMessage() {
      const { data, error } = await supabase
        .from("live_show_state")
        .select("live_state")
        .eq("show_id", SHOW_ID)
        .single();

      if (cancelled || error || !data) return;

      const liveState = data.live_state as Record<string, unknown> | null;
      setCurrentMessage(typeof liveState?.test_message === "string" ? liveState.test_message : null);
    }

    loadCurrentMessage();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSetMessage() {
    setStatus("loading");
    setErrorMessage(null);

    const { error } = await supabase.rpc("poc_set_live_state_test_message", {
      p_show_id: SHOW_ID,
      p_message: input,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("success");
    setCurrentMessage(input);
  }

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>/control (realtime POC)</h1>
      <p>show_id: {SHOW_ID}</p>
      <p>Current test_message: {currentMessage ?? "(none)"}</p>

      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Enter test message"
        style={{ marginRight: 8 }}
      />
      <button onClick={handleSetMessage} disabled={status === "loading"}>
        SET MESSAGE
      </button>

      {status === "success" && <p>Success.</p>}
      {status === "error" && <p>Error: {errorMessage}</p>}
    </main>
  );
}
