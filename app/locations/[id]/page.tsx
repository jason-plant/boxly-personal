"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import RequireAuth from "../../components/RequireAuth";

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

    // Location (must belong to user)
    const locRes = await supabase
      .from("locations")
      .select("id, name")
      .eq("id", locationId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (!locRes.data || locRes.error) {
      setError("Location not found");
      setLoading(false);
      return;
    }

    setLocation(locRes.data as LocationRow);

    // All locations (for destination dropdown)
    const allLocRes = await supabase
      .from("locations")
      .select("id, name")
      .eq("owner_id", userId)
      .order("name");

    if (allLocRes.error) {
      setError(allLocRes.error.message);
      setAllLocations([]);
    } else {
      setAllLocations((allLocRes.data ?? []) as LocationMini[]);
    }

    // Boxes in this location (must belong to user)
    const boxRes = await supabase
      .from("boxes")
      .select("id, code, name")
      .eq("location_id", locationId)
      .eq("owner_id", userId)
      .order("code");

    if (boxRes.error) {
      setError(boxRes.error.message);
      setBoxes([]);
    } else {
      setBoxes((boxRes.data ?? []) as BoxRow[]);
    }

    // Reset move state on reload
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

    const res = await supabase
      .from("boxes")
      .update({ location_id: info.toLocationId })
      .eq("owner_id", userId)
      .in("id", info.boxIds);

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    // Reload this page so the moved boxes disappear from the list
    await load();

    setConfirmMoveOpen(false);
    confirmMoveInfoRef.current = null;
    setBusy(false);
  }

  // ===== Render states =====

  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error && !location) {
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "crimson" }}>{error}</p>
      </main>
    );
  }

  if (!location) {
    return (
      <main style={{ padding: 16 }}>
        <p>Location not found.</p>
      </main>
    );
  }

  return (
    <main style={{ paddingBottom: moveMode ? 180 : 90 }}>
      <h1 style={{ margin: "6px 0 6px" }}>{location.name}</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>Boxes in this location</p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

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

      {boxes.length === 0 && <p style={{ marginTop: 16 }}>No boxes here yet.</p>}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {boxes.map((b) => {
          const isSelected = selectedIds.has(b.id);

          return (
            <a
              key={b.id}
              href={moveMode ? "#" : `/box/${encodeURIComponent(b.code)}`}
              className="tap-btn"
              onClick={(e) => {
                if (!moveMode) return;
                e.preventDefault();
                toggleSelected(b.id);
              }}
              style={{
                ...cardStyle,
                display: "block",
                textDecoration: "none",
                color: "#111",
                border: moveMode ? (isSelected ? "2px solid #16a34a" : "2px solid #e5e7eb") : "1px solid #e5e7eb",
                cursor: moveMode ? "pointer" : "default",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16 }}>{b.code}</div>
              {b.name && <div style={{ marginTop: 6, opacity: 0.85 }}>{b.name}</div>}
              {moveMode && isSelected && (
                <div
                  style={{
                    marginTop: 10,
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    fontSize: 12,
                    background: "#dcfce7",
                    color: "#166534",
                  }}
                >
                  Selected
                </div>
              )}
            </a>
          );
        })}
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

      {/* FAB: Move boxes (same position as Boxes screen) */}
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

          <div style={{ flex: 1, minWidth: 220 }}>
            <select
              value={destLocationId}
              onChange={(e) => setDestLocationId(e.target.value)}
              disabled={busy}
              style={{ width: "100%" }}
            >
              <option value="">Destination location…</option>
              <option value="__none__">No location</option>
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
  children: ReactNode;
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
