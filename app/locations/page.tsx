"use client";

import RequireAuth from "../components/RequireAuth";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
};

export default function LocationsPage() {
  return (
    <RequireAuth>
      <LocationsInner />
    </RequireAuth>
  );
}

function LocationsInner() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("locations")
        .select("id,name")
        .order("name");

      if (error) {
        setError(error.message);
        setLocations([]);
      } else {
        setLocations((data ?? []) as LocationRow[]);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Locations</h1>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && locations.length === 0 && <p>No locations yet.</p>}

      <div style={{ display: "grid", gap: 10 }}>
        {locations.map((l) => (
          <a
            key={l.id}
            href={`/locations/${l.id}`}
            className="tap-btn"
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 14,
              textDecoration: "none",
              color: "#111",
              boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
              fontWeight: 900,
            }}
          >
            {l.name}
          </a>
        ))}
      </div>
    </main>
  );
}
