"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "../../../lib/supabaseClient";

/* ================= TYPES ================= */

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
};

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  quantity: number | null;
};

/* ================= PAGE ================= */

export default function BoxPage() {
  const params = useParams<{ code?: string }>();
  const code = params?.code ? decodeURIComponent(String(params.code)) : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [box, setBox] = useState<BoxRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState(1);

  // 🔍 full screen viewer state
  const [viewItem, setViewItem] = useState<ItemRow | null>(null);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (!code) return;

    async function load() {
      setLoading(true);
      setError(null);

      const boxRes = await supabase
        .from("boxes")
        .select("id, code, name, location")
        .eq("code", code)
        .maybeSingle();

      if (!boxRes.data || boxRes.error) {
        setError("Box not found");
        setLoading(false);
        return;
      }

      setBox(boxRes.data);

      const itemsRes = await supabase
        .from("items")
        .select("id, name, description, photo_url, quantity")
        .eq("box_id", boxRes.data.id)
        .order("name");

      setItems(itemsRes.data ?? []);
      setLoading(false);
    }

    load();
  }, [code]);

  async function reloadItems(boxId: string) {
    const { data } = await supabase
      .from("items")
      .select("id, name, description, photo_url, quantity")
      .eq("box_id", boxId)
      .order("name");

    setItems(data ?? []);
  }

  /* ================= ADD ITEM ================= */

  async function addItem() {
    if (!box || !newName.trim()) return;

    const { error } = await supabase.from("items").insert({
      box_id: box.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
      quantity: newQty,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNewName("");
    setNewDesc("");
    setNewQty(1);
    await reloadItems(box.id);
  }

  /* ================= DELETE HELPERS ================= */

  function getStoragePathFromPublicUrl(url: string) {
    const marker = "/item-photos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  }

  async function deleteItemAndPhoto(item: ItemRow) {
    if (item.photo_url) {
      const path = getStoragePathFromPublicUrl(item.photo_url);
      if (path) {
        await supabase.storage.from("item-photos").remove([path]);
      }
    }

    await supabase.from("items").delete().eq("id", item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  /* ================= SAVE QUANTITY ================= */

  async function saveQuantity(itemId: string, qty: number) {
    const safeQty = Math.max(0, Math.floor(qty));
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (safeQty === 0) {
      const ok = window.confirm(
        `Quantity is 0.\n\nDelete "${item.name}" from this box?`
      );
      if (ok) {
        await deleteItemAndPhoto(item);
      } else if (box) {
        await reloadItems(box.id);
      }
      return;
    }

    await supabase
      .from("items")
      .update({ quantity: safeQty })
      .eq("id", itemId);

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, quantity: safeQty } : i
      )
    );
  }

  /* ================= PHOTO UPLOAD ================= */

  async function uploadPhoto(itemId: string, file: File) {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${itemId}-${Date.now()}.${ext}`;

    await supabase.storage
      .from("item-photos")
      .upload(fileName, file, { upsert: true });

    const publicUrl = supabase.storage
      .from("item-photos")
      .getPublicUrl(fileName).data.publicUrl;

    await supabase
      .from("items")
      .update({ photo_url: publicUrl })
      .eq("id", itemId);

    if (box) await reloadItems(box.id);
  }

  /* ================= PRINT QR ================= */

  async function printSingleQrLabel(
    boxCode: string,
    name?: string | null,
    location?: string | null
  ) {
    const url = `${window.location.origin}/box/${encodeURIComponent(boxCode)}`;
    const qr = await QRCode.toDataURL(url, { width: 420 });

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <body style="font-family:Arial;padding:20px">
          <div style="width:320px;border:2px solid #000;padding:14px">
            <div style="font-size:22px;font-weight:800">${boxCode}</div>
            ${name ? `<div>${name}</div>` : ""}
            ${location ? `<div>Location: ${location}</div>` : ""}
            <img src="${qr}" style="width:100%" />
            <div style="font-size:10px">${url}</div>
          </div>
          <script>window.onload=()=>window.print()</script>
        </body>
      </html>
    `);
  }

  /* ================= RENDER ================= */

  if (loading) return <p>Loading…</p>;
  if (!box) return <p>Box not found.</p>;

  return (
    <main style={{ padding: 20 }}>
      <h1>{box.code}</h1>
      {box.name && <strong>{box.name}</strong>}
      {box.location && <div>Location: {box.location}</div>}

      <button onClick={() => printSingleQrLabel(box.code, box.name, box.location)}>
        Print QR label
      </button>

      <hr />

      <h2>Add Item</h2>
      <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
      <input placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
      <input type="number" min={1} value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} />
      <button onClick={addItem}>Add</button>

      <hr />

      <h2>Items</h2>

      <ul>
        {items.map((i) => (
          <li key={i.id} style={{ marginBottom: 20 }}>
            <strong>{i.name}</strong>

            {/* Quantity editor */}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={() =>
                setItems(prev =>
                  prev.map(it =>
                    it.id === i.id
                      ? { ...it, quantity: Math.max(0, (it.quantity ?? 0) - 1) }
                      : it
                  )
                )
              }>−</button>

              <input
                type="number"
                min={0}
                value={i.quantity ?? 0}
                onChange={(e) =>
                  setItems(prev =>
                    prev.map(it =>
                      it.id === i.id
                        ? { ...it, quantity: Number(e.target.value) }
                        : it
                    )
                  )
                }
                style={{ width: 80 }}
              />

              <button onClick={() =>
                setItems(prev =>
                  prev.map(it =>
                    it.id === i.id
                      ? { ...it, quantity: (it.quantity ?? 0) + 1 }
                      : it
                  )
                )
              }>+</button>

              <button onClick={() => saveQuantity(i.id, i.quantity ?? 0)}>
                Save
              </button>
            </div>

            {i.description && <div>{i.description}</div>}

            {/* Show item button */}
            {i.photo_url && (
              <button
                style={{ marginTop: 8 }}
                onClick={() => setViewItem(i)}
              >
                Show item
              </button>
            )}

            {/* Photo upload buttons */}
            <div style={{ marginTop: 8 }}>
              <input
                id={`cam-${i.id}`}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => e.target.files && uploadPhoto(i.id, e.target.files[0])}
              />
              <input
                id={`file-${i.id}`}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => e.target.files && uploadPhoto(i.id, e.target.files[0])}
              />
              <button onClick={() => document.getElementById(`cam-${i.id}`)?.click()}>
                Take photo
              </button>
              <button onClick={() => document.getElementById(`file-${i.id}`)?.click()}>
                Choose file
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* FULL SCREEN VIEWER */}
      {viewItem && viewItem.photo_url && (
        <div
          onClick={() => setViewItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <img
            src={viewItem.photo_url}
            alt={viewItem.name}
            style={{
              maxWidth: "95%",
              maxHeight: "95%",
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </main>
  );
}
