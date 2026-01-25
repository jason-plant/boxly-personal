"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
};

type ItemRow = {
  id: string;
  photo_url: string | null;
};

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function parseBoxNumber(code: string): number | null {
  // expects BOX-001, BOX-010 etc
  const m = /^BOX-(\d{3})$/i.exec(code.trim());
  if (!m) return null;
  const num = Number(m[1]);
  return Number.isFinite(num) ? num : null;
}

function getStoragePathFromPublicUrl(url: string) {
  // https://xxxx.supabase.co/storage/v1/object/public/item-photos/FILENAME.jpg
  const marker = "/item-photos/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}

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

  const nextAutoCode = useMemo(() => {
    // find max BOX-### and +1
    let max = 0;
    for (const b of boxes) {
      const n = parseBoxNumber(b.code);
      if (n !== null && n > max) max = n;
    }
    return `BOX-${pad3(max + 1)}`;
  }, [boxes]);

  async function createBox() {
    const code = newCode.trim();

    if (!code) {
      setError("Box code is required (e.g. BOX-001).");
      return;
    }

    // basic format check
    if (parseBoxNumber(code) === null) {
      setError('Box code must look like "BOX-001".');
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

  async function deleteBox(boxToDelete: BoxRow) {
    const ok = window.confirm(
      `Delete box ${boxToDelete.code}?\n\nThis will also delete ALL items in this box and remove their photos.`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);

    // 1) Get items in box (we only need ids + photo_url)
    const itemsRes = await supabase
      .from("items")
      .select("id, photo_url")
      .eq("box_id", boxToDelete.id);

    if (itemsRes.error) {
      setError(itemsRes.error.message);
      setBusy(false);
      return;
    }

    const items = (itemsRes.data ?? []) as ItemRow[];

    // 2) Remove photos from storage (best-effort)
    const paths: string[] = [];
    for (const it of items) {
      if (!it.photo_url) continue;
      const path = getStoragePathFromPublicUrl(it.photo_url);
      if (path) paths.push(path);
    }

    if (paths.length > 0) {
      const storageRes = await supabase.storage
        .from("item-photos")
        .remove(paths);

      // If storage delete fails, we still continue (otherwise you can never delete)
      if (storageRes.error) {
        // show warning but continue
        setError(`Warning: some photos could not be deleted: ${storageRes.error.message}`);
      }
    }

    // 3) Delete items in the box
    const delItemsRes = await supabase
      .from("items")
      .delete()
      .eq("box_id", boxToDelete.id);

    if (delItemsRes.error) {
      setError(delItemsRes.error.message);
      setBusy(false);
      return;
    }

    // 4) Delete the box
    const delBoxRes = await supabase
      .from("boxes")
      .delete()
      .eq("id", boxToDelete.id);

    if (delBoxRes.error) {
      setError(delBoxRes.error.message);
      setBusy(false);
      return;
    }

    // 5) Update UI
    setBoxes((prev) => prev.filter((b) => b.id !== boxToDelete.id));
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder='Box code (e.g. BOX-001)'
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #444",
                flex: 1,
                minWidth: 220,
              }}
            />

            <button
              type="button"
              onClick={() => setNewCode(nextAutoCode)}
              disabled={busy || loading}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #444",
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
              title="Fill the next available BOX-### code"
            >
              Auto-generate ({nextAutoCode})
            </button>
          </div>

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
            {busy ? "Working..." : "Create box"}
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
            </div>

            <button
              type="button"
              onClick={() => deleteBox(b)}
              disabled={busy}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #c00",
                color: "#c00",
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
              title="Delete box (and all items inside)"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
