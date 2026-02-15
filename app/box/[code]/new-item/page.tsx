"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { getInventoryOwnerIdForUser } from "../../../lib/inventoryScope";
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

function dataURLToBlob(dataUrl: string) {
  const [meta, b64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(meta);
  const mime = mimeMatch?.[1] || "image/jpeg";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function NewItemPage() {
  const params = useParams<{ code?: string }>();
  const code = params?.code ? decodeURIComponent(String(params.code)) : "";
  const router = useRouter();

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
  const [cameraOn, setCameraOn] = useState(false);

  async function startCamera() {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e: any) {
      // Don't block the page; user can still choose a file
      setError(e?.message || "Unable to start camera. Check permissions.");
      setCameraOn(false);
    }
  }

  function stopCamera() {
    const s = streamRef.current;
    if (!s) return;
    for (const t of s.getTracks()) t.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  function captureFrame() {
    setError(null);
    const v = videoRef.current;
    if (!v) return;

    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    if (!w || !h) {
      setError("Camera not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Canvas not supported.");
      return;
    }

    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const blob = dataURLToBlob(dataUrl);
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    setPhotoFile(file);
    setCompressInfo(null);
  }

  useEffect(() => {
    // Auto-start camera like scan-item
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    setBusy(true);
    setError(null);
    setCompressInfo(null);

    // ✅ Get logged-in user (needed for inventory scope + per-user photo folder)
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      setError("You must be logged in to add items.");
      setBusy(false);
      return;
    }

    const ownerId = await getInventoryOwnerIdForUser(user.id);

    // 1️⃣ Find box id
    const boxRes = await supabase
      .from("boxes")
      .select("id, location_id, code")
      .eq("owner_id", ownerId)
      .eq("code", code)
      .maybeSingle();

    if (!boxRes.data || boxRes.error) {
      setError("Box not found.");
      setBusy(false);
      return;
    }

    // Cache box -> location mapping for smart Back button
    if (typeof window !== "undefined" && boxRes.data) {
      const key = `boxLocation:${String(boxRes.data.code || code).toUpperCase()}`;
      const locId = (boxRes.data as any).location_id as string | null;
      if (locId) window.sessionStorage.setItem(key, locId);
      else window.sessionStorage.removeItem(key);
    }

    // 2️⃣ Create item first
    const insertRes = await supabase
      .from("items")
      .insert({
        owner_id: ownerId,
        box_id: boxRes.data.id,
        name: name.trim(),
        description: desc.trim() || null,
        quantity: Math.max(1, Math.floor(Number(qty) || 1)),
        photo_url: null,
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
        // best-effort rollback so we don't create an item that the user thinks failed
        await supabase.from("items").delete().eq("owner_id", ownerId).eq("id", itemId);
        setError("Upload blocked: exceeds 1 MB. (build: 2026-02-08)");
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
        // best-effort rollback so we don't create an item that the user thinks failed
        await supabase.from("items").delete().eq("owner_id", ownerId).eq("id", itemId);
        setError(upload.error.message);
        setBusy(false);
        return;
      }

      const publicUrl = supabase.storage
        .from("item-photos")
        .getPublicUrl(fileName).data.publicUrl;

      await supabase.from("items").update({ photo_url: publicUrl }).eq("owner_id", ownerId).eq("id", itemId);
    }

    // 4️⃣ Done → back to box
    // Stay on this page ready to add another item
    setName("");
    setDesc("");
    setQty(1);
    setPhotoFile(null);
    setCompressInfo(null);
    setDirty(false);
    setBusy(false);
    return;
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
            {/* CAMERA / PHOTO (top, so keyboard doesn't cover it) */}
            <div>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>Add photo (optional)</div>

              {/* Live camera preview (auto-starts) */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#000",
                  width: "100%",
                  maxWidth: 520,
                }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{ width: "100%", display: "block" }}
                />
              </div>

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
                <button type="button" onClick={captureFrame}>
                  Capture photo
                </button>
                <button type="button" onClick={startCamera}>
                  Restart camera
                </button>
                <button type="button" onClick={() => document.getElementById("file")?.click()}>
                  Choose file
                </button>
                {photoFile && (
                  <span style={{ alignSelf: "center", opacity: 0.7 }}>{photoFile.name}</span>
                )}
              </div>
            </div>

            {/* FIELDS (below camera) */}
            <input
              placeholder="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              ref={nameInputRef}
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
