"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useLiveShowState } from "@/lib/supabase/useLiveShowState";

export default function ControlShowPage() {
  const params = useParams<{ showId: string }>();
  const showId = params.showId;
  const { status, row } = useLiveShowState(showId);

  const [input, setInput] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleSetMessage() {
    setSendStatus("loading");
    setSendError(null);

    const { error } = await supabase.rpc("poc_set_live_state_test_message", {
      p_show_id: showId,
      p_message: input,
    });

    if (error) {
      setSendStatus("error");
      setSendError(error.message);
      return;
    }

    setSendStatus("success");
  }

  if (status === "invalid_id") {
    return (
      <main style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>/control/{showId}</h1>
        <p>Invalid show ID.</p>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>/control/{showId}</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (status === "not_found") {
    return (
      <main style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>/control/{showId}</h1>
        <p>Show not found</p>
      </main>
    );
  }

  const testMessage =
    typeof row?.live_state?.test_message === "string" ? row.live_state.test_message : null;

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>/control/{showId}</h1>
      <p>
        Display URL:{" "}
        <Link href={`/display/${showId}`} target="_blank">
          /display/{showId}
        </Link>
      </p>
      <p>Current test_message: {testMessage ?? "(none)"}</p>
      <p>state_version: {row?.state_version}</p>

      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Enter test message"
        style={{ marginRight: 8 }}
      />
      <button onClick={handleSetMessage} disabled={sendStatus === "loading"}>
        SET MESSAGE
      </button>

      {sendStatus === "success" && <p>Success.</p>}
      {sendStatus === "error" && <p>Error: {sendError}</p>}
    </main>
  );
}
