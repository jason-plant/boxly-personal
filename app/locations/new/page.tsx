"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function NewLocationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createLocation() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Location name is required.");
      return;
    }

    setBusy(true);
    setErr(null);

    const res = await supabase
      .from("locations")
      .insert({ name: trimmed })
      .select("id")
      .single();

    if (res.error) {
      setErr(res.error.message);
      setBusy(false);
      return;
    }

    router.push("/locations");
    router.refresh();
  }

  return (
    <main style={{ paddingBottom: 90 }}>
      <h1 style={{ margin: "6px 0 6px" }}>Add Location</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Example: Shed, Loft, Storage Container
      </p>

      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
          display: "grid",
          gap: 10,
          maxWidth: 520,
        }}
      >
        <input
          placeholder="Location name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => router.push("/locations")} disabled={busy}>
            Cancel
          </button>

          <button
            type="button"
            onClick={createLocation}
            disabled={busy || !name.trim()}
            style={{ background: "#111", color: "#fff" }}
          >
            {busy ? "Saving..." : "Save location"}
          </button>
        </div>
      </div>
    </main>
  );
}
