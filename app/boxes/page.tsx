"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import RequireAuth from "../components/RequireAuth";

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
  items?: { quantity: number | null }[]; // for qty sum
};

export default function BoxesPage() {
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const boxToDeleteRef = useRef<BoxRow | null>(null);

  async function loadBoxes() {
    setLoading(true);
    setError(null);

    // Pull boxes + item quantities so we can sum per box
    const res = await supabase
      .from("boxes")
      .select(
        `
        id,
        code,
        name,
        location,
        items ( quantity )
      `
      )
      .order("code", { ascending: true });

    if (res.error) {
      setError(res.error.message);
      setBoxes([]);
    } else {
      setBoxes((res.data ?? []) as BoxRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadBoxes();
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

  return (
    <RequireAuth>
      <main style={{ paddingBottom: 90 }}>
        <h1 style={{ marginTop: 6 }}>Boxes</h1>

        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        {loading && <p>Loading boxes…</p>}
        {!loading && boxes.length === 0 && <p>No boxes yet.</p>}

        <div style={{ display: "grid", gap: 10 }}>
          {boxes.map((b) => {
            const totalQty = b.items?.reduce((sum, it) => sum + (it.quantity ?? 0), 0) ?? 0;

            return (
              <a
                key={b.id}
                href={`/box/${encodeURIComponent(b.code)}`}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
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
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{b.code}</div>

                  {b.name && <div style={{ marginTop: 4, fontWeight: 700 }}>{b.name}</div>}
                  {b.location && <div style={{ marginTop: 2, opacity: 0.8 }}>{b.location}</div>}

                  {/* Item count badge */}
                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontWeight: 900,
                      fontSize: 13,
                      background: "#ecfdf5",
                      border: "1px solid #bbf7d0",
                      color: "#166534",
                    }}
                  >
                    {totalQty} item{totalQty === 1 ? "" : "s"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    requestDeleteBox(b);
                  }}
                  disabled={busy}
                  style={{
                    border: "1px solid #ef4444",
                    color: "#ef4444",
                    background: "#fff",
                    fontWeight: 900,
                  }}
                >
                  Delete
                </button>
              </a>
            );
          })}
        </div>

        {/* Floating + bubble */}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
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
