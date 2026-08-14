"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function CreateShowPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tableCount, setTableCount] = useState("4");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function validate(): string | null {
    if (name.trim().length === 0) return "Show name is required.";

    const count = Number(tableCount);
    if (!Number.isInteger(count) || count <= 0) {
      return "Number of tables must be a positive whole number.";
    }

    return null;
  }

  async function handleCreate() {
    const validationError = validate();
    if (validationError) {
      setStatus("error");
      setErrorMessage(validationError);
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    const { data, error } = await supabase.rpc("create_show", {
      p_name: name.trim(),
      p_table_count: Number(tableCount),
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.id) {
      setStatus("error");
      setErrorMessage("Show was created but no ID was returned.");
      return;
    }

    router.push(`/control/${row.id}`);
  }

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>/control — Create Show</h1>

      <div style={{ marginBottom: 8 }}>
        <label>
          Show Name{" "}
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Number of Tables{" "}
          <input
            type="number"
            min={1}
            value={tableCount}
            onChange={(event) => setTableCount(event.target.value)}
          />
        </label>
      </div>

      <button onClick={handleCreate} disabled={status === "loading"}>
        CREATE SHOW
      </button>

      {status === "loading" && <p>Creating show...</p>}
      {status === "error" && <p>Error: {errorMessage}</p>}
    </main>
  );
}
