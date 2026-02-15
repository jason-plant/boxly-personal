"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import RequireAuth from "../../components/RequireAuth";
import Modal from "../../components/Modal";
import { useUnsavedChanges } from "../../components/UnsavedChangesProvider";
import { getInventoryOwnerIdForUser } from "../../lib/inventoryScope";

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

  const { setDirty } = useUnsavedChanges();

  useEffect(() => {
    const dirty = name.trim() !== "" || Boolean(locationId);
    setDirty(dirty);
  }, [name, locationId, setDirty]);

  // Inline "create location" modal
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocBusy, setNewLocBusy] = useState(false);

  async function loadData(): Promise<string[] | null> {
    setLoading(true);
    setError(null);

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (sessionErr || !userId) {
      setError(sessionErr?.message || "Not logged in.");
      setExistingCodes([]);
      setLocations([]);
      setLoading(false);
      return null;
    }

    const ownerId = await getInventoryOwnerIdForUser(userId);

    // existing codes (per user)
    const codesRes = await supabase
      .from("boxes")
      .select("code")
      .eq("owner_id", ownerId)
      .order("code");

    if (codesRes.error) {
      setError(codesRes.error.message);
      setExistingCodes([]);
      setLoading(false);
      return null;
    } else {
      const codes = (codesRes.data ?? []).map((b: BoxMini) => b.code);
      setExistingCodes(codes);

      // locations (per user)
      const locRes = await supabase
        .from("locations")
        .select("id, name")
        .eq("owner_id", ownerId)
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
      return codes;
    }
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

    const ownerId = await getInventoryOwnerIdForUser(userId);

    const res = await supabase
      .from("locations")
      .insert({ owner_id: ownerId, name: trimmed })
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

    const ownerId = await getInventoryOwnerIdForUser(userId);

    const insertRes = await supabase
      .from("boxes")
      .insert([
        {
          owner_id: ownerId,
          code: code.toUpperCase(),
          name: name.trim() || null,
          location_id: locationId || null,
        },
      ])
      .select("code")
      .single();

    if (insertRes.error || !insertRes.data) {
      return { ok: false as const, message: insertRes.error?.message || "Failed to create box." };
    }

    return { ok: true as const, code: insertRes.data.code };
  }

  async function save() {
    setBusy(true);
    setError(null);

    // Try with current nextAutoCode
    let result = await tryInsertWithCode(nextAutoCode);

    // If it collided, reload and try once more
    if (!result.ok) {
      const refreshedCodes = await loadData();
      // compute a fresh next code after reload (avoid stale state)
      let max = 0;
      for (const c of refreshedCodes ?? existingCodes) {
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

    // ✅ take user straight into adding an item for this new box
    setDirty(false);
    router.push(`/box/${encodeURIComponent(result.code)}/new-item`);
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
        <h1 className="sr-only" style={{ marginTop: 6 }}>Create Box</h1>
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

/* Local modal replaced by shared `Modal` component in `app/components/Modal.tsx` */
