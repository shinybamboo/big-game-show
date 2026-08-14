"use client";

import { useParams } from "next/navigation";
import { useLiveShowState } from "@/lib/supabase/useLiveShowState";

export default function DisplayShowPage() {
  const params = useParams<{ showId: string }>();
  const showId = params.showId;
  const { status, row } = useLiveShowState(showId);

  if (status === "invalid_id") {
    return (
      <main style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>/display/{showId}</h1>
        <p>Invalid show ID.</p>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>/display/{showId}</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (status === "not_found") {
    return (
      <main style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>/display/{showId}</h1>
        <p>Show not found</p>
      </main>
    );
  }

  const testMessage =
    typeof row?.live_state?.test_message === "string" ? row.live_state.test_message : null;

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>/display/{showId}</h1>
      <p>test_message: {testMessage ?? "(none)"}</p>
      <p>state_version: {row?.state_version}</p>
    </main>
  );
}
