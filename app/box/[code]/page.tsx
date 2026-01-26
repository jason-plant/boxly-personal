"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import QRCode from "qrcode";
import { supabase } from "../../lib/supabaseClient";
import RequireAuth from "../../components/RequireAuth";

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

function pad3(n: number) {
  return String(n).padStart(3, "0");
}
function parseBoxNumber(code: string): number | null {
  const m = /^BOX-(\d{3})$/i.exec(code.trim());
  if (!m) return null;
  const num = Number(m[1]);
  return Number.isFinite(num) ? num : null;
}
function getStoragePathFromPublicUrl(url: string) {
  const marker = "/item-photos/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}

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

  // Modals
  const [newBoxOpen, setNewBoxOpen] = useState(false);
  const [newBoxName, setNewBoxName] = useState("");

  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false);
  const confirmMoveInfoRef = useRef<{
    count: number;
    fromCode: string;
    toId: string;
    toCode: string;
    itemIds: string[];
  } | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteItemRef = useRef<ItemRow | null>(null);

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

      // reset move state
      setMoveMode(false);
      const empty = new Set<string>();
      setSelectedIds(empty);
      selectedRef.current = empty;
      setBulkDestBoxId("");

      // close modals
      setNewBoxOpen(false);
      setConfirmMoveOpen(false);
      setConfirmDeleteOpen(false);
      setNewBoxName("");
      confirmMoveInfoRef.current = null;
      deleteItemRef.current = null;

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

  /* ============= Quantity & Delete ============= */

  async function deleteItemAndPhoto(item: ItemRow) {
    setBusy(true);
    setError(null);

    if (item.photo_url) {
      const path = getStoragePathFromPublicUrl(item.photo_url);
      if (path) {
        await supabase.storage.from("item-photos").remove([path]);
      }
    }

    const delRes = await supabase.from("items").delete().eq("id", item.id);
    if (delRes.error) {
      setError(delRes.error.message);
      setBusy(false);
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== item.id));

    // also remove from selection if selected
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      copy.delete(item.id);
      selectedRef.current = copy;
      return copy;
    });

    setBusy(false);
  }

  async function saveQuantity(itemId: string, qty: number) {
    const safeQty = Math.max(0, Math.floor(qty));
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (safeQty === 0) {
      deleteItemRef.current = item;
      setConfirmDeleteOpen(true);
      return;
    }

    const res = await supabase.from("items").update({ quantity: safeQty }).eq("id", itemId);
    if (res.error) {
      setError(res.error.message);
      return;
    }

    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: safeQty } : i)));
  }

  /* ============= Move Mode ============= */

  const nextAutoCode = useMemo(() => {
    let max = 0;
    for (const b of allBoxes) {
      const n = parseBoxNumber(b.code);
      if (n !== null && n > max) max = n;
    }
    return `BOX-${pad3(max + 1)}`;
  }, [allBoxes]);

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

  async function createNewBoxFromMove(name: string) {
    if (!name.trim()) {
      setError("Box name is required.");
      return null;
    }

    setBusy(true);
    setError(null);

    const insertRes = await supabase
      .from("boxes")
      .insert({
        code: nextAutoCode,
        name: name.trim(),
        location: null,
      })
      .select("id, code")
      .single();

    if (insertRes.error || !insertRes.data) {
      setError(insertRes.error?.message || "Failed to create new box.");
      setBusy(false);
      return null;
    }

    setAllBoxes((prev) => {
      const next = [...prev, { id: insertRes.data.id, code: insertRes.data.code }];
      next.sort((a, b) => a.code.localeCompare(b.code));
      return next;
    });

    setBulkDestBoxId(insertRes.data.id);

    setBusy(false);
    return insertRes.data;
  }

  async function onDestinationChange(value: string) {
    if (value === "__new__") {
      setBulkDestBoxId("");
      setNewBoxName("");
      setNewBoxOpen(true);
      return;
    }
    setBulkDestBoxId(value);
  }

  function requestMoveSelected() {
    if (!box) return;

    const ids = Array.from(selectedRef.current);
    if (ids.length === 0) {
      setError("Select at least one item.");
      return;
    }
    if (!bulkDestBoxId) {
      setError("Choose a destination box.");
      return;
    }

    const dest = allBoxes.find((b) => b.id === bulkDestBoxId);
    const toCode = dest?.code ?? "destination";

    confirmMoveInfoRef.current = {
      count: ids.length,
      fromCode: box.code,
      toId: bulkDestBoxId,
      toCode,
      itemIds: ids,
    };

    setConfirmMoveOpen(true);
  }

  async function confirmMoveSelected() {
    if (!box) return;

    const info = confirmMoveInfoRef.current;
    if (!info) return;

    setBusy(true);
    setError(null);

    const res = await supabase.from("items").update({ box_id: info.toId }).in("id", info.itemIds);

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    setItems((prev) => prev.filter((i) => !selectedRef.current.has(i.id)));

    setConfirmMoveOpen(false);
    confirmMoveInfoRef.current = null;
    exitMoveMode();

    setBusy(false);
  }

  /* ============= QR ============= */

  async function printSingleQrLabel(boxCode: string, name?: string | null, location?: string | null) {
    const url = `${window.location.origin}/box/${encodeURIComponent(boxCode)}`;
    const qr = await QRCode.toDataURL(url, { width: 420, margin: 1 });

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <body style="font-family:Arial;padding:20px">
          <div style="width:320px;border:2px solid #000;padding:14px;border-radius:12px">
            <div style="font-size:22px;font-weight:800">${boxCode}</div>
            ${name ? `<div style="margin-top:6px">${name}</div>` : ""}
            ${location ? `<div style="margin-top:6px">Location: ${location}</div>` : ""}
            <img src="${qr}" style="width:100%;margin-top:10px" />
            <div style="font-size:10px;margin-top:10px;word-break:break-all">${url}</div>
          </div>
          <script>window.onload=()=>window.print()</script>
        </body>
      </html>
    `);
  }

  /* ============= Render ============= */

  const destinationBoxes = box ? allBoxes.filter((b) => b.id !== box.id) : [];

  return (
    <RequireAuth>
      {loading ? (
        <main style={{ padding: 16 }}>
          <p>Loading…</p>
        </main>
      ) : !box ? (
        <main style={{ padding: 16 }}>
          <p>{error ?? "Box not found."}</p>
        </main>
      ) : (
        <main style={{ paddingBottom: 180 }}>
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

              <button onClick={() => printSingleQrLabel(box.code, box.name, box.location)}>Print QR</button>
            </div>

            {error && <p style={{ color: "crimson", marginTop: 10 }}>Error: {error}</p>}
          </div>

          {/* Move Mode panel */}
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
                  <div style={{ opacity: 0.85 }}>Tap item cards to select. Use the sticky bar to move.</div>
                </div>

                <button type="button" onClick={exitMoveMode} disabled={busy}>
                  Done
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button type="button" onClick={selectAll} disabled={items.length === 0 || busy}>
                  Select all
                </button>
                <button type="button" onClick={clearSelected} disabled={selectedIds.size === 0 || busy}>
                  Clear
                </button>
                <div style={{ alignSelf: "center", opacity: 0.85 }}>
                  Selected: <strong>{selectedIds.size}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          <h2 style={{ margin: "14px 0 8px" }}>Items</h2>

          <div style={{ display: "grid", gap: 10 }}>
            {items.map((i) => {
              const hasPhoto = Boolean(i.photo_url);
              const isSelected = selectedIds.has(i.id);

              return (
                <div
                  key={i.id}
                  onClick={() => {
                    if (moveMode) toggleSelected(i.id);
                  }}
                  style={{
                    background: "#fff",
                    border: moveMode ? (isSelected ? "2px solid #16a34a" : "2px solid #e5e7eb") : "1px solid #e5e7eb",
                    borderRadius: 18,
                    padding: 14,
                    boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
                    cursor: moveMode ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {moveMode && (
                      <div
                        aria-hidden
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          border: isSelected ? "2px solid #16a34a" : "2px solid #cbd5e1",
                          background: isSelected ? "#16a34a" : "transparent",
                          flex: "0 0 auto",
                        }}
                      />
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (moveMode) return;
                        if (hasPhoto) setViewItem(i);
                      }}
                      disabled={moveMode || !hasPhoto}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        boxShadow: "none",
                        textAlign: "left",
                        fontWeight: 900,
                        cursor: !moveMode && hasPhoto ? "pointer" : "default",
                        opacity: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      title={!moveMode && hasPhoto ? "Tap to view photo" : undefined}
                    >
                      {i.name}
                      {hasPhoto ? <span style={{ opacity: 0.6 }}>📷</span> : null}
                    </button>
                  </div>

                  {i.description && <div style={{ marginTop: 8, opacity: 0.9 }}>{i.description}</div>}

                  {/* Quantity controls */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveQuantity(i.id, (i.quantity ?? 0) - 1);
                      }}
                      disabled={busy || moveMode}
                    >
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
                      onBlur={(e) => {
                        if (moveMode) return;
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) saveQuantity(i.id, n);
                      }}
                      style={{ width: 110 }}
                      disabled={busy || moveMode}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveQuantity(i.id, (i.quantity ?? 0) + 1);
                      }}
                      disabled={busy || moveMode}
                    >
                      +
                    </button>
                  </div>

                  {moveMode && (
                    <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
                      Tap card to {isSelected ? "unselect" : "select"}.
                    </div>
                  )}
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
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </a>

          {/* Floating Move FAB */}
          <button
            type="button"
            onClick={() => (moveMode ? exitMoveMode() : enterMoveMode())}
            aria-label="Move items"
            style={{
              position: "fixed",
              right: 18,
              bottom: 86,
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
            disabled={busy}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={moveMode ? "white" : "#111"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6.5" width="7" height="7" rx="1.5" />
              <rect x="14" y="10.5" width="7" height="7" rx="1.5" />
              <path d="M7 5.5c2.5-2 6.5-2 9 0" />
              <path d="M16 5.5h-3" />
              <path d="M17 5.5v3" />
              <path d="M17 18.5c-2.5 2-6.5 2-9 0" />
              <path d="M7 18.5h3" />
              <path d="M7 18.5v-3" />
            </svg>
          </button>

          {/* Sticky Move Action Bar */}
          {moveMode && (
            <div
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "12px 14px calc(env(safe-area-inset-bottom) + 12px)",
                background: "#ffffff",
                borderTop: "1px solid #e5e7eb",
                boxShadow: "0 -10px 30px rgba(0,0,0,0.15)",
                zIndex: 3500,
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 900 }}>Selected: {selectedIds.size}</div>

              <div style={{ flex: 1, minWidth: 160 }}>
                <select value={bulkDestBoxId} onChange={(e) => onDestinationChange(e.target.value)} disabled={busy} style={{ width: "100%" }}>
                  <option value="">Destination…</option>
                  <option value="__new__">{`➕ Create new box (${nextAutoCode})…`}</option>
                  {destinationBoxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={requestMoveSelected}
                disabled={busy || selectedIds.size === 0 || !bulkDestBoxId}
                style={{
                  background: "#111",
                  color: "#fff",
                  fontWeight: 900,
                  padding: "10px 16px",
                  borderRadius: 14,
                }}
              >
                {busy ? "Moving…" : "Move"}
              </button>
            </div>
          )}

          {/* Full screen photo viewer */}
          {!moveMode && viewItem && viewItem.photo_url && (
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
              <img src={viewItem.photo_url} alt={viewItem.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 16 }} />
            </div>
          )}

          {/* Create new box modal */}
          <Modal
            open={newBoxOpen}
            title={`Create new box (${nextAutoCode})`}
            onClose={() => {
              if (busy) return;
              setNewBoxOpen(false);
              setNewBoxName("");
            }}
          >
            <p style={{ marginTop: 0, opacity: 0.85 }}>Enter a name. Code is auto-assigned.</p>

            <input placeholder="Box name" value={newBoxName} onChange={(e) => setNewBoxName(e.target.value)} autoFocus />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  setNewBoxOpen(false);
                  setNewBoxName("");
                }}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
                  const created = await createNewBoxFromMove(newBoxName);
                  if (created) {
                    setNewBoxOpen(false);
                    setNewBoxName("");
                  }
                }}
                disabled={busy || !newBoxName.trim()}
                style={{ background: "#111", color: "#fff" }}
              >
                {busy ? "Creating..." : "Create box"}
              </button>
            </div>
          </Modal>

          {/* Confirm move modal */}
          <Modal
            open={confirmMoveOpen}
            title="Confirm move"
            onClose={() => {
              if (busy) return;
              setConfirmMoveOpen(false);
              confirmMoveInfoRef.current = null;
            }}
          >
            {(() => {
              const info = confirmMoveInfoRef.current;
              if (!info) return <p>Missing move info.</p>;

              return (
                <>
                  <p style={{ marginTop: 0 }}>
                    Move <strong>{info.count}</strong> item(s) from <strong>{info.fromCode}</strong> to{" "}
                    <strong>{info.toCode}</strong>?
                  </p>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (busy) return;
                        setConfirmMoveOpen(false);
                        confirmMoveInfoRef.current = null;
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </button>

                    <button type="button" onClick={confirmMoveSelected} disabled={busy} style={{ background: "#111", color: "#fff" }}>
                      {busy ? "Moving..." : "Yes, move"}
                    </button>
                  </div>
                </>
              );
            })()}
          </Modal>

          {/* Confirm delete modal */}
          <Modal
            open={confirmDeleteOpen}
            title="Delete item?"
            onClose={() => {
              if (busy) return;
              setConfirmDeleteOpen(false);
              deleteItemRef.current = null;
            }}
          >
            <p style={{ marginTop: 0 }}>
              Quantity is 0. Delete <strong>{deleteItemRef.current?.name ?? "this item"}</strong> (and remove photo)?
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  setConfirmDeleteOpen(false);
                  deleteItemRef.current = null;
                  if (box) reloadItems(box.id);
                }}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
                  const item = deleteItemRef.current;
                  if (!item) return;
                  setConfirmDeleteOpen(false);
                  deleteItemRef.current = null;
                  await deleteItemAndPhoto(item);
                }}
                disabled={busy}
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {busy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </Modal>
        </main>
      )}
    </RequireAuth>
  );
}

/* ================= MODAL COMPONENT ================= */

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 4000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 18,
          border: "1px solid #e5e7eb",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>

          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              width: 40,
              height: 40,
              padding: 0,
              lineHeight: "40px",
              textAlign: "center",
              fontWeight: 900,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}
