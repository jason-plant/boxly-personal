"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      const res = await supabase.from("locations").select("id, name").order("name");

      if (res.error) {
        setErr(res.error.message);
        setLocations([]);
      } else {
        setLocations((res.data ?? []) as LocationRow[]);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto", paddingBottom: 90 }}>
      <h1 style={{ marginTop: 6 }}>Locations</h1>

      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
      {loading && <p>Loading…</p>}
      {!loading && locations.length === 0 && <p>No locations yet.</p>}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {locations.map((l) => (
          <a
            key={l.id}
            href={`/locations/${encodeURIComponent(l.id)}`}
            className="card"
            style={{
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 900,
            }}
          >
            <span>{l.name}</span>
            <span style={{ opacity: 0.7 }}>View →</span>
          </a>
        ))}
      </div>
    </main>
  );
}
