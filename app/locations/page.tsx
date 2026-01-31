"use client";

import RequireAuth from "../components/RequireAuth";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import EditIconButton from "../components/EditIconButton";
import DeleteIconButton from "../components/DeleteIconButton";
import { useUnsavedChanges } from "../components/UnsavedChangesProvider";

type LocationRow = {
  id: string;
  name: string;
  // comes from: .select("id,name, boxes(count)")
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

  // delete modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const locToDeleteRef = useRef<LocationRow | null>(null);

  // blocked modal (can't delete if boxes exist)
  const [blockedOpen, setBlockedOpen] = useState(false);
  const blockedInfoRef = useRef<{ name: string; boxCount: number } | null>(null);

  // ✅ edit modal (rename location)
  const [editOpen, setEditOpen] = useState(false);
  const editLocRef = useRef<LocationRow | null>(null);
  const [editName, setEditName] = useState("");

  const { setDirty } = useUnsavedChanges();

  useEffect(() => {
    if (!editOpen) {
      setDirty(false);
      return;
    }
    const base = editLocRef.current?.name ?? "";
    setDirty(editName.trim() !== base);
  }, [editOpen, editName, setDirty]);

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

    // locations + count of related boxes
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

  // ========= EDIT =========

  function openEdit(l: LocationRow) {
    setError(null);
    editLocRef.current = l;
    setEditName(l.name);
    setEditOpen(true);
  }

  async function saveEdit() {
    const l = editLocRef.current;
    if (!l) return;

    const trimmed = editName.trim();
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

    const res = await supabase
      .from("locations")
      .update({ name: trimmed })
      .eq("owner_id", userId)
      .eq("id", l.id)
      .select("id,name")
      .single();

    if (res.error || !res.data) {
      setError(res.error?.message || "Failed to update location.");
      setBusy(false);
      return;
    }

    // update local list immediately (keep box counts as-is)
    setLocations((prev) => {
      const next = prev.map((x) => (x.id === l.id ? { ...x, name: res.data.name } : x));
      next.sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });

    setEditOpen(false);
    editLocRef.current = null;
    setEditName("");
    setDirty(false);
    setBusy(false);
  }

  // ========= DELETE =========

  async function requestDelete(l: LocationRow) {
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      return;
    }

    // check if location has boxes
    const boxesRes = await supabase
      .from("boxes")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("location_id", l.id);

    if (boxesRes.error) {
      setError(boxesRes.error.message);
      return;
    }

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
      <h1 className="sr-only" style={{ marginTop: 6 }}>Locations</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>Choose a location to view its boxes.</p>

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

                {/* box count badge */}
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

              <div style={{ display: "flex", gap: 8 }}>
                {/* ✅ Edit icon (does NOT open the location) */}
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <EditIconButton title="Edit location" disabled={busy} onClick={() => openEdit(l)} />
                </span>

                {/* ✅ Delete icon (does NOT open the location) */}
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <DeleteIconButton title="Delete location" disabled={busy} onClick={() => requestDelete(l)} />
                </span>
              </div>
            </a>
          );
        })}
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
          color: "#fff",
          fontWeight: 900,
          fontSize: 28,
          lineHeight: "58px",
          textAlign: "center",
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

      {/* EDIT modal */}
      <Modal
        open={editOpen}
        title="Rename location"
        onClose={() => {
          if (busy) return;
          setEditOpen(false);
          editLocRef.current = null;
          setEditName("");
        }}
      >
        <p style={{ marginTop: 0, opacity: 0.85 }}>Fix spelling or rename this location.</p>

        <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Location name" autoFocus />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setEditOpen(false);
              editLocRef.current = null;
              setEditName("");
            }}
            disabled={busy}
          >
            Cancel
          </button>

          <button type="button" onClick={saveEdit} disabled={busy || !editName.trim()} style={{ background: "#111", color: "#fff" }}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>

      {/* Blocked modal */}
      <Modal
        open={blockedOpen}
        title="Unable to delete location"
        onClose={() => {
          setBlockedOpen(false);
          blockedInfoRef.current = null;
        }}
      >
        <p style={{ marginTop: 0 }}>
          <strong>{blockedInfoRef.current?.name ?? "This location"}</strong> can’t be deleted because it still contains{" "}
          <strong>{blockedInfoRef.current?.boxCount ?? 0}</strong> box(es).
        </p>
        <p style={{ marginTop: 0, opacity: 0.85 }}>Move or delete the boxes first, then try again.</p>

        <button
          type="button"
          onClick={() => {
            setBlockedOpen(false);
            blockedInfoRef.current = null;
          }}
          style={{ background: "#111", color: "#fff" }}
        >
          OK
        </button>
      </Modal>

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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

          {/* ✅ confirm delete as icon */}
          <DeleteIconButton title="Confirm delete" disabled={busy} variant="solid" onClick={confirmDelete} />
          {busy && <span style={{ opacity: 0.75 }}>Deleting…</span>}
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
          width: "min(560px, 100%)",
          background: "#fff",
          borderRadius: 20,
          padding: 16,
          boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>{children}</div>
      </div>
    </div>
  );
}