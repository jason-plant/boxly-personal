"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "../../../lib/supabaseClient";

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
};

type BoxMini = {
  id: string;
  code: string;
};

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  quantity: number | null;
};

export default function BoxPage() {
  const params = useParams<{ code?: string }>();
  const code = params?.code ? decodeURIComponent(String(params.code)) : "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [box, setBox] = useState<BoxRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [allBoxes, setAllBoxes] = useState<BoxMini[]>([]);

  // Photo viewer
  const [viewItem, setViewItem] = useState<ItemRow | null>(null);

  // Move mode
  const [moveMode, setMoveMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedRef = useRef<Set<string>>(new Set());
  const [bulkDestBoxId, setBulkDestBoxId] = useState("");

  useEffect(() => {
    if (!code) return;

    async function load() {
      setLoading(true);
      setError(null);

      const boxRes = await supabase
        .from("boxes")
        .select("id, code, name, location")
        .eq("code", code)
        .maybeSingle();

      if (!boxRes.data || boxRes.error) {
        setError("Box not found");
        setLoading(false);
        return;
      }

      setBox(boxRes.data);

      const itemsRes = await supabase
        .from("items")
        .select("id, name, description, photo_url, quantity")
        .eq("box_id", boxRes.data.id)
        .order("name");

      setItems(itemsRes.data ?? []);

      const boxesRes = await supabase.from("boxes").select("id, code").order("code");
      setAllBoxes((boxesRes.data ?? []) as BoxMini[]);

      // reset move mode state when loading a box
      setMoveMode(false);
      const empty = new Set<string>();
      setSelectedIds(empty);
      selectedRef.current = empty;
      setBulkDestBoxId("");

      setLoading(false);
    }

    load();
  }, [code]);

  async function reloadItems(boxId: string) {
    const { data } = await supabase
      .from("items")
      .select("id, name, description, photo_url, quantity")
      .eq("box_id", boxId)
      .order("name");

    setItems(data ?? []);
  }

  function getStoragePathFromPublicUrl(url: string) {
    const marker = "/item-photos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  }

  async function deleteItemAndPhoto(item: ItemRow) {
    if (item.photo_url) {
      const path = getStoragePathFromPublicUrl(item.photo_url);
      if (path) {
        await supabase.storage.from("item-photos").remove([path]);
      }
    }

    await supabase.from("items").delete().eq("id", item.id);

    setItems((prev) => prev.filter((i) => i.id !== item.id));

    // also remove from selection if in move mode
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      copy.delete(item.id);
      selectedRef.current = copy;
      return copy;
    });
  }

  async function saveQuantity(itemId: string, qty: number) {
    const safeQty = Math.max(0, Math.floor(qty));
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (safeQty === 0) {
      const ok = window.confirm(`Quantity is 0.\n\nDelete "${item.name}" from this box?`);
      if (ok) {
        await deleteItemAndPhoto(item);
      } else if (box) {
        await reloadItems(box.id);
      }
      return;
    }

    await supabase.from("items").update({ quantity: safeQty }).eq("id", itemId);

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: safeQty } : i))
    );
  }

  /* ========= MOVE MODE HELPERS ========= */

  function enterMoveMode() {
    setMoveMode(true);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setBulkDestBoxId("");
  }

  function exitMoveMode() {
    setMoveMode(false);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setBulkDestBoxId("");
  }

  function toggleSelected(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      selectedRef.current = next;
      return next;
    });
  }

  function selectAll() {
    const all = new Set(items.map((i) => i.id));
    setSelectedIds(all);
    selectedRef.current = all;
  }

  function clearSelected() {
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
  }

  async function moveSelected() {
    if (!box) return;

    const ids = Array.from(selectedRef.current);
    if (ids.length === 0) {
      alert("Select at least one item.");
      return;
    }
    if (!bulkDestBoxId) {
      alert("Choose a destination box.");
      return;
    }

    const dest = allBoxes.find((b) => b.id === bulkDestBoxId);
    const ok = window.confirm(
      `Move ${ids.length} item(s) from ${box.code} to ${dest?.code ?? "destination"}?`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);

    const res = await supabase.from("items").update({ box_id: bulkDestBoxId }).in("id", ids);
    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    // remove moved items from this box list
    setItems((prev) => prev.filter((i) => !selectedRef.current.has(i.id)));

    // leave move mode
    exitMoveMode();
    setBusy(false);
  }

  async function printSingleQrLabel(boxCode: string, name?: string | null, location?: string | null) {
    const url = `${window.location.origin}/box/${encodeURIComponent(boxCode)}`;
    const qr = await QRCode.toDataURL(url, { width: 420 });

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <body style="font-family:Arial;padding:20px">
          <div style="width:320px;border:2px solid #000;padding:14px;border-radius:12px">
            <div style="font-size:22px;font-weight:800">${boxCode}</div>
            ${name ? `<div>${name}</div>` : ""}
            ${location ? `<div>Location: ${location}</div>` : ""}
            <img src="${qr}" style="width:100%" />
            <div style="font-size:10px">${url}</div>
          </div>
          <script>window.onload=()=>window.print()</script>
        </body>
      </html>
    `);
  }

  if (loading) return <p>Loading…</p>;
  if (!box) return <p>Box not found.</p>;

  const destinationBoxes = allBoxes.filter((b) => b.id !== box.id);

  return (
    <main style={{ paddingBottom: 110 }}>
      {/* Header */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0" }}>{box.code}</h1>
            {box.name && <div style={{ fontWeight: 800 }}>{box.name}</div>}
            {box.location && <div style={{ opacity: 0.8 }}>Location: {box.location}</div>}
          </div>

          <button onClick={() => printSingleQrLabel(box.code, box.name, box.location)}>
            Print QR
          </button>
        </div>

        {error && <p style={{ color: "crimson", marginTop: 10 }}>Error: {error}</p>}
      </div>

      {/* Move Mode Panel (only when active) */}
      {moveMode && (
        <div
          style={{
            marginTop: 12,
            background: "#fff",
            border: "2px solid #111",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Move items</h2>
              <div style={{ opacity: 0.85 }}>Select items, choose a destination box, then move.</div>
            </div>

            <button type="button" onClick={exitMoveMode}>
              Done
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" onClick={selectAll} disabled={items.length === 0}>
              Select all
            </button>
            <button type="button" onClick={clearSelected} disabled={selectedIds.size === 0}>
              Clear
            </button>
            <div style={{ alignSelf: "center", opacity: 0.85 }}>
              Selected: <strong>{selectedIds.size}</strong>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <select value={bulkDestBoxId} onChange={(e) => setBulkDestBoxId(e.target.value)}>
              <option value="">Select destination box…</option>
              {destinationBoxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={moveSelected}
              disabled={busy || selectedIds.size === 0 || !bulkDestBoxId}
              style={{ background: "#111", color: "#fff" }}
            >
              {busy ? "Moving..." : "Move selected"}
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      <h2 style={{ margin: "14px 0 8px" }}>Items</h2>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((i) => {
          const hasPhoto = Boolean(i.photo_url);

          return (
            <div
              key={i.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 14,
                boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Checkbox only visible in move mode */}
                {moveMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(i.id)}
                    onChange={() => toggleSelected(i.id)}
                    style={{ transform: "scale(1.25)" }}
                  />
                )}

                {/* Name tap opens photo (if exists). In move mode, name still works. */}
                <button
                  type="button"
                  onClick={() => {
                    if (hasPhoto) setViewItem(i);
                  }}
                  disabled={!hasPhoto}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    boxShadow: "none",
                    textAlign: "left",
                    fontWeight: 900,
                    cursor: hasPhoto ? "pointer" : "default",
                    opacity: hasPhoto ? 1 : 0.9,
                  }}
                  title={hasPhoto ? "Tap to view photo" : "No photo yet"}
                >
                  {i.name}
                  {hasPhoto ? <span style={{ marginLeft: 8, opacity: 0.6 }}>📷</span> : null}
                </button>
              </div>

              {i.description && <div style={{ marginTop: 8, opacity: 0.9 }}>{i.description}</div>}

              {/* Quantity */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button type="button" onClick={() => saveQuantity(i.id, (i.quantity ?? 0) - 1)}>
                  −
                </button>

                <input
                  type="number"
                  min={0}
                  value={i.quantity ?? 0}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setItems((prev) => prev.map((it) => (it.id === i.id ? { ...it, quantity: n } : it)));
                  }}
                  style={{ width: 110 }}
                />

                <button type="button" onClick={() => saveQuantity(i.id, (i.quantity ?? 0) + 1)}>
                  +
                </button>

                <button type="button" onClick={() => saveQuantity(i.id, i.quantity ?? 0)}>
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Add Item FAB */}
      <a
        href={`/box/${encodeURIComponent(box.code)}/new-item`}
        aria-label="Add item"
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

      {/* Floating Move FAB (swap icon) */}
      <button
        type="button"
        onClick={() => (moveMode ? exitMoveMode() : enterMoveMode())}
        aria-label="Move items"
        style={{
          position: "fixed",
          right: 18,
          bottom: 86, // sits above the + button
          width: 58,
          height: 58,
          borderRadius: 999,
          background: moveMode ? "#16a34a" : "#ffffff",
          border: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 14px 30px rgba(0,0,0,0.20)",
          zIndex: 2000,
          cursor: "pointer",
        }}
        title={moveMode ? "Exit move mode" : "Move items"}
      >
        {/* Two boxes with circular arrow */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={moveMode ? "white" : "#111"}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* boxes */}
          <rect x="3" y="6.5" width="7" height="7" rx="1.5" />
          <rect x="14" y="10.5" width="7" height="7" rx="1.5" />
          {/* circular arrows */}
          <path d="M7 5.5c2.5-2 6.5-2 9 0" />
          <path d="M16 5.5h-3" />
          <path d="M17 5.5v3" />

          <path d="M17 18.5c-2.5 2-6.5 2-9 0" />
          <path d="M7 18.5h3" />
          <path d="M7 18.5v-3" />
        </svg>
      </button>

      {/* Full screen photo viewer */}
      {viewItem && viewItem.photo_url && (
        <div
          onClick={() => setViewItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
            padding: 12,
          }}
        >
          <img
            src={viewItem.photo_url}
            alt={viewItem.name}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 16 }}
          />
        </div>
      )}
    </main>
  );
}
