"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import QRCode from "qrcode";

type Box = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
};

type Item = {
  id: string;
  name: string;
  description: string | null;
  quantity: number | null;
  photo_url: string | null;
};

export default function BoxPage() {
  const params = useParams();
  const code = params.code as string;

  const [box, setBox] = useState<Box | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState<number | "">("");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: boxData } = await supabase
        .from("boxes")
        .select("*")
        .eq("code", code)
        .single();

      setBox(boxData ?? null);

      if (boxData) {
        const { data: itemsData } = await supabase
          .from("items")
          .select("*")
          .eq("box_id", boxData.id)
          .order("name");

        setItems(itemsData ?? []);
      }

      setLoading(false);
    }

    load();
  }, [code]);

  async function addItem() {
    if (!box || !newName.trim()) return;

    const { data } = await supabase
      .from("items")
      .insert({
        box_id: box.id,
        name: newName,
        description: newDesc || null,
        quantity: newQty === "" ? null : newQty,
      })
      .select()
      .single();

    if (data) {
      setItems((prev) => [...prev, data]);
      setNewName("");
      setNewDesc("");
      setNewQty("");
    }
  }

  async function uploadPhoto(itemId: string, file: File) {
    const ext = file.name.split(".").pop();
    const filePath = `${itemId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("item-photos")
      .getPublicUrl(filePath);

    await supabase
      .from("items")
      .update({ photo_url: data.publicUrl })
      .eq("id", itemId);

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, photo_url: data.publicUrl } : i
      )
    );
  }

  // ✅ SINGLE QR PRINT FUNCTION (CORRECTLY PLACED)
  async function printSingleQrLabel(
    boxCode: string,
    name?: string | null,
    location?: string | null
  ) {
    const url = `${window.location.origin}/box/${encodeURIComponent(boxCode)}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 420 });

    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) {
      alert("Popup blocked. Please allow popups to print the label.");
      return;
    }

    w.document.open();
    w.document.write(`
      <html>
        <head>
          <title>${boxCode} QR</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .label {
              width: 320px;
              border: 2px solid #000;
              padding: 14px;
            }
            .code { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
            .meta { font-size: 12px; margin-bottom: 10px; }
            img { width: 100%; display: block; }
            .url { font-size: 10px; margin-top: 8px; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="code">${boxCode}</div>
            ${name ? `<div class="meta">${name}</div>` : ""}
            ${location ? `<div class="meta">Location: ${location}</div>` : ""}
            <img src="${qrDataUrl}" />
            <div class="url">${url}</div>
          </div>
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `);
    w.document.close();
  }

  if (loading) return <p>Loading…</p>;
  if (!box) return <p>Box not found.</p>;

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>{box.code}</h1>
      {box.name && <p><strong>{box.name}</strong></p>}
      {box.location && <p>Location: {box.location}</p>}

      {/* ✅ PRINT BUTTON */}
      <button
        type="button"
        onClick={() => printSingleQrLabel(box.code, box.name, box.location)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #444",
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        Print QR label for this box
      </button>

      <hr />

      <h2>Add Item</h2>
      <input
        placeholder="Name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
      />
      <br />
      <input
        placeholder="Description"
        value={newDesc}
        onChange={(e) => setNewDesc(e.target.value)}
      />
      <br />
      <input
        type="number"
        placeholder="Qty"
        value={newQty}
        onChange={(e) => setNewQty(e.target.value === "" ? "" : Number(e.target.value))}
      />
      <br />
      <button onClick={addItem}>Add</button>

      <hr />

      <ul>
        {items.map((i) => (
          <li key={i.id} style={{ marginBottom: 12 }}>
            <strong>{i.name}</strong>
            {i.quantity ? ` (x${i.quantity})` : ""}
            {i.description && <div>{i.description}</div>}

            {i.photo_url && (
              <img
                src={i.photo_url}
                alt={i.name}
                style={{ width: 120, display: "block", marginTop: 6 }}
              />
            )}

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  uploadPhoto(i.id, e.target.files[0]);
                }
              }}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
