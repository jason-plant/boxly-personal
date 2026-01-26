"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const locationToDeleteRef = useRef<LocationRow | null>(null);

  async function loadLocations() {
    setLoading(true);
    setErr(null);

    const res = await supabase.from("locations").select("id, name").order("name");

    if (res.error) {
      setErr(res.error.message);
      setLocations([]);
    } else {
      setLocations((res.data ?? []) as LocationRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadLocations();
  }, []);

  function requestDelete(loc: LocationRow) {
    locationToDeleteRef.current = loc;
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    const loc = locationToDeleteRef.current;
    if (!loc) return;

    setBusy(true);
    setErr(null);

    // Safety: do not delete a location that still has boxes
    const boxesRes = await supabase
      .from("boxes")
      .select("id", { count: "exact", head: true })
      .eq("location_id", loc.id);

    if (boxesRes.error) {
      setErr(boxesRes.error.message);
      setBusy(false);
      return;
    }

    const count = boxesRes.count ?? 0;
    if (count > 0) {
      setErr(`You can’t delete "${loc.name}" because it still has ${count} box(es). Move/delete the boxes first.`);
      setBusy(false);
      setConfirmDeleteOpen(false);
      locationToDeleteRef.current = null;
      return;
    }

    const delRes = await supabase.from("locations").delete().eq("id", loc.id);
    if (delRes.error) {
      setErr(delRes.error.message);
      setBusy(false);
      return;
    }

    setLocations((prev) => prev.filter((x) => x.id !== loc.id));
    setConfirmDeleteOpen(false);
    locationToDeleteRef.current = null;
    setBusy(false);
  }

  return (
    <main style={{ paddingBottom: 90 }}>
      <h1 style={{ margin: "6px 0 6px" }}>Locations</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>Choose a location to view its boxes.</p>

      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
      {loading && <p>Loading…</p>}
      {!loading && locations.length === 0 && <p>No locations yet.</p>}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {locations.map((l) => (
          <a
            key={l.id}
            href={`/locations/${encodeURIComponent(l.id)}`}
            style={{
              ...cardStyle,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "#111",
            }}
          >
            <div style={{ fontWeight: 900 }}>{l.name}</div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  requestDelete(l);
                }}
                disabled={busy}
                style={{
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "#b91c1c",
                  borderRadius: 14,
                  fontWeight: 800,
                  boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
                }}
              >
                Delete
              </button>
              <span style={{ opacity: 0.6 }}></span>
            </div>
          </a>
        ))}
      </div>

      {/* FAB: Add Location */}
      <a
        href="/locations/new"
        aria-label="Add location"
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

      <Modal
        open={confirmDeleteOpen}
        title="Delete location?"
        onClose={() => {
          if (busy) return;
          setConfirmDeleteOpen(false);
          locationToDeleteRef.current = null;
        }}
      >
        <p style={{ marginTop: 0 }}>
          Delete <strong>{locationToDeleteRef.current?.name ?? "this location"}</strong>?
        </p>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          This is only allowed if the location has no boxes inside it.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setConfirmDeleteOpen(false);
              locationToDeleteRef.current = null;
            }}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={confirmDelete}
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
