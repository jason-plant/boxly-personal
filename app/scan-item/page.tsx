"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "../components/RequireAuth";
import { supabase } from "../lib/supabaseClient";

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location?: { name: string } | null;
};

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

export default function ScanItemPage() {
  return (
    <RequireAuth>
      <ScanItemInner />
    </RequireAuth>
  );
}

function ScanItemInner() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const filePickRef = useRef<HTMLInputElement | null>(null);
  const takePhotoRef = useRef<HTMLInputElement | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string>("");

  const selectedBox = useMemo(
    () => boxes.find((b) => b.id === selectedBoxId) ?? null,
    [boxes, selectedBoxId]
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Image state
  const [imageDataUrl, setImageDataUrl] = useState<string>("");
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  // Item fields
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [desc, setDesc] = useState("");

  async function loadBoxes() {
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      return;
    }

    // Pull location name via boxes.location_id -> locations.name
    const res = await supabase
      .from("boxes")
      .select(
        `
        id,
        code,
        name,
        location:locations ( name )
      `
      )
      .eq("owner_id", userId)
      .order("code");

    if (res.error) {
      setError(res.error.message);
      return;
    }

    setBoxes((res.data ?? []) as unknown as BoxRow[]);
  }

  async function startCamera() {
    setError(null);

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
    } catch (e: any) {
      setError(e?.message || "Unable to start camera. Check permissions.");
    }
  }

  function stopCamera() {
    const s = streamRef.current;
    if (!s) return;
    for (const t of s.getTracks()) t.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function resetAfterNewPhoto() {
    // keep box selection, but reset item bits
    setError(null);
    setName("");
    setDesc("");
    setQty(1);
    // focus name field after photo is set
    setTimeout(() => nameInputRef.current?.focus(), 50);
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
    setImageDataUrl(dataUrl);

    const blob = dataURLToBlob(dataUrl);
    const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
    setCapturedFile(file);

    resetAfterNewPhoto();
  }

  async function onPickedFile(f: File | null) {
    setCapturedFile(f);
    setImageDataUrl("");
    if (!f) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result || ""));
      resetAfterNewPhoto();
    };
    reader.readAsDataURL(f);
  }

  async function saveItem() {
    if (!selectedBox) {
      setError("Pick a box first.");
      return;
    }
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }
    if (!capturedFile) {
      setError("Add a photo first (capture/take/choose).");
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

    // 1) Create item first (no photo_url yet)
    const insertRes = await supabase
      .from("items")
      .insert({
        owner_id: userId,
        box_id: selectedBox.id,
        name: name.trim(),
        description: desc.trim() ? desc.trim() : null,
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

    const itemId = insertRes.data.id as string;

    // 2) Upload photo to Supabase Storage
    const safe = safeFileName(capturedFile.name || "photo.jpg");
    const path = `${userId}/${itemId}/${Date.now()}-${safe}`;

    // Compress the photo client-side to save Supabase storage
    try {
      const { compressImage } = await import("../../lib/image");
      const compressed = await compressImage(capturedFile, { maxSize: 1280, quality: 0.8 });

      // Use compressed image only if it gives a size reduction
      const fileToUpload = compressed.size < capturedFile.size ? compressed : capturedFile;

      const uploadRes = await supabase.storage
        .from("item-photos")
        .upload(path, fileToUpload, {
          cacheControl: "3600",
          upsert: false,
          contentType: fileToUpload.type || "image/jpeg",
        });

      if (uploadRes.error) {
        // rollback item if upload fails (best effort)
        await supabase.from("items").delete().eq("owner_id", userId).eq("id", itemId);
        setError(uploadRes.error.message);
        setBusy(false);
        return;
      }
    } catch (e: any) {
      // If compression fails, fall back to uploading the original file
      const uploadRes = await supabase.storage
        .from("item-photos")
        .upload(path, capturedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: capturedFile.type || "image/jpeg",
        });

      if (uploadRes.error) {
        await supabase.from("items").delete().eq("owner_id", userId).eq("id", itemId);
        setError(uploadRes.error.message);
        setBusy(false);
        return;
      }
    }

    if (uploadRes.error) {
      // rollback item if upload fails (best effort)
      await supabase.from("items").delete().eq("owner_id", userId).eq("id", itemId);
      setError(uploadRes.error.message);
      setBusy(false);
      return;
    }

    const pub = supabase.storage.from("item-photos").getPublicUrl(path);
    const photoUrl = pub.data.publicUrl;

    // 3) Update item with photo_url
    const updateRes = await supabase
      .from("items")
      .update({ photo_url: photoUrl })
      .eq("owner_id", userId)
      .eq("id", itemId);

    if (updateRes.error) {
      setError(updateRes.error.message);
      setBusy(false);
      return;
    }

    // 4) Return to box
    router.push(`/box/${encodeURIComponent(selectedBox.code)}`);
    router.refresh();
  }

  useEffect(() => {
    loadBoxes();
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boxLabel = (b: BoxRow) => {
    const loc = b.location?.name ? ` • ${b.location.name}` : "";
    const nm = b.name ? ` — ${b.name}` : "";
    return `${b.code}${nm}${loc}`;
  };

  return (
    <main style={{ padding: 20, paddingBottom: 110 }}>
      <h1 style={{ marginTop: 6 }}>Scan Item</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Pick a box, take a photo, then type a short name and save.
      </p>

      {error && <p style={{ color: "crimson", fontWeight: 700 }}>Error: {error}</p>}

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
          maxWidth: 720,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>Add to box</span>
          <select
            value={selectedBoxId}
            onChange={(e) => setSelectedBoxId(e.target.value)}
            disabled={busy}
          >
            <option value="">Select box…</option>
            {boxes.map((b) => (
              <option key={b.id} value={b.id}>
                {boxLabel(b)}
              </option>
            ))}
          </select>
        </label>

        <div style={{ height: 12 }} />

        {/* Camera preview */}
        <div
          style={{
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid #e5e7eb",
            background: "#000",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              maxHeight: 420,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" onClick={startCamera} disabled={busy}>
            Restart camera
          </button>

          <button type="button" onClick={captureFrame} disabled={busy}>
            Capture photo
          </button>

          <button
            type="button"
            onClick={() => filePickRef.current?.click()}
            disabled={busy}
          >
            Choose file
          </button>

          <button
            type="button"
            onClick={() => takePhotoRef.current?.click()}
            disabled={busy}
          >
            Take photo
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={filePickRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => onPickedFile(e.target.files?.[0] ?? null)}
        />

        <input
          ref={takePhotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => onPickedFile(e.target.files?.[0] ?? null)}
        />

        {/* Preview */}
        {imageDataUrl && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Photo preview</div>
            <img
              src={imageDataUrl}
              alt="Preview"
              style={{
                width: "100%",
                maxHeight: 360,
                objectFit: "cover",
                borderRadius: 18,
                border: "1px solid #e5e7eb",
              }}
            />
          </div>
        )}

        <div style={{ height: 12 }} />

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 900 }}>Item name</span>
          <input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. PC Mouse"
            disabled={busy}
          />
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Keep it short (1–3 words). Example: PC Mouse, USB Cable, Coffee Mug
          </div>
        </label>

        <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <span style={{ fontWeight: 900 }}>Quantity</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            disabled={busy}
            style={{ width: 140 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <span style={{ fontWeight: 900 }}>Description (optional)</span>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Optional notes"
            disabled={busy}
            style={{ minHeight: 90 }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" onClick={() => router.push("/boxes")} disabled={busy}>
            Cancel
          </button>

          <button
            type="button"
            onClick={saveItem}
            disabled={busy || !selectedBoxId || !name.trim() || !capturedFile}
            style={{ background: "#16a34a", color: "#fff", fontWeight: 900 }}
          >
            {busy ? "Saving…" : "Save item"}
          </button>
        </div>
      </div>
    </main>
  );
}
