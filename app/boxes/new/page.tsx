"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import RequireAuth from "../../components/RequireAuth";

type BoxMini = { code: string };

type LocationRow = {
  id: string;
  name: string;
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

export default function NewBoxPage() {
  return (
    <RequireAuth>
      <NewBoxInner />
    </RequireAuth>
  );
}

function NewBoxInner() {
  const router = useRouter();

  const [existingCodes, setExistingCodes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState<string>("");

  // Inline "create location" modal
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocBusy, setNewLocBusy] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      // Current user (for owner_id)
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (sessionErr || !userId) {
        setError(sessionErr?.message || "Not logged in.");
        setExistingCodes([]);
        setLocations([]);
        setLoading(false);
        return;
      }

      // Load existing box codes (for auto numbering) - per user
      const codesRes = await supabase
        .from("boxes")
        .select("code")
        .eq("owner_id", userId)
        .order("code");

      if (codesRes.error) {
        setError(codesRes.error.message);
        setExistingCodes([]);
      } else {
        setExistingCodes((codesRes.data ?? []).map((b: BoxMini) => b.code));
      }

      // Load locations for dropdown - per user
      const locRes = await supabase
        .from("locations")
        .select("id, name")
        .eq("owner_id", userId)
        .order("name");

      if (locRes.error) {
        setError((prev) => prev ?? locRes.error.message);
        setLocations([]);
      } else {
        setLocations((locRes.data ?? []) as LocationRow[]);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const nextAutoCode = useMemo(() => {
    let max = 0;
    for (const c of existingCodes) {
      const n = parseBoxNumber(c);
      if (n !== null && n > max) max = n;
    }
    return `BOX-${pad3(max + 1)}`;
  }, [existingCodes]);

  async function handleLocationChange(value: string) {
    if (value === "__new__") {
      // reset and open modal
      setNewLocName("");
      setNewLocOpen(true);
      return;
    }
    setLocationId(value);
  }

  async function createLocationInline() {
    const trimmed = newLocName.trim();
    if (!trimmed) return;

    setNewLocBusy(true);
    setError(null);

    const { data: sessionData, error: sessionErr } =
      await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (sessionErr || !userId) {
      setError(sessionErr?.message || "Not logged in.");
      setNewLocBusy(false);
      return;
    }

    // Create location (per user)
    const res = await supabase
      .from("locations")
      .insert({
        owner_id: userId,
        name: trimmed,
      })
      .select("id, name")
      .single();

    if (res.error || !res.data) {
      setError(res.error?.message || "Failed to create location.");
      setNewLocBusy(false);
      return;
    }

    // Add into list + select it
    setLocations((prev) => {
      const next = [...prev, res.data as LocationRow];
      next.sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });
    setLocationId(res.data.id);

    setNewLocOpen(false);
    setNewLocName("");
    setNewLocBusy(false);
  }

  async function save() {
    const trimmed = code.trim();

    if (!trimmed) {
      setError("Box code is required.");
      return;
    }
    if (parseBoxNumber(trimmed) === null) {
      setError('Box code must look like "BOX-001".');
      return;
    }

    setBusy(true);
    setError(null);

    const { data: sessionData, error: sessionErr } =
      await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (sessionErr || !userId) {
      setError(sessionErr?.message || "Not logged in.");
      setBusy(false);
      return;
    }

    const insertRes = await supabase.from("boxes").insert([
      {
        owner_id: userId,
        code: trimmed.toUpperCase(),
        name: name.trim() || null,
        location_id: locationId || null,
      },
    ]);

    if (insertRes.error) {
      setError(insertRes.error.message);
      setBusy(false);
      return;
    }

    router.push("/boxes");
    router.refresh();
  }

  return (
    <main style={{ paddingBottom: 90 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
          maxWidth: 560,
        }}
      >
        <h1 style={{ marginTop: 6 }}>Create Box</h1>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Fill in the details and hit Save. You’ll return to the Boxes list.
        </p>

        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        {loading && <p>Loading…</p>}

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder='Code e.g. BOX-001'
              style={{ flex: 1, minWidth: 220 }}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setCode(nextAutoCode)}
              disabled={busy || loading}
            >
              Auto ({nextAutoCode})
            </button>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            disabled={busy}
          />

          <select
            value={locationId}
            onChange={(e) => handleLocationChange(e.target.value)}
            disabled={busy || loading}
          >
            <option value="">Select location (optional)</option>
            <option value="__new__">➕ Create new location…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => router.push("/boxes")}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={save}
              disabled={busy}
              style={{ background: "#111", color: "#fff" }}
            >
              {busy ? "Saving..." : "Save box"}
            </button>
          </div>

          <p style={{ opacity: 0.7, marginTop: 6 }}>
            Tip: You can also press Enter while typing in a field.
          </p>
        </div>
      </div>

      {/* Inline "Create location" modal */}
      <Modal
        open={newLocOpen}
        title="Create new location"
        onClose={() => {
          if (newLocBusy) return;
          setNewLocOpen(false);
          setNewLocName("");
        }}
      >
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Add a new location without leaving this page.
        </p>

        <input
          placeholder="Location name (e.g. Shed, Loft)"
          value={newLocName}
          onChange={(e) => setNewLocName(e.target.value)}
          autoFocus
          disabled={newLocBusy}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              if (newLocBusy) return;
              setNewLocOpen(false);
              setNewLocName("");
            }}
            disabled={newLocBusy}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={createLocationInline}
            disabled={newLocBusy || !newLocName.trim()}
            style={{ background: "#111", color: "#fff" }}
          >
            {newLocBusy ? "Creating..." : "Create location"}
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

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
