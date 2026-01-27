"use client";

import RequireAuth from "../../components/RequireAuth";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
};

export default function LocationsPage() {
  return (
    <RequireAuth>
      <LocationsInner />
    </RequireAuth>
  );
}

function LocationsInner() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  // delete modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const locToDeleteRef = useRef<LocationRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      setLocations([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("locations")
      .select("id,name")
      .eq("owner_id", userId) // ✅ only my locations
      .order("name");

    if (error) {
      setError(error.message);
      setLocations([]);
    } else {
      setLocations((data ?? []) as LocationRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function requestDelete(l: LocationRow) {
    locToDeleteRef.current = l;
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    const l = locToDeleteRef.current;
    if (!l) return;

    setBusy(true);
    setError(null);

    const res = await supabase.from("locations").delete().eq("id", l.id);

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    setLocations((prev) => prev.filter((x) => x.id !== l.id));
    setConfirmDeleteOpen(false);
    locToDeleteRef.current = null;
    setBusy(false);
  }

  return (
    <main style={{ paddingBottom: 90 }}>
      <h1 style={{ marginTop: 6 }}>Locations</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Choose a location to view its boxes.
      </p>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {loading && <p>Loading…</p>}
      {!loading && locations.length === 0 && <p>No locations yet.</p>}

      <div style={{ display: "grid", gap: 10 }}>
        {locations.map((l) => (
          <a
            key={l.id}
            href={`/locations/${l.id}`}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 14,
              textDecoration: "none",
              color: "#111",
              boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 900 }}>{l.name}</div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                requestDelete(l);
              }}
              disabled={busy}
              style={{
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#b91c1c",
                background: "#fff",
                fontWeight: 900,
                borderRadius: 16,
                padding: "10px 14px",
                boxShadow: "none",
              }}
            >
              Delete
            </button>
          </a>
        ))}
      </div>

      {/* ✅ FAB: Add Location */}
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

      {/* Delete modal */}
      <Modal
        open={confirmDeleteOpen}
        title="Delete location?"
        onClose={() => {
          if (busy) return;
          setConfirmDeleteOpen(false);
          locToDeleteRef.current = null;
        }}
      >
        <p style={{ marginTop: 0 }}>
          Delete <strong>{locToDeleteRef.current?.name ?? "this location"}</strong>?
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setConfirmDeleteOpen(false);
              locToDeleteRef.current = null;
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
