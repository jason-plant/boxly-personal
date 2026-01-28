"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  const initialLocationId = searchParams.get("locationId") ?? "";
  const returnTo = searchParams.get("returnTo") ?? "";

  const [existingCodes, setExistingCodes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ user-visible fields only
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState<string>(initialLocationId);

  // Inline "create location" modal
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocBusy, setNewLocBusy] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (sessionErr || !userId) {
      setError(sessionErr?.message || "Not logged in.");
      setExistingCodes([]);
      setLocations([]);
      setLoading(false);
      return;
    }

    // existing codes (per user)
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

    // locations (per user)
    const locRes = await supabase
      .from("locations")
      .select("id, name")
      .eq("owner_id", userId)
      .order("name");

    if (locRes.error) {
      setError((prev) => prev ?? locRes.error.message);
      setLocations([]);
    } else {
      const locs = (locRes.data ?? []) as LocationRow[];
      setLocations(locs);

      // if locationId came from querystring but doesn't exist, clear it
      if (locationId && !locs.some((l) => l.id === locationId)) {
        setLocationId("");
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (sessionErr || !userId) {
      setError(sessionErr?.message || "Not logged in.");
      setNewLocBusy(false);
      return;
    }

    const res = await supabase
      .from("locations")
      .insert({ owner_id: userId, name: trimmed })
      .select("id, name")
      .single();

    if (res.error || !res.data) {
      setError(res.error?.message || "Failed to create location.");
      setNewLocBusy(false);
      return;
    }

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

  async function tryInsertWithCode(code: string) {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (sessionErr || !userId) {
      return { ok: false as const, message: sessionErr?.message || "Not logged in." };
    }

    const insertRes = await supabase.from("boxes").insert([
      {
        owner_id: userId,
        code: code.toUpperCase(),
        name: name.trim() || null,
        location_id: locationId || null,
      },
    ]);

    if (insertRes.error) {
      return { ok: false as const, message: insertRes.error.message };
    }

    return { ok: true as const };
  }

  async function save() {
    setBusy(true);
    setError(null);

    // Try with current nextAutoCode
    let result = await tryInsertWithCode(nextAutoCode);

    // If it collided, reload and try once more
    if (!result.ok) {
      await loadData();
      // compute a fresh next code after reload
      let max = 0;
      for (const c of existingCodes) {
        const n = parseBoxNumber(c);
        if (n !== null && n > max) max = n;
      }
      const retryCode = `BOX-${pad3(max + 1)}`;

      result = await tryInsertWithCode(retryCode);
    }

    if (!result.ok) {
      setError(result.message || "Failed to create box.");
      setBusy(false);
      return;
    }

    // ✅ return to location if provided, otherwise boxes list
    const dest = returnTo ? decodeURIComponent(returnTo) : "/boxes";
    router.push(dest);
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
          Enter a name (optional) and pick a location (optional). Code is generated automatically.
        </p>

        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        {loading && <p>Loading…</p>}

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
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
              onClick={() => {
                if (returnTo) router.push(decodeURIComponent(returnTo));
                else router.push("/boxes");
              }}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={save}
              disabled={busy || loading}
              style={{ background: "#111", color: "#fff" }}
            >
              {busy ? "Saving..." : "Save box"}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={newLocOpen}
        title="Create new location"
        onClose={() => {
          if (newLocBusy) return;
          setNewLocOpen(false);
          setNewLocName("");
        }}
      >
        <p style={{ marginTop: 0, opacity: 0.85 }}>Add a new location without leaving this page.</p>

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
