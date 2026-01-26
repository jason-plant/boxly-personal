"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
};

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
};

export default function LocationPage() {
  const params = useParams<{ id?: string }>();
  const locationId = params?.id ? decodeURIComponent(String(params.id)) : "";

  const [location, setLocation] = useState<LocationRow | null>(null);
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      setLoading(true);
      setError(null);

      const locRes = await supabase
        .from("locations")
        .select("id, name")
        .eq("id", locationId)
        .maybeSingle();

      if (!locRes.data || locRes.error) {
        setError("Location not found");
        setLoading(false);
        return;
      }

      setLocation(locRes.data as LocationRow);

      const boxRes = await supabase
        .from("boxes")
        .select("id, code, name")
        .eq("location_id", locationId)
        .order("code");

      if (boxRes.error) {
        setError(boxRes.error.message);
        setBoxes([]);
      } else {
        setBoxes((boxRes.data ?? []) as BoxRow[]);
      }

      setLoading(false);
    }

    load();
  }, [locationId]);

  if (loading) return <main style={{ padding: 16 }}><p>Loading…</p></main>;
  if (error) return <main style={{ padding: 16 }}><p style={{ color: "crimson" }}>{error}</p></main>;
  if (!location) return <main style={{ padding: 16 }}><p>Location not found.</p></main>;

  return (
    <main style={{ paddingBottom: 90 }}>
      <h1 style={{ margin: "6px 0 6px" }}>{location.name}</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>Boxes in this location</p>

      {boxes.length === 0 && <p style={{ marginTop: 16 }}>No boxes here yet.</p>}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {boxes.map((b) => (
          <a
            key={b.id}
            href={`/box/${encodeURIComponent(b.code)}`}
            className="card"
            style={{
              padding: 14,
              display: "block",
              color: "#111",
              textDecoration: "none",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>{b.code}</div>
            {b.name && <div style={{ marginTop: 6, opacity: 0.85 }}>{b.name}</div>}
          </a>
        ))}
      </div>

      {/* FAB: Add box in this location */}
      <a
        href={`/locations/${encodeURIComponent(location.id)}/new-box`}
        aria-label="Add box"
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          width: 58,
          height: 58,
          borderRadius: 999,
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
          zIndex: 2000,
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </a>
    </main>
  );
}
