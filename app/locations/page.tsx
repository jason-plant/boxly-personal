"use client";

import RequireAuth from "../components/RequireAuth";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
  boxes?: { count: number }[];
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

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const locToDeleteRef = useRef<LocationRow | null>(null);

  const [blockedOpen, setBlockedOpen] = useState(false);
  const blockedInfoRef = useRef<{ name: string; boxCount: number } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setError("Not logged in.");
      setLocations([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("locations")
      .select("id,name, boxes(count)")
      .eq("owner_id", userId)
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

  async function requestDelete(l: LocationRow) {
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const boxesRes = await supabase
      .from("boxes")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("location_id", l.id);

    const count = boxesRes.count ?? 0;
    if (count > 0) {
      blockedInfoRef.current = { name: l.name, boxCount: count };
      setBlockedOpen(true);
      return;
    }

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
        {locations.map((l) => {
          const boxCount = l.boxes?.[0]?.count ?? 0;

          return (
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
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontWeight: 900 }}>{l.name}</div>

                {/* ✅ box count badge */}
                <div
                  style={{
                    alignSelf: "flex-start",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#dcfce7",
                    color: "#166534",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {boxCount} box{boxCount === 1 ? "" : "es"}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  requestDelete(l);
                }}
                disabled={busy}
                style={{
                  border: "1px solid rgba(239,68,68,0.5)",
                  color: "#b91c1c",
                  background: "#fff",
                  fontWeight: 900,
                  borderRadius: 16,
                  padding: "10px 14px",
                }}
              >
                Delete
              </button>
            </a>
          );
        })}
      </div>

      {/* Add Location FAB */}
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
        +
      </a>

      {/* Blocked modal */}
      <Modal
        open={blockedOpen}
        title="Unable to delete location"
        onClose={() => {
          setBlockedOpen(false);
          blockedInfoRef.current = null;
        }}
      >
        <p>
          <strong>{blockedInfoRef.current?.name}</strong> can’t be deleted because
          it contains <strong>{blockedInfoRef.current?.boxCount}</strong> box(es).
        </p>
        <button onClick={() => setBlockedOpen(false)}>OK</button>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={confirmDeleteOpen}
        title="Delete location?"
        onClose={() => {
          if (!busy) setConfirmDeleteOpen(false);
        }}
      >
        <p>
          Delete <strong>{locToDeleteRef.current?.name}</strong>?
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setConfirmDeleteOpen(false)}>Cancel</button>
          <button
            onClick={confirmDelete}
            disabled={busy}
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
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
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: 12,
        zIndex: 4000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 16,
          width: "min(560px,100%)",
        }}
      >
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
