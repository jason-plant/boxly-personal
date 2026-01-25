"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "../../../lib/supabaseClient";

/* ================= TYPES ================= */

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

/* ================= PAGE ================= */

export default function BoxPage() {
  const params = useParams<{ code?: string }>();
  const code = params?.code ? decodeURIComponent(String(params.code)) : "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [box, setBox] = useState<BoxRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [allBoxes, setAllBoxes] = useState<BoxMini[]>([]);

  /* Bulk move */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDestBoxId, setBulkDestBoxId] = useState("");
  const selectedRef = useRef<Set<string>>(new Set());

  /* Fullscreen photo viewer */
  const [viewItem, setViewItem] = useState<ItemRow | null>(null);

  /* ================= LOAD ================= */

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

      const boxesRes = await supabase
        .from("boxes")
        .select("id, code")
        .order("code");

      setAllBoxes((boxesRes.data ?? []) as BoxMini[]);

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

  /* ================= DELETE HELPERS ================= */

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
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      copy.delete(item.id);
      selectedRef.current = copy;
      return copy;
    });
  }

  /* ================= QUANTITY ================= */

  async function saveQuantity(itemId: string, qty: number) {
    const safeQty = Math.max(0, Math.floor(qty));
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (safeQty === 0) {
      const ok = window.confirm(
        `Quantity is 0.\n\nDelete "${item.name}" from this box?`
      );
      if (ok) {
        await deleteItemAndPhoto(item);
      } else if (box) {
        await reloadItems(box.id);
      }
      return;
    }

    await supabase
      .from("items")
      .update({ quantity: safeQty })
      .eq("id", itemId);

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, quantity: safeQty } : i
      )
    );
  }

  /* ================= BULK MOVE ================= */

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
    if (!ids.length || !bulkDestBoxId) return;

    const dest = allBoxes.find((b) => b.id === bulkDestBoxId);
    const ok = window.confirm(
      `Move ${ids.length} item(s) from ${box.code} to ${dest?.code}?`
    );
    if (!ok) return;

    setBusy(true);

    await supabase
      .from("items")
      .update({ box_id: bulkDestBoxId })
      .in("id", ids);

    setItems((prev) =>
      prev.filter((i) => !selectedRef.current.has(i.id))
    );

    clearSelected();
    setBulkDestBoxId("");
    setBusy(false);
  }

  /* ================= PRINT QR ================= */

  async function printSingleQrLabel(
    boxCode: string,
    name?: string | null,
    location?: string | null
  ) {
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

  /* ================= RENDER ================= */

  if (loading) return <p>Loading…</p>;
  if (!box) return <p>Box not found.</p>;

  const destinationBoxes = allBoxes.filter((b) => b.id !== box.id);

  return (
    <main style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>{box.code}</h1>
            {box.name && <div><strong>{box.name}</strong></div>}
            {box.location && <div>Location: {box.location}</div>}
          </div>

          <button onClick={() => printSingleQrLabel(box.code, box.name, box.location)}>
            Print QR
          </button>
        </div>

        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </div>

      {/* Bulk move */}
      <div className="card" style={{ marginTop: 12 }}>
        <h2>Move selected</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={selectAll}>Select all</button>
          <button onClick={clearSelected}>Clear</button>
        </div>

        <select
          value={bulkDestBoxId}
          onChange={(e) => setBulkDestBoxId(e.target.value)}
        >
          <option value="">Select destination box…</option>
          {destinationBoxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code}
            </option>
          ))}
        </select>

        <button
          onClick={moveSelected}
          disabled={!selectedIds.size || !bulkDestBoxId || busy}
          style={{ marginTop: 10 }}
        >
          Move selected
        </button>
      </div>

      {/* Items */}
      <h2 style={{ marginTop: 16 }}>Items</h2>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((i) => (
          <div key={i.id} className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="checkbox"
                checked={selectedIds.has(i.id)}
                onChange={() => toggleSelected(i.id)}
              />

              <button
                onClick={() => i.photo_url && setViewItem(i)}
                disabled={!i.photo_url}
                style={{
                  background: "none",
                  border: "none",
                  fontWeight: 900,
                  textAlign: "left",
                }}
              >
                {i.name}
                {i.photo_url && <span style={{ marginLeft: 6 }}>📷</span>}
              </button>
            </div>

            {i.description && <div>{i.description}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => saveQuantity(i.id, (i.quantity ?? 0) - 1)}>−</button>

              <input
                type="number"
                min={0}
                value={i.quantity ?? 0}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === i.id
                        ? { ...it, quantity: Number(e.target.value) }
                        : it
                    )
                  )
                }
                style={{ width: 90 }}
              />

              <button onClick={() => saveQuantity(i.id, (i.quantity ?? 0) + 1)}>+</button>

              <button onClick={() => saveQuantity(i.id, i.quantity ?? 0)}>
                Save
              </button>
            </div>
          </div>
        ))}
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

      {/* Fullscreen photo viewer */}
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
          }}
        >
          <img
            src={viewItem.photo_url}
            alt={viewItem.name}
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 16 }}
          />
        </div>
      )}
    </main>
  );
}
