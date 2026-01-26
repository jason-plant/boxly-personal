"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import RequireAuth from "../../../components/RequireAuth";

export default function NewItemPage() {
  const params = useParams<{ code?: string }>();
  const code = params?.code ? decodeURIComponent(String(params.code)) : "";
  const router = useRouter();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    setBusy(true);
    setError(null);

    // 1️⃣ Find box id
    const boxRes = await supabase.from("boxes").select("id").eq("code", code).maybeSingle();

    if (!boxRes.data || boxRes.error) {
      setError("Box not found.");
      setBusy(false);
      return;
    }

    // 2️⃣ Create item first
    const insertRes = await supabase
      .from("items")
      .insert({
        box_id: boxRes.data.id,
        name: name.trim(),
        description: desc.trim() || null,
        quantity: qty,
      })
      .select("id")
      .single();

    if (insertRes.error || !insertRes.data) {
      setError(insertRes.error?.message || "Failed to create item.");
      setBusy(false);
      return;
    }

    const itemId = insertRes.data.id;

    // 3️⃣ Upload photo if provided
    if (photoFile) {
      const ext = photoFile.name.split(".").pop() || "jpg";
      const fileName = `${itemId}-${Date.now()}.${ext}`;

      const upload = await supabase.storage.from("item-photos").upload(fileName, photoFile, {
        upsert: true,
      });

      if (upload.error) {
        setError(upload.error.message);
        setBusy(false);
        return;
      }

      const publicUrl = supabase.storage.from("item-photos").getPublicUrl(fileName).data.publicUrl;

      await supabase.from("items").update({ photo_url: publicUrl }).eq("id", itemId);
    }

    // 4️⃣ Done → back to box
    router.push(`/box/${encodeURIComponent(code)}`);
  }

  return (
    <RequireAuth>
      <main style={{ paddingBottom: 90 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ marginTop: 6 }}>Add Item</h1>
          <p style={{ opacity: 0.85, marginTop: 0 }}>
            Adding to <strong>{code}</strong>
          </p>

          {error && <p style={{ color: "crimson" }}>{error}</p>}

          <div style={{ display: "grid", gap: 12 }}>
            <input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

            <input
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />

            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />

            {/* PHOTO PICKERS */}
            <div>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>Add photo (optional)</div>

              <input
                id="cam"
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => {
                  setPhotoFile(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />

              <input
                id="file"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  setPhotoFile(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => document.getElementById("cam")?.click()}>
                  Take photo
                </button>
                <button type="button" onClick={() => document.getElementById("file")?.click()}>
                  Choose file
                </button>

                {photoFile && (
                  <span style={{ alignSelf: "center", opacity: 0.7 }}>{photoFile.name}</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              <button type="button" onClick={() => router.push(`/box/${encodeURIComponent(code)}`)}>
                Cancel
              </button>

              <button
                type="button"
                onClick={save}
                disabled={busy}
                style={{ background: "#111", color: "#fff" }}
              >
                {busy ? "Saving..." : "Save item"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </RequireAuth>
  );
}
