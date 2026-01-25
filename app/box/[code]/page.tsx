"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/* ================= HELPERS ================= */

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function parseBoxNumber(code: string): number | null {
  const m = /^BOX-(\d{3})$/i.exec(code.trim());
  if (!m) return null;
  return Number(m[1]);
}

function getStoragePathFromPublicUrl(url: string) {
  const marker = "/item-photos/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}

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

  /* ===== UI STATE ===== */

  const [viewItem, setViewItem] = useState<ItemRow | null>(null);
  const [moveMode, setMoveMode] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedRef = useRef<Set<string>>(new Set());
  const [bulkDestBoxId, setBulkDestBoxId] = useState("");

  /* ===== MODALS ===== */

  const [newBoxOpen, setNewBoxOpen] = useState(false);
  const [newBoxName, setNewBoxName] = useState("");

  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false);
  const confirmMoveRef = useRef<{ count: number; toId: string; toCode: string } | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteItemRef = useRef<ItemRow | null>(null);

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

      if (!boxRes.data) {
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
      setAllBoxes(boxesRes.data ?? []);

      setMoveMode(false);
      setSelectedIds(new Set());
      selectedRef.current = new Set();
      setBulkDestBoxId("");

      setLoading(false);
    }

    load();
  }, [code]);

  /* ================= QUANTITY ================= */

  async function saveQuantity(itemId: string, qty: number) {
    const safe = Math.max(0, Math.floor(qty));
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (safe === 0) {
      deleteItemRef.current = item;
      setConfirmDeleteOpen(true);
      return;
    }

    await supabase.from("items").update({ quantity: safe }).eq("id", itemId);

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: safe } : i))
    );
  }

  async function deleteItemAndPhoto(item: ItemRow) {
    setBusy(true);

    if (item.photo_url) {
      const path = getStoragePathFromPublicUrl(item.photo_url);
      if (path) {
        await supabase.storage.from("item-photos").remove([path]);
      }
    }

    await supabase.from("items").delete().eq("id", item.id);

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setBusy(false);
  }

  /* ================= MOVE MODE ================= */

  const nextAutoCode = useMemo(() => {
    let max = 0;
    for (const b of allBoxes) {
      const n = parseBoxNumber(b.code);
      if (n && n > max) max = n;
    }
    return `BOX-${pad3(max + 1)}`;
  }, [allBoxes]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      selectedRef.current = next;
      return next;
    });
  }

  function enterMoveMode() {
    setMoveMode(true);
    setSelectedIds(new Set());
    selectedRef.current = new Set();
    setBulkDestBoxId("");
  }

  function exitMoveMode() {
    setMoveMode(false);
    setSelectedIds(new Set());
    selectedRef.current = new Set();
    setBulkDestBoxId("");
  }

  async function createNewBox() {
    if (!newBoxName.trim()) return;

    setBusy(true);

    const res = await supabase
      .from("boxes")
      .insert({ code: nextAutoCode, name: newBoxName.trim() })
      .select("id, code")
      .single();

    if (res.data) {
      setAllBoxes((prev) => [...prev, res.data]);
      setBulkDestBoxId(res.data.id);
    }

    setBusy(false);
  }

  function requestMoveSelected() {
    if (!bulkDestBoxId || selectedIds.size === 0) return;

    const dest = allBoxes.find((b) => b.id === bulkDestBoxId);

    confirmMoveRef.current = {
      count: selectedIds.size,
      toId: bulkDestBoxId,
      toCode: dest?.code ?? "",
    };

    setConfirmMoveOpen(true);
  }

  async function confirmMove() {
    if (!confirmMoveRef.current) return;

    setBusy(true);

    await supabase
      .from("items")
      .update({ box_id: confirmMoveRef.current.toId })
      .in("id", Array.from(selectedRef.current));

    setItems((prev) => prev.filter((i) => !selectedRef.current.has(i.id)));

    setConfirmMoveOpen(false);
    exitMoveMode();
    setBusy(false);
  }

  /* ================= QR ================= */

  async function printQr() {
    if (!box) return;
    const url = `${window.location.origin}/box/${encodeURIComponent(box.code)}`;
    const qr = await QRCode.toDataURL(url, { width: 420 });

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html><body>
        <h2>${box.code}</h2>
        <img src="${qr}" />
        <script>window.print()</script>
      </body></html>
    `);
  }

  /* ================= RENDER ================= */

  if (loading) return <p>Loading…</p>;
  if (!box) return <p>Box not found.</p>;

  const destinationBoxes = allBoxes.filter((b) => b.id !== box.id);

  return (
    <main style={{ paddingBottom: 180 }}>
      {/* HEADER */}
      <div style={{ background: "#fff", padding: 14, borderRadius: 18 }}>
        <h1>{box.code}</h1>
        {box.name && <strong>{box.name}</strong>}
        <button onClick={printQr}>Print QR</button>
      </div>

      {/* ITEMS */}
      <h2>Items</h2>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((i) => {
          const selected = selectedIds.has(i.id);
          return (
            <div
              key={i.id}
              onClick={() => moveMode && toggleSelected(i.id)}
              style={{
                background: "#fff",
                padding: 14,
                borderRadius: 18,
                border: moveMode
                  ? selected
                    ? "2px solid #16a34a"
                    : "2px solid #e5e7eb"
                  : "1px solid #e5e7eb",
              }}
            >
              <strong
                onClick={(e) => {
                  e.stopPropagation();
                  if (!moveMode && i.photo_url) setViewItem(i);
                }}
              >
                {i.name}
              </strong>

              {i.description && <div>{i.description}</div>}

              <div style={{ marginTop: 10 }}>
                <button onClick={() => saveQuantity(i.id, (i.quantity ?? 0) - 1)} disabled={moveMode}>
                  −
                </button>
                <input
                  type="number"
                  value={i.quantity ?? 0}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.id === i.id ? { ...x, quantity: Number(e.target.value) } : x
                      )
                    )
                  }
                  disabled={moveMode}
                />
                <button onClick={() => saveQuantity(i.id, (i.quantity ?? 0) + 1)} disabled={moveMode}>
                  +
                </button>
                <button onClick={() => saveQuantity(i.id, i.quantity ?? 0)} disabled={moveMode}>
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FLOATING MOVE BUTTON */}
      <button
        onClick={() => (moveMode ? exitMoveMode() : enterMoveMode())}
        style={{
          position: "fixed",
          right: 18,
          bottom: 86,
          width: 58,
          height: 58,
          borderRadius: "50%",
        }}
      >
        🔄
      </button>

      {/* STICKY MOVE BAR */}
      {moveMode && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "12px 14px calc(env(safe-area-inset-bottom) + 12px)",
            background: "#fff",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            gap: 10,
          }}
        >
          <strong>Selected: {selectedIds.size}</strong>

          <select
            value={bulkDestBoxId}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setNewBoxOpen(true);
                return;
              }
              setBulkDestBoxId(e.target.value);
            }}
          >
            <option value="">Destination…</option>
            <option value="__new__">➕ Create new box ({nextAutoCode})</option>
            {destinationBoxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
              </option>
            ))}
          </select>

          <button onClick={requestMoveSelected}>Move</button>
        </div>
      )}

      {/* MODALS */}
      <Modal open={newBoxOpen} title={`Create ${nextAutoCode}`} onClose={() => setNewBoxOpen(false)}>
        <input value={newBoxName} onChange={(e) => setNewBoxName(e.target.value)} />
        <button onClick={createNewBox}>Create</button>
      </Modal>

      <Modal open={confirmMoveOpen} title="Confirm move" onClose={() => setConfirmMoveOpen(false)}>
        <p>
          Move {confirmMoveRef.current?.count} items to{" "}
          {confirmMoveRef.current?.toCode}?
        </p>
        <button onClick={confirmMove}>Yes</button>
      </Modal>

      <Modal open={confirmDeleteOpen} title="Delete item?" onClose={() => setConfirmDeleteOpen(false)}>
        <p>Delete {deleteItemRef.current?.name}?</p>
        <button
          onClick={() => {
            if (deleteItemRef.current) deleteItemAndPhoto(deleteItemRef.current);
            setConfirmDeleteOpen(false);
          }}
        >
          Delete
        </button>
      </Modal>

      {/* PHOTO VIEWER */}
      {viewItem && (
        <div
          onClick={() => setViewItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img src={viewItem.photo_url!} style={{ maxWidth: "100%", maxHeight: "100%" }} />
        </div>
      )}
    </main>
  );
}

/* ================= MODAL ================= */

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
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        padding: 12,
        zIndex: 5000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 14,
          width: "100%",
          maxWidth: 520,
        }}
      >
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
