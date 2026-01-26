"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import RequireAuth from "../components/RequireAuth";

type LocationRow = {
  id: string;
  name: string;
};

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location_id: string | null;
  location_name?: string | null;
  items?: { quantity: number | null }[]; // for qty sum
};

export default function BoxesPage() {
  return (
    <RequireAuth>
      <BoxesInner />
    </RequireAuth>
  );
}

function BoxesInner() {
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const boxToDeleteRef = useRef<BoxRow | null>(null);

  // Move mode
  const [moveMode, setMoveMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedRef = useRef<Set<string>>(new Set());
  const [destLocationId, setDestLocationId] = useState<string>("");

  // Confirm move modal
  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false);
  const confirmMoveInfoRef = useRef<{
    count: number;
    toLocationId: string | null;
    toLocationName: string;
    boxIds: string[];
  } | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);

    // Load locations
    const locRes = await supabase.from("locations").select("id,name").order("name");
    if (locRes.error) {
      setError(locRes.error.message);
      setLocations([]);
    } else {
      setLocations((locRes.data ?? []) as LocationRow[]);
    }

    // Load boxes + item qty + location join
    const boxRes = await supabase
      .from("boxes")
      .select(
        `
        id,
        code,
        name,
        location_id,
        items ( quantity ),
        locations:locations ( name )
      `
      )
      .order("code", { ascending: true });

    if (boxRes.error) {
      setError(boxRes.error.message);
      setBoxes([]);
    } else {
      const mapped = ((boxRes.data ?? []) as any[]).map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name ?? null,
        location_id: b.location_id ?? null,
        items: b.items ?? [],
        location_name: b.locations?.name ?? null,
      })) as BoxRow[];

      setBoxes(mapped);
    }

    // reset move state
    setMoveMode(false);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setDestLocationId("");
    setConfirmMoveOpen(false);
    confirmMoveInfoRef.current = null;

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function requestDeleteBox(b: BoxRow) {
    boxToDeleteRef.current = b;
    setConfirmDeleteOpen(true);
  }

  function getStoragePathFromPublicUrl(url: string) {
    const marker = "/item-photos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  }

  async function confirmDeleteBox() {
    const boxToDelete = boxToDeleteRef.current;
    if (!boxToDelete) return;

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
      const path = getStoragePathFromPublicUrl(it.photo_url);
      if (path) paths.push(path);
    }
    if (paths.length) {
      await supabase.storage.from("item-photos").remove(paths);
    }

    // Delete items
    const delItemsRes = await supabase.from("items").delete().eq("box_id", boxToDelete.id);
    if (delItemsRes.error) {
      setError(delItemsRes.error.message);
      setBusy(false);
      return;
    }

    // Delete box
    const delBoxRes = await supabase.from("boxes").delete().eq("id", boxToDelete.id);
    if (delBoxRes.error) {
      setError(delBoxRes.error.message);
      setBusy(false);
      return;
    }

    setBoxes((prev) => prev.filter((x) => x.id !== boxToDelete.id));
    setConfirmDeleteOpen(false);
    boxToDeleteRef.current = null;
    setBusy(false);
  }

  // ===== Move Mode =====

  function enterMoveMode() {
    setMoveMode(true);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setDestLocationId("");
    setError(null);
  }

  function exitMoveMode() {
    setMoveMode(false);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setDestLocationId("");
    setError(null);
  }

  function toggleSelected(boxId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(boxId) ? next.delete(boxId) : next.add(boxId);
      selectedRef.current = next;
      return next;
    });
  }

  function selectAll() {
    const all = new Set(boxes.map((b) => b.id));
    setSelectedIds(all);
    selectedRef.current = all;
  }

  function clearSelected() {
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
  }

  const destName = useMemo(() => {
    if (destLocationId === "__none__") return "No location";
    const l = locations.find((x) => x.id === destLocationId);
    return l?.name ?? "Destination";
  }, [destLocationId, locations]);

  function requestMoveSelected() {
    const ids = Array.from(selectedRef.current);
    if (ids.length === 0) {
      setError("Select at least one box.");
      return;
    }
    if (!destLocationId) {
      setError("Choose a destination location.");
      return;
    }

    confirmMoveInfoRef.current = {
      count: ids.length,
      toLocationId: destLocationId === "__none__" ? null : destLocationId,
      toLocationName: destName,
      boxIds: ids,
    };

    setConfirmMoveOpen(true);
  }

  async function confirmMoveSelected() {
    const info = confirmMoveInfoRef.current;
    if (!info) return;

    setBusy(true);
    setError(null);

    const res = await supabase
      .from("boxes")
      .update({ location_id: info.toLocationId })
      .in("id", info.boxIds);

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    // refresh list (so location names update properly)
    await loadAll();

    setConfirmMoveOpen(false);
    confirmMoveInfoRef.current = null;
    setBusy(false);
  }

  return (
    <main style={{ paddingBottom: moveMode ? 180 : 90 }}>
      <h1 style={{ marginTop: 6 }}>Boxes</h1>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {loading && <p>Loading boxes…</p>}
      {!loading && boxes.length === 0 && <p>No boxes yet.</p>}

      {/* Move Mode helper panel */}
      {moveMode && (
        <div
          style={{
            background: "#fff",
            border: "2px solid #111",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
            marginBottom: 12,
            marginTop: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Move boxes</h2>
              <div style={{ opacity: 0.85 }}>Tap box cards to select. Use the sticky bar to move.</div>
            </div>

            <button type="button" onClick={exitMoveMode} disabled={busy}>
              Done
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" onClick={selectAll} disabled={busy || boxes.length === 0}>
              Select all
            </button>
            <button type="button" onClick={clearSelected} disabled={busy || selectedIds.size === 0}>
              Clear
            </button>
            <div style={{ alignSelf: "center", opacity: 0.85 }}>
              Selected: <strong>{selectedIds.size}</strong>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {boxes.map((b) => {
          const totalQty = b.items?.reduce((sum, it) => sum + (it.quantity ?? 0), 0) ?? 0;
          const isSelected = selectedIds.has(b.id);

          return (
            <a
              key={b.id}
              href={moveMode ? "#" : `/box/${encodeURIComponent(b.code)}`}
              onClick={(e) => {
                if (!moveMode) return;
                e.preventDefault();
                toggleSelected(b.id);
              }}
              style={{
                background: "#fff",
                border: moveMode
                  ? isSelected
                    ? "2px solid #16a34a"
                    : "2px solid #e5e7eb"
                  : "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 14,
                boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                textDecoration: "none",
                color: "#111",
                cursor: moveMode ? "pointer" : "default",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{b.code}</div>

                {b.name && <div style={{ fontWeight: 700 }}>{b.name}</div>}
                <div style={{ opacity: 0.8 }}>
                  {b.location_name ? b.location_name : "No location"}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    fontSize: 13,
                    background: "#ecfdf5",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                    width: "fit-content",
                  }}
                >
                  {totalQty} item{totalQty === 1 ? "" : "s"}
                </div>
              </div>

              {!moveMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    requestDeleteBox(b);
                  }}
                  disabled={busy}
                  style={{
                    border: "1px solid rgba(239,68,68,0.45)",
                    color: "#b91c1c",
                    background: "#fff",
                    fontWeight: 900,
                    borderRadius: 16,
                    padding: "10px 14px",
                  }}
                >
                  Delete
                </button>
              )}
            </a>
          );
        })}
      </div>

      {/* FAB: Create new box (existing) */}
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
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </a>

      {/* ✅ NEW: Move Boxes FAB */}
      <button
        type="button"
        onClick={() => (moveMode ? exitMoveMode() : enterMoveMode())}
        aria-label="Move boxes"
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
        title={moveMode ? "Exit move mode" : "Move boxes"}
        disabled={busy}
      >
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

      {/* Sticky Move Bar */}
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

          <div style={{ flex: 1, minWidth: 170 }}>
            <select
              value={destLocationId}
              onChange={(e) => setDestLocationId(e.target.value)}
              disabled={busy}
              style={{ width: "100%" }}
            >
              <option value="">Destination location…</option>
              <option value="__none__">No location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={requestMoveSelected}
            disabled={busy || selectedIds.size === 0 || !destLocationId}
            style={{
              background: "#111",
              color: "#fff",
              fontWeight: 900,
              padding: "10px 16px",
              borderRadius: 14,
            }}
          >
            Move
          </button>
        </div>
      )}

      {/* Confirm Move Modal */}
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
                Move <strong>{info.count}</strong> box(es) to <strong>{info.toLocationName}</strong>?
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

                <button
                  type="button"
                  onClick={confirmMoveSelected}
                  disabled={busy}
                  style={{ background: "#111", color: "#fff" }}
                >
                  {busy ? "Moving..." : "Yes, move"}
                </button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* Delete box modal */}
      <Modal
        open={confirmDeleteOpen}
        title="Delete box?"
        onClose={() => {
          if (busy) return;
          setConfirmDeleteOpen(false);
          boxToDeleteRef.current = null;
        }}
      >
        <p style={{ marginTop: 0 }}>
          Delete <strong>{boxToDeleteRef.current?.code ?? "this box"}</strong>?
        </p>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          This will delete all items inside it and remove linked photos.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setConfirmDeleteOpen(false);
              boxToDeleteRef.current = null;
            }}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={confirmDeleteBox}
            disabled={busy}
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </main>
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
