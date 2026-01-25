"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type BoxMini = { code: string };

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
  const router = useRouter();

  const [existingCodes, setExistingCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    async function loadCodes() {
      setLoading(true);
      const res = await supabase.from("boxes").select("code").order("code");
      setExistingCodes((res.data ?? []).map((b: BoxMini) => b.code));
      setLoading(false);
    }
    loadCodes();
  }, []);

  const nextAutoCode = useMemo(() => {
    let max = 0;
    for (const c of existingCodes) {
      const n = parseBoxNumber(c);
      if (n !== null && n > max) max = n;
    }
    return `BOX-${pad3(max + 1)}`;
  }, [existingCodes]);

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

    const insertRes = await supabase.from("boxes").insert([
      {
        code: trimmed.toUpperCase(),
        name: name.trim() || null,
        location: location.trim() || null,
      },
    ]);

    if (insertRes.error) {
      setError(insertRes.error.message);
      setBusy(false);
      return;
    }

    // Go back to boxes page
    router.push("/boxes");
  }

  return (
    <main>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
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
            />
            <button type="button" onClick={() => setCode(nextAutoCode)} disabled={busy || loading}>
              Auto ({nextAutoCode})
            </button>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
          />

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => router.push("/boxes")} disabled={busy}>
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
    </main>
  );
}
