"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import RequireAuth from "../../../components/RequireAuth";
import { useUnsavedChanges } from "../../../components/UnsavedChangesProvider";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export default function NewItemPage() {
  const params = useParams<{ code?: string }>();
  const code = params?.code ? decodeURIComponent(String(params.code)) : "";
  const router = useRouter();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const { setDirty } = useUnsavedChanges();

  useEffect(() => {
    const dirty = name.trim() !== "" || desc.trim() !== "" || qty !== 1 || Boolean(photoFile);
    setDirty(dirty);
  }, [name, desc, qty, photoFile, setDirty]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compressInfo, setCompressInfo] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    setBusy(true);
    setError(null);
    setCompressInfo(null);

    // ✅ Get logged-in user (needed for per-user photo folder)
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      setError("You must be logged in to add items.");
      setBusy(false);
      return;
    }

    // 1️⃣ Find box id
    const boxRes = await supabase
      .from("boxes")
      .select("id")
      .eq("code", code)
      .maybeSingle();

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
      const maxImageMB = 1;
      const maxImageBytes = maxImageMB * 1024 * 1024;
      let fileToUpload = photoFile;

      try {
        const { compressImage } = await import("../../../../lib/image");
        const compressed = await compressImage(photoFile, { maxSize: 1280, quality: 0.5, maxSizeMB: 0.1, maxUploadMB: 1, aggressive: true });
        fileToUpload = compressed;
        setCompressInfo(`Upload size: ${formatBytes(fileToUpload.size)}`);
      } catch (e: any) {
        fileToUpload = photoFile;
        setCompressInfo(`Upload size: ${formatBytes(fileToUpload.size)}`);
      }

      if (fileToUpload.size > maxImageBytes) {
        setError("Image must be 1 MB or smaller.");
        setBusy(false);
        return;
      }

      const safeName = safeFileName(fileToUpload.name || "photo.jpg");

      // ✅ store inside a folder for THIS user
      // example: 123e4567.../itemId-1700000000000-photo.webp
      const fileName = `${user.id}/${itemId}-${Date.now()}-${safeName}`;

      const upload = await supabase.storage
        .from("item-photos")
        .upload(fileName, fileToUpload, { upsert: true, contentType: fileToUpload.type || "image/jpeg" });

      if (upload.error) {
        setError(upload.error.message);
        setBusy(false);
        return;
      }

      const publicUrl = supabase.storage
        .from("item-photos")
        .getPublicUrl(fileName).data.publicUrl;

      await supabase.from("items").update({ photo_url: publicUrl }).eq("id", itemId);
    }

    // 4️⃣ Done → back to box
    setDirty(false);
    router.push(`/box/${encodeURIComponent(code)}`);
  }

  return (
    <RequireAuth>
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
          <h1 className="sr-only" style={{ marginTop: 6 }}>Add Item</h1>
          <p style={{ opacity: 0.85, marginTop: 0 }}>
            Adding to <strong>{code}</strong>
          </p>

          {error && <p style={{ color: "crimson" }}>{error}</p>}
          {compressInfo && <p style={{ color: "#166534" }}>{compressInfo}</p>}

          <div style={{ display: "grid", gap: 12 }}>
            <input
              placeholder="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <input
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />

            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />

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
              <button onClick={() => { setDirty(false); router.push(`/box/${encodeURIComponent(code)}`); }}>
                Cancel
              </button>

              <button onClick={save} disabled={busy} style={{ background: "#111", color: "#fff" }}>
                {busy ? "Saving..." : "Save item"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </RequireAuth>
  );
}
