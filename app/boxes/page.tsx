"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
};

export default function BoxesPage() {
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New box form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");

  async function loadBoxes() {
    setLoading(true);
    setError(null);

    const res = await supabase
      .from("boxes")
      .select("id, code, name, location")
      .order("code", { ascending: true });

    if (res.error) {
      setError(res.error.message);
      setBoxes([]);
    } else {
      setBoxes((res.data ?? []) as BoxRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadBoxes();
  }, []);

  async function createBox() {
    const code = newCode.trim();
    if (!code) {
      setError("Box code is required (e.g. BX-0001).");
      return;
    }

    setBusy(true);
    setError(null);

    const insertRes = await supabase.from("boxes").insert([
      {
        code,
        name: newName.trim() || null,
        location: newLocation.trim() || null,
      },
    ]);

    if (insertRes.error) {
      setError(insertRes.error.message);
      setBusy(false);
      return;
    }

    setNewCode("");
    setNewName("");
    setNewLocation("");

    await loadBoxes();
    setBusy(false);
  }

  return (
    <main style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Boxes</h1>

      {/* Create new box */}
      <div
        style={{
          border: "1px solid #333",
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Create a new box</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Box code (required) e.g. BX-0001"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
          />

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Box name (optional) e.g. Kitchen cables"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
          />

          <input
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Location (optional) e.g. Loft left shelf"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
          />

          <button
            type="button"
            onClick={createBox}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {busy ? "Creating..." : "Create box"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {loading && <p>Loading boxes…</p>}

      {!loading && boxes.length === 0 && <p>No boxes yet.</p>}

      <ul style={{ paddingLeft: 0, listStyle: "none" }}>
        {boxes.map((b) => (
          <li
            key={b.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <a
              href={`/box/${encodeURIComponent(b.code)}`}
              style={{
                textDecoration: "none",
                color: "#000",
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              {b.code}
            </a>

            {b.name && <div style={{ marginTop: 4 }}>{b.name}</div>}
            {b.location && (
              <div style={{ marginTop: 2, opacity: 0.8 }}>{b.location}</div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
