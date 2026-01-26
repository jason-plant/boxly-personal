"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";
import RequireAuth from "../components/RequireAuth";

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
};

export default function LabelsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const origin = useMemo(() => {
    return typeof window !== "undefined" ? window.location.origin : "";
  }, []);

  useEffect(() => {
    async function loadBoxes() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("boxes")
        .select("id, code, name, location")
        .order("code", { ascending: true });

      if (error) {
        setError(error.message);
        setBoxes([]);
      } else {
        setBoxes((data ?? []) as BoxRow[]);
      }

      setLoading(false);
    }

    loadBoxes();
  }, []);

  useEffect(() => {
    async function makeQrs() {
      if (!origin) return;
      if (boxes.length === 0) return;

      const next: Record<string, string> = {};

      for (const b of boxes) {
        const url = `${origin}/box/${encodeURIComponent(b.code)}`;
        const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
        next[b.code] = dataUrl;
      }

      setQrMap(next);
    }

    makeQrs();
  }, [boxes, origin]);

  return (
    <RequireAuth>
      <main style={{ paddingBottom: 90 }}>
        <div
          className="no-print"
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
            marginTop: 6,
            marginBottom: 14,
          }}
        >
          <h1 style={{ margin: 0 }}>QR Labels</h1>

          <p style={{ marginTop: 8, marginBottom: 6, opacity: 0.9 }}>
            Print this page. Each label opens the box page when scanned.
          </p>

          <p style={{ marginTop: 0, opacity: 0.75 }}>
            Tip: In print settings, enable “Background graphics” for cleaner QR edges (optional).
          </p>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: "#111",
              color: "#fff",
              fontWeight: 900,
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #111",
              cursor: "pointer",
            }}
          >
            Print
          </button>
        </div>

        {loading && <p>Loading boxes…</p>}
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

        {!loading && !error && boxes.length === 0 && <p>No boxes found.</p>}

        {/* Print-friendly rules */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            a { text-decoration: none !important; color: #000 !important; }
          }
        `}</style>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 18,
          }}
        >
          {boxes.map((b) => (
            <div
              key={b.id}
              style={{
                background: "#fff",
                border: "1px solid #000", // keep bold for printing
                padding: 14,
                borderRadius: 12,
                breakInside: "avoid",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900 }}>{b.code}</div>
              {b.name && <div style={{ fontSize: 12, marginTop: 4 }}>{b.name}</div>}
              {b.location && (
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{b.location}</div>
              )}

              <div style={{ marginTop: 10 }}>
                {qrMap[b.code] ? (
                  <img
                    src={qrMap[b.code]}
                    alt={`QR for ${b.code}`}
                    style={{ width: "100%", maxWidth: 240, display: "block" }}
                  />
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Generating QR…</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </RequireAuth>
  );
}
