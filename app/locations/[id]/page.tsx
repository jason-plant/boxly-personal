"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import RequireAuth from "../../components/RequireAuth";
import EditIconButton from "../../components/EditIconButton";
import DeleteIconButton from "../../components/DeleteIconButton";
import Modal from "../../components/Modal";
import { getInventoryOwnerIdForUser } from "../../lib/inventoryScope";

type LocationRow = {
  id: string;
  name: string;
};

type LocationMini = {
  id: string;
  name: string;
};

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  items?: { quantity: number | null }[];
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
};

export default function LocationPage() {
  return (
    <RequireAuth>
      <LocationInner />
    </RequireAuth>
  );
}

function LocationInner() {
  const params = useParams<{ id?: string }>();
  const locationId = params?.id ? decodeURIComponent(String(params.id)) : "";

  const [location, setLocation] = useState<LocationRow | null>(null);
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [allLocations, setAllLocations] = useState<LocationMini[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ===== Move mode =====
  const [moveMode, setMoveMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedRef = useRef<Set<string>>(new Set());
  const [destLocationId, setDestLocationId] = useState<string>("");

  const [hideBoxCode, setHideBoxCode] = useState<boolean>(false);

  // Create location modal (from move flow)
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");

  // Confirm move modal
  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false);
  const confirmMoveInfoRef = useRef<{
    count: number;
    toLocationId: string | null;
    toLocationName: string;
    boxIds: string[];
  } | null>(null);

  // ===== Edit box =====
  const [editBoxOpen, setEditBoxOpen] = useState(false);
  const editBoxRef = useRef<BoxRow | null>(null);
  const [editBoxName, setEditBoxName] = useState("");

  // ===== Delete box =====
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const boxToDeleteRef = useRef<BoxRow | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readSetting = () => setHideBoxCode(localStorage.getItem("hideBoxCode") === "1");
    readSetting();
    window.addEventListener("storage", readSetting);
    return () => window.removeEventListener("storage", readSetting);
  }, []);

  function getStoragePathFromPublicUrl(url: string) {
    const marker = "/item-photos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  }

  async function load() {
    if (!locationId) return;

    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      setLoading(false);
      return;
    }

    const ownerId = await getInventoryOwnerIdForUser(userId);

    const locRes = await supabase
      .from("locations")
      .select("id, name")
      .eq("id", locationId)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (!locRes.data || locRes.error) {
      setError("Location not found");
      setLoading(false);
      return;
    }

    setLocation(locRes.data as LocationRow);

    const allLocRes = await supabase
      .from("locations")
      .select("id, name")
      .eq("owner_id", ownerId)
      .order("name");

    setAllLocations((allLocRes.data ?? []) as LocationMini[]);

    const boxRes = await supabase
      .from("boxes")
      .select("id, code, name, items ( quantity )")
      .eq("location_id", locationId)
      .eq("owner_id", ownerId)
      .order("code");

    if (boxRes.error) {
      setError(boxRes.error.message);
      setBoxes([]);
    } else {
      setBoxes((boxRes.data ?? []) as BoxRow[]);
    }

    // Reset UI states
    setMoveMode(false);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setDestLocationId("");

    setNewLocOpen(false);
    setNewLocName("");

    setConfirmMoveOpen(false);
    confirmMoveInfoRef.current = null;

    setEditBoxOpen(false);
    editBoxRef.current = null;
    setEditBoxName("");

    setConfirmDeleteOpen(false);
    boxToDeleteRef.current = null;

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  // ===== Move mode helpers =====
  function enterMoveMode() {
    setError(null);
    setMoveMode(true);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setDestLocationId("");
  }

  function exitMoveMode() {
    setError(null);
    setMoveMode(false);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setDestLocationId("");

    setNewLocOpen(false);
    setNewLocName("");
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
    const l = allLocations.find((x) => x.id === destLocationId);
    return l?.name ?? "Destination";
  }, [destLocationId, allLocations]);

  function onDestinationChange(value: string) {
    if (value === "__new_location__") {
      setDestLocationId("");
      setNewLocName("");
      setNewLocOpen(true);
      return;
    }
    setDestLocationId(value);
  }

  async function createLocationFromMove() {
    const trimmed = newLocName.trim();
    if (!trimmed) {
      setError("Location name is required.");
      return;
    }

    setBusy(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      setBusy(false);
      return;
    }

    const ownerId = await getInventoryOwnerIdForUser(userId);

    const res = await supabase
      .from("locations")
      .insert({ owner_id: ownerId, name: trimmed })
      .select("id,name")
      .single();

    if (res.error || !res.data) {
      setError(res.error?.message || "Failed to create location.");
      setBusy(false);
      return;
    }

    setAllLocations((prev) => {
      const next = [...prev, { id: res.data.id, name: res.data.name }];
      next.sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });

    setDestLocationId(res.data.id);
    setNewLocOpen(false);
    setNewLocName("");
    setBusy(false);
  }

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

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      setBusy(false);
      return;
    }

    const ownerId = await getInventoryOwnerIdForUser(userId);

    const res = await supabase
      .from("boxes")
      .update({ location_id: info.toLocationId })
      .eq("owner_id", ownerId)
      .in("id", info.boxIds);

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    await load();

    setConfirmMoveOpen(false);
    confirmMoveInfoRef.current = null;
    setBusy(false);
  }

  // ===== Edit box =====
  function openEditBox(b: BoxRow) {
    setError(null);
    editBoxRef.current = b;
    setEditBoxName(b.name ?? "");
    setEditBoxOpen(true);
  }

  async function saveBoxName() {
    const b = editBoxRef.current;
    if (!b) return;

    const trimmed = editBoxName.trim();
    if (!trimmed) {
      setError("Box name is required.");
      return;
    }

    setBusy(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      setBusy(false);
      return;
    }

    const ownerId = await getInventoryOwnerIdForUser(userId);

    const res = await supabase
      .from("boxes")
      .update({ name: trimmed })
      .eq("owner_id", ownerId)
      .eq("id", b.id)
      .select("id,name")
      .single();

    if (res.error || !res.data) {
      setError(res.error?.message || "Failed to update box.");
      setBusy(false);
      return;
    }

    setBoxes((prev) => prev.map((x) => (x.id === b.id ? { ...x, name: res.data.name } : x)));

    setEditBoxOpen(false);
    editBoxRef.current = null;
    setEditBoxName("");
    setBusy(false);
  }

  // ===== Delete box =====
  function requestDeleteBox(b: BoxRow) {
    setError(null);
    boxToDeleteRef.current = b;
    setConfirmDeleteOpen(true);
  }

  async function confirmDeleteBox() {
    const b = boxToDeleteRef.current;
    if (!b) return;

    setBusy(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      setBusy(false);
      return;
    }

    const ownerId = await getInventoryOwnerIdForUser(userId);

    const itemsRes = await supabase
      .from("items")
      .select("id, photo_url")
      .eq("owner_id", ownerId)
      .eq("box_id", b.id);

    if (itemsRes.error) {
      setError(itemsRes.error.message);
      setBusy(false);
      return;
    }

    const items = (itemsRes.data ?? []) as { id: string; photo_url: string | null }[];

    const paths: string[] = [];
    for (const it of items) {
      if (!it.photo_url) continue;
      const p = getStoragePathFromPublicUrl(it.photo_url);
      if (p) paths.push(p);
    }
    if (paths.length) {
      await supabase.storage.from("item-photos").remove(paths);
    }

    const delItemsRes = await supabase
      .from("items")
      .delete()
      .eq("owner_id", ownerId)
      .eq("box_id", b.id);

    if (delItemsRes.error) {
      setError(delItemsRes.error.message);
      setBusy(false);
      return;
    }

    const delBoxRes = await supabase
      .from("boxes")
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", b.id);

    if (delBoxRes.error) {
      setError(delBoxRes.error.message);
      setBusy(false);
      return;
    }

    setBoxes((prev) => prev.filter((x) => x.id !== b.id));
    setConfirmDeleteOpen(false);
    boxToDeleteRef.current = null;
    setBusy(false);
  }

  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!location) {
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "crimson" }}>{error ?? "Location not found."}</p>
      </main>
    );
  }

  const addBoxHref = `/boxes/new?locationId=${encodeURIComponent(location.id)}&returnTo=${encodeURIComponent(
    `/locations/${location.id}`
  )}`;

  return (
    <main style={{ paddingBottom: moveMode ? 180 : 90 }}>
      <h1 className="sr-only" style={{ margin: "6px 0 6px" }}>{location.name}</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>Boxes in this location</p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {boxes.length === 0 && <p style={{ marginTop: 16 }}>No boxes here yet.</p>}

      {moveMode && (
        <div
          style={{
            background: "#fff",
            border: "2px solid #111",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.1)",
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

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {boxes.map((b) => {
          const isSelected = selectedIds.has(b.id);
          const totalQty = b.items?.reduce((sum, it) => sum + (it.quantity ?? 0), 0) ?? 0;

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
                ...cardStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                textDecoration: "none",
                color: "#111",
                border: moveMode ? (isSelected ? "2px solid #16a34a" : "2px solid #e5e7eb") : "1px solid #e5e7eb",
                cursor: moveMode ? "pointer" : "default",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                {!hideBoxCode && <div style={{ fontWeight: 900, fontSize: 16 }}>{b.code}</div>}

                {b.name ? <div style={{ fontWeight: 700 }}>{b.name}</div> : <div style={{ opacity: 0.6 }}>No name</div>}

                <div
                  style={{
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

                {moveMode && isSelected && (
                  <div
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontWeight: 900,
                      fontSize: 12,
                      background: "#dcfce7",
                      color: "#166534",
                      width: "fit-content",
                    }}
                  >
                    Selected
                  </div>
                )}
              </div>

              {!moveMode && (
                <div style={{ display: "flex", gap: 8 }}>
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <EditIconButton title="Edit box" disabled={busy} onClick={() => openEditBox(b)} />
                  </span>

                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <DeleteIconButton title="Delete box" disabled={busy} onClick={() => requestDeleteBox(b)} />
                  </span>
                </div>
              )}
            </a>
          );
        })}
      </div>

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

          <div style={{ flex: 1, minWidth: 240 }}>
            <select
              value={destLocationId}
              onChange={(e) => onDestinationChange(e.target.value)}
              disabled={busy}
              style={{ width: "100%" }}
            >
              <option value="">Destination location…</option>
              <option value="__none__">No location</option>
              <option value="__new_location__">➕ Create new location…</option>
              {allLocations
                .filter((l) => l.id !== location.id)
                .map((l) => (
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

      {/* ✅ Add Box FAB (passes locationId + returnTo) */}
      <a
        href={addBoxHref}
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
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </a>

      {/* Move Boxes FAB */}
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
          boxShadow: "0 14px 30px rgba(0,0,0,0.2)",
          zIndex: 2000,
          cursor: "pointer",
        }}
        title={moveMode ? "Exit move mode" : "Move boxes"}
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

      {/* Edit Box Modal */}
      <Modal
        open={editBoxOpen}
        title={`Rename box ${editBoxRef.current?.code ?? ""}`}
        onClose={() => {
          if (busy) return;
          setEditBoxOpen(false);
          editBoxRef.current = null;
          setEditBoxName("");
        }}
      >
        <p style={{ marginTop: 0, opacity: 0.85 }}>Change the box name. This does not move the box.</p>

        <input value={editBoxName} onChange={(e) => setEditBoxName(e.target.value)} placeholder="Box name" autoFocus />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setEditBoxOpen(false);
              editBoxRef.current = null;
              setEditBoxName("");
            }}
            disabled={busy}
          >
            Cancel
          </button>

          <button type="button" onClick={saveBoxName} disabled={busy || !editBoxName.trim()} style={{ background: "#111", color: "#fff" }}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>

      {/* Create Location Modal */}
      <Modal
        open={newLocOpen}
        title="Create new location"
        onClose={() => {
          if (busy) return;
          setNewLocOpen(false);
          setNewLocName("");
        }}
      >
        <p style={{ marginTop: 0, opacity: 0.85 }}>Type a name, create it, and it’ll be selected as the destination.</p>

        <input placeholder="Location name (e.g. Shed, Loft)" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} autoFocus />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setNewLocOpen(false);
              setNewLocName("");
            }}
            disabled={busy}
          >
            Cancel
          </button>

          <button type="button" onClick={createLocationFromMove} disabled={busy || !newLocName.trim()} style={{ background: "#111", color: "#fff" }}>
            {busy ? "Creating..." : "Create location"}
          </button>
        </div>
      </Modal>

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

                <button type="button" onClick={confirmMoveSelected} disabled={busy} style={{ background: "#111", color: "#fff" }}>
                  {busy ? "Moving..." : "Yes, move"}
                </button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* Confirm Delete Modal */}
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
        <p style={{ marginTop: 0, opacity: 0.85 }}>This will delete all items inside it and remove linked photos.</p>

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

          <button type="button" onClick={confirmDeleteBox} disabled={busy} style={{ background: "#ef4444", color: "#fff" }}>
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </main>
  );
}

/* Local modals moved to shared Modal component */


