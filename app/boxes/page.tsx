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

  async function deleteBox(boxToDelete: BoxRow) {
    const ok = window.confirm(
      `Delete box ${boxToDelete.code}?\n\nThis will delete ALL items in this box and remove linked photos.`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);

    // Get items in the box (for photo cleanup)
    const itemsRes = await supabase
      .from("items")
      .select("id, photo_url")
      .eq("box_id", boxToDelete.id);

    if (itemsRes.error) {
      setError(itemsRes.error.message);
      setBusy(false);
      return;
    }

    const items = (itemsRes.data ?? []) as { id: string; photo_url: string | null }[];

    // Best-effort photo delete
    const paths: string[] = [];
    for (const it of items) {
      if (!it.photo_url) continue;
      const marker = "/item-photos/";
      const idx = it.photo_url.indexOf(marker);
      if (idx !== -1) paths.push(it.photo_url.substring(idx + marker.length));
    }
    if (paths.length) {
      await supabase.storage.from("item-photos").remove(paths);
    }

    // Delete items
    const delItemsRes = await supabase
      .from("items")
      .delete()
      .eq("box_id", boxToDelete.id);

    if (delItemsRes.error) {
      setError(delItemsRes.error.message);
      setBusy(false);
      return;
    }

    // Delete box
    const delBoxRes = await supabase
      .from("boxes")
      .delete()
      .eq("id", boxToDelete.id);

    if (delBoxRes.error) {
      setError(delBoxRes.error.message);
      setBusy(false);
      return;
    }

    setBoxes((prev) => prev.filter((b) => b.id !== boxToDelete.id));
    setBusy(false);
  }

  return (
    <main style={{ paddingBottom: 90 }}>
      <h1 style={{ marginTop: 6 }}>Boxes</h1>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {loading && <p>Loading boxes…</p>}

      {!loading && boxes.length === 0 && <p>No boxes yet.</p>}

      <div style={{ display: "grid", gap: 10 }}>
        {boxes.map((b) => (
          <div
            key={b.id}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 14,
              boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <a
                href={`/box/${encodeURIComponent(b.code)}`}
                style={{
                  textDecoration: "none",
                  color: "#111",
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                {b.code}
              </a>
              {b.name && <div style={{ marginTop: 4, fontWeight: 700 }}>{b.name}</div>}
              {b.location && <div style={{ marginTop: 2, opacity: 0.8 }}>{b.location}</div>}
            </div>

            <button
              type="button"
              onClick={() => deleteBox(b)}
              disabled={busy}
              style={{
                border: "1px solid #ef4444",
                color: "#ef4444",
                background: "#fff",
                fontWeight: 900,
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Floating + bubble */}
      <a
  href="/boxes/new"
  aria-label="Create new box"
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
