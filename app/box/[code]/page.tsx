"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabaseClient";
import RequireAuth from "../../components/RequireAuth";
import DeleteIconButton from "../../components/DeleteIconButton";

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
  quantity: number | null;
  photo_url: string | null;
  created_at?: string;
};

type BoxLookup = {
  id: string;
  code: string;
  name: string | null;
};

export default function BoxPage() {
  return (
    <RequireAuth>
      <BoxPageInner />
    </RequireAuth>
  );
}

function BoxPageInner() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [box, setBox] = useState<BoxRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);

  // QR
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Create item modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState<number>(1);
  const [newDesc, setNewDesc] = useState("");
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const newPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Edit item modal
  const [editOpen, setEditOpen] = useState(false);
  const editItemRef = useRef<ItemRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState<number>(1);
  const [editDesc, setEditDesc] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Move mode
  const [moveMode, setMoveMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedRef = useRef<Set<string>>(new Set());

  // box lookup for destination
  const [boxLookup, setBoxLookup] = useState<BoxLookup[]>([]);
  const [destBoxId, setDestBoxId] = useState<string>("");

  // confirm move modal
  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false);
  const confirmMoveInfoRef = useRef<{
    count: number;
    fromId: string;
    fromCode: string;
    toId: string;
    toCode: string;
    itemIds: string[];
  } | null>(null);

  // confirm delete (when qty hits 0)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteItemRef = useRef<ItemRow | null>(null);

  /* ============= Load box + items ============= */

  async function loadBoxAndItems() {
    setLoading(true);
    setError(null);

    // box by code
    const boxRes = await supabase
      .from("boxes")
      .select("id, code, name, location:locations(name)")
      .eq("code", code)
      .single();

    if (boxRes.error || !boxRes.data) {
      setError(boxRes.error?.message || "Box not found.");
      setBox(null);
      setItems([]);
      setLoading(false);
      return;
    }

    const b = boxRes.data as any;
    const mappedBox: BoxRow = {
      id: b.id,
      code: b.code,
      name: b.name ?? null,
      location: b.location?.name ?? null,
    };

    setBox(mappedBox);

    // items in box
    await reloadItems(mappedBox.id);

    // QR for code
    try {
      const dataUrl = await QRCode.toDataURL(mappedBox.code, { margin: 1, width: 220 });
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl("");
    }

    setLoading(false);
  }

  async function reloadItems(boxId: string) {
    const itemsRes = await supabase
      .from("items")
      .select("id, name, description, quantity, photo_url, created_at")
      .eq("box_id", boxId)
      .order("created_at", { ascending: false });

    if (itemsRes.error) {
      setError(itemsRes.error.message);
      setItems([]);
      return;
    }
    setItems((itemsRes.data ?? []) as ItemRow[]);
  }

  useEffect(() => {
    loadBoxAndItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /* ============= Helpers ============= */

  function safeFileName(name: string) {
    return name.replace(/[^\w.\-]+/g, "_");
  }

  function getStoragePathFromPublicUrl(url: string) {
    const marker = "/item-photos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  }

  async function uploadItemPhoto(userId: string, itemId: string, file: File) {
    const safe = safeFileName(file.name || "photo.jpg");
    const path = `${userId}/${itemId}/${Date.now()}-${safe}`;

    const uploadRes = await supabase.storage.from("item-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (uploadRes.error) throw new Error(uploadRes.error.message);

    const pub = supabase.storage.from("item-photos").getPublicUrl(path);
    return pub.data.publicUrl;
  }

  /* ============= Add item ============= */

  function openAdd() {
    setError(null);
    setNewName("");
    setNewQty(1);
    setNewDesc("");
    setNewPhotoFile(null);
    if (newPhotoInputRef.current) newPhotoInputRef.current.value = "";
    setAddOpen(true);
  }

  async function saveNewItem() {
    if (!box) return;
    const name = newName.trim();
    if (!name) {
      setError("Item name is required.");
      return;
    }
    if (!newPhotoFile) {
      setError("Please add a photo.");
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

    // 1) create item first
    const insertRes = await supabase
      .from("items")
      .insert({
        owner_id: userId,
        box_id: box.id,
        name,
        description: newDesc.trim() ? newDesc.trim() : null,
        quantity: Math.max(1, Math.floor(Number(newQty) || 1)),
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

    // 2) upload photo
    let photoUrl = "";
    try {
      photoUrl = await uploadItemPhoto(userId, itemId, newPhotoFile);
    } catch (e: any) {
      // rollback
      await supabase.from("items").delete().eq("owner_id", userId).eq("id", itemId);
      setError(e?.message || "Photo upload failed.");
      setBusy(false);
      return;
    }

    // 3) update photo_url
    const upRes = await supabase.from("items").update({ photo_url: photoUrl }).eq("owner_id", userId).eq("id", itemId);
    if (upRes.error) {
      setError(upRes.error.message);
      setBusy(false);
      return;
    }

    setAddOpen(false);
    setBusy(false);
    await reloadItems(box.id);
  }

  /* ============= Edit item ============= */

  function openEdit(item: ItemRow) {
    setError(null);
    editItemRef.current = item;
    setEditName(item.name);
    setEditQty(item.quantity ?? 1);
    setEditDesc(item.description ?? "");
    setEditPhotoFile(null);
    if (editPhotoInputRef.current) editPhotoInputRef.current.value = "";
    setEditOpen(true);
  }

  async function saveEditItem() {
    const item = editItemRef.current;
    if (!item || !box) return;

    const name = editName.trim();
    if (!name) {
      setError("Item name is required.");
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

    // optional: replace photo
    let newPhotoUrl: string | null = null;

    if (editPhotoFile) {
      // remove old
      if (item.photo_url) {
        const oldPath = getStoragePathFromPublicUrl(item.photo_url);
        if (oldPath) await supabase.storage.from("item-photos").remove([oldPath]);
      }
      try {
        newPhotoUrl = await uploadItemPhoto(userId, item.id, editPhotoFile);
      } catch (e: any) {
        setError(e?.message || "Photo upload failed.");
        setBusy(false);
        return;
      }
    }

    const updateRes = await supabase
      .from("items")
      .update({
        name,
        description: editDesc.trim() ? editDesc.trim() : null,
        quantity: Math.max(0, Math.floor(Number(editQty) || 0)),
        ...(newPhotoUrl ? { photo_url: newPhotoUrl } : {}),
      })
      .eq("owner_id", userId)
      .eq("id", item.id);

    if (updateRes.error) {
      setError(updateRes.error.message);
      setBusy(false);
      return;
    }

    setEditOpen(false);
    editItemRef.current = null;
    setBusy(false);
    await reloadItems(box.id);
  }

  /* ============= Quantity & Delete ============= */

  async function updateQty(item: ItemRow, newQtyVal: number) {
    if (!box) return;

    const qty = Math.max(0, Math.floor(Number(newQtyVal) || 0));

    // if hits 0, show confirm delete modal instead of saving 0
    if (qty === 0) {
      deleteItemRef.current = item;
      setConfirmDeleteOpen(true);
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

    const res = await supabase.from("items").update({ quantity: qty }).eq("owner_id", userId).eq("id", item.id);
    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    await reloadItems(box.id);
  }

  async function deleteItemAndPhoto(item: ItemRow) {
    if (!box) return;

    setBusy(true);
    setError(null);

    // best-effort delete photo
    if (item.photo_url) {
      const path = getStoragePathFromPublicUrl(item.photo_url);
      if (path) {
        await supabase.storage.from("item-photos").remove([path]);
      }
    }

    const res = await supabase.from("items").delete().eq("id", item.id);
    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    await reloadItems(box.id);
  }

  /* ============= Move mode (items) ============= */

  async function loadBoxLookup() {
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authErr || !userId) {
      setError(authErr?.message || "Not logged in.");
      return;
    }

    const res = await supabase.from("boxes").select("id, code, name").eq("owner_id", userId).order("code");
    if (res.error) {
      setError(res.error.message);
      setBoxLookup([]);
      return;
    }
    setBoxLookup((res.data ?? []) as BoxLookup[]);
  }

  function enterMoveMode() {
    setMoveMode(true);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setDestBoxId("");
    setError(null);
    loadBoxLookup();
  }

  function exitMoveMode() {
    setMoveMode(false);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setDestBoxId("");
    setError(null);
  }

  function toggleSelected(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      selectedRef.current = next;
      return next;
    });
  }

  function selectAll() {
    const all = new Set(items.map((i) => i.id));
    setSelectedIds(all);
    selectedRef.current = all;
  }

  function clearSelected() {
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
  }

  const destBoxLabel = useMemo(() => {
    const d = boxLookup.find((b) => b.id === destBoxId);
    if (!d) return "";
    return d.name ? `${d.code} — ${d.name}` : d.code;
  }, [destBoxId, boxLookup]);

  function requestMoveSelected() {
    if (!box) return;

    const ids = Array.from(selectedRef.current);
    if (ids.length === 0) {
      setError("Select at least one item.");
      return;
    }
    if (!destBoxId) {
      setError("Choose a destination box.");
      return;
    }
    if (destBoxId === box.id) {
      setError("Destination must be a different box.");
      return;
    }

    const to = boxLookup.find((b) => b.id === destBoxId);
    if (!to) {
      setError("Destination box not found.");
      return;
    }

    confirmMoveInfoRef.current = {
      count: ids.length,
      fromId: box.id,
      fromCode: box.code,
      toId: to.id,
      toCode: to.code,
      itemIds: ids,
    };

    setConfirmMoveOpen(true);
  }

  async function confirmMoveSelected() {
    const info = confirmMoveInfoRef.current;
    if (!info) return;

    setBusy(true);
    setError(null);

    const res = await supabase.from("items").update({ box_id: info.toId }).in("id", info.itemIds);

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    // refresh this box's items
    await reloadItems(info.fromId);

    // reset move mode selection
    setConfirmMoveOpen(false);
    confirmMoveInfoRef.current = null;
    setDestBoxId("");
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;

    setBusy(false);
  }

  const totalItems = useMemo(() => {
    return items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
  }, [items]);

  const totalUnique = items.length;

  return (
    <RequireAuth>
      {loading ? (
        <main style={{ padding: 20 }}>
          <p>Loading…</p>
        </main>
      ) : !box ? (
        <main style={{ padding: 20 }}>
          <h1>Box not found</h1>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </main>
      ) : (
        <main style={{ paddingBottom: moveMode ? 180 : 110 }}>
          <h1 style={{ marginTop: 6 }}>
            {box.code}
            {box.name ? <span style={{ opacity: 0.65, fontWeight: 700 }}> — {box.name}</span> : null}
          </h1>

          <div style={{ opacity: 0.85, marginTop: -6 }}>
            {box.location ? box.location : "No location"} • <strong>{totalUnique}</strong> item types •{" "}
            <strong>{totalItems}</strong> total items
          </div>

          {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

          {/* QR */}
          {qrDataUrl && (
            <div
              style={{
                marginTop: 12,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 14,
                boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
                maxWidth: 360,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Box QR</div>
              <img src={qrDataUrl} alt="QR code" style={{ width: "100%", borderRadius: 12 }} />
            </div>
          )}

          {/* Move mode panel */}
          {moveMode && (
            <div
              style={{
                background: "#fff",
                border: "2px solid #111",
                borderRadius: 18,
                padding: 14,
                boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
                marginBottom: 12,
                marginTop: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: 0 }}>Move items</h2>
                  <div style={{ opacity: 0.85 }}>Tap items to select. Use the sticky bar to move.</div>
                </div>

                <button type="button" onClick={exitMoveMode} disabled={busy}>
                  Done
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button type="button" onClick={selectAll} disabled={busy || items.length === 0}>
                  Select all
                </button>
                <button type="button" onClick={clearSelected} disabled={busy || selectedIds.size === 0}>
                  Clear
                </button>
                <div style={{ alignSelf: "center", opacity: 0.85 }}>
                  Selected: <strong>{selectedIds.size}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!moveMode) return;
                    toggleSelected(item.id);
                  }}
                  style={{
                    background: "#fff",
                    border: moveMode ? (isSelected ? "2px solid #16a34a" : "2px solid #e5e7eb") : "1px solid #e5e7eb",
                    borderRadius: 18,
                    padding: 14,
                    boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
                    display: "grid",
                    gap: 10,
                    cursor: moveMode ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {/* photo */}
                      <div
                        style={{
                          width: 74,
                          height: 74,
                          borderRadius: 16,
                          background: "#f3f4f6",
                          border: "1px solid #e5e7eb",
                          overflow: "hidden",
                          flex: "0 0 auto",
                        }}
                      >
                        {item.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.photo_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : null}
                      </div>

                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 900 }}>{item.name}</div>
                        {item.description ? <div style={{ opacity: 0.8 }}>{item.description}</div> : null}
                        <div style={{ opacity: 0.8, fontWeight: 800 }}>
                          Qty: <strong>{item.quantity ?? 0}</strong>
                        </div>
                      </div>
                    </div>

                    {!moveMode && (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => openEdit(item)} disabled={busy}>
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => updateQty(item, (item.quantity ?? 1) + 1)}
                          disabled={busy}
                          style={{ background: "#111", color: "#fff" }}
                        >
                          +1
                        </button>

                        <button
                          type="button"
                          onClick={() => updateQty(item, Math.max(0, (item.quantity ?? 1) - 1))}
                          disabled={busy}
                        >
                          -1
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add item FAB */}
          <button
            type="button"
            onClick={openAdd}
            aria-label="Add item"
            style={{
              position: "fixed",
              right: 18,
              bottom: 18,
              width: 58,
              height: 58,
              borderRadius: 999,
              background: "#111",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
              zIndex: 2000,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Move items FAB */}
          <button
            type="button"
            onClick={() => (moveMode ? exitMoveMode() : enterMoveMode())}
            aria-label="Move items"
            style={{
              position: "fixed",
              right: 18,
              bottom: 86,
              width: 58,
              height: 58,
              borderRadius: 999,
              background: moveMode ? "#16a34a" : "#ffffff",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 14px 30px rgba(0,0,0,0.20)",
              zIndex: 2000,
              cursor: "pointer",
            }}
            title={moveMode ? "Exit move mode" : "Move items"}
            disabled={busy}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={moveMode ? "white" : "#111"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6.5" width="7" height="7" rx="1.5" />
              <rect x="14" y="10.5" width="7" height="7" rx="1.5" />
              <path d="M7 5.5c2.5-2 6.5-2 9 0" />
              <path d="M16 5.5h-3" />
              <path d="M17 5.5v3" />
              <path d="M17 18.5c-2.5 2-6.5 2-9 0" />
              <path d="M7 18.5h3" />
              <path d="M7 18.5v-3" />
            </svg>
          </button>

          {/* Sticky Move Bar */}
          {moveMode && (
            <div
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "12px 14px calc(env(safe-area-inset-bottom) + 12px)",
                background: "#ffffff",
                borderTop: "1px solid #e5e7eb",
                boxShadow: "0 -10px 30px rgba(0,0,0,0.15)",
                zIndex: 3500,
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 900 }}>Selected: {selectedIds.size}</div>

              <div style={{ flex: 1, minWidth: 190 }}>
                <select value={destBoxId} onChange={(e) => setDestBoxId(e.target.value)} disabled={busy} style={{ width: "100%" }}>
                  <option value="">Destination box…</option>
                  {boxLookup
                    .filter((b) => b.id !== box.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name ? `${b.code} — ${b.name}` : b.code}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                onClick={requestMoveSelected}
                disabled={busy || selectedIds.size === 0 || !destBoxId}
                style={{
                  background: "#111",
                  color: "#fff",
                  fontWeight: 900,
                  padding: "10px 16px",
                  borderRadius: 14,
                }}
              >
                Move
              </button>
            </div>
          )}

          {/* Add item modal */}
          <Modal
            open={addOpen}
            title="Add item"
            onClose={() => {
              if (busy) return;
              setAddOpen(false);
            }}
          >
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Item name" autoFocus />
            <input type="number" min={1} value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} placeholder="Quantity" />
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" style={{ minHeight: 90 }} />

            <input
              ref={newPhotoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setNewPhotoFile(e.target.files?.[0] ?? null)}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setAddOpen(false)} disabled={busy}>
                Cancel
              </button>

              <button
                type="button"
                onClick={saveNewItem}
                disabled={busy || !newName.trim() || !newPhotoFile}
                style={{ background: "#111", color: "#fff" }}
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </Modal>

          {/* Edit item modal */}
          <Modal
            open={editOpen}
            title="Edit item"
            onClose={() => {
              if (busy) return;
              setEditOpen(false);
              editItemRef.current = null;
            }}
          >
            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Item name" autoFocus />
            <input type="number" min={0} value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} placeholder="Quantity" />
            <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description (optional)" style={{ minHeight: 90 }} />

            <input
              ref={editPhotoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setEditPhotoFile(e.target.files?.[0] ?? null)}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  setEditOpen(false);
                  editItemRef.current = null;
                }}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveEditItem}
                disabled={busy || !editName.trim()}
                style={{ background: "#111", color: "#fff" }}
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </Modal>

          <Modal
            open={confirmMoveOpen}
            title="Confirm move"
            onClose={() => {
              if (busy) return;
              setConfirmMoveOpen(false);
              confirmMoveInfoRef.current = null;
            }}
          >
            {(() => {
              const info = confirmMoveInfoRef.current;
              if (!info) return <p>Missing move info.</p>;

              return (
                <>
                  <p style={{ marginTop: 0 }}>
                    Move <strong>{info.count}</strong> item(s) from <strong>{info.fromCode}</strong> to{" "}
                    <strong>{info.toCode}</strong>?
                  </p>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (busy) return;
                        setConfirmMoveOpen(false);
                        confirmMoveInfoRef.current = null;
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </button>

                    <button type="button" onClick={confirmMoveSelected} disabled={busy} style={{ background: "#111", color: "#fff" }}>
                      {busy ? "Moving..." : "Yes, move"}
                    </button>
                  </div>
                </>
              );
            })()}
          </Modal>

          <Modal
            open={confirmDeleteOpen}
            title="Delete item?"
            onClose={() => {
              if (busy) return;
              setConfirmDeleteOpen(false);
              deleteItemRef.current = null;
            }}
          >
            <p style={{ marginTop: 0 }}>
              Quantity is 0. Delete <strong>{deleteItemRef.current?.name ?? "this item"}</strong> (and remove photo)?
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  setConfirmDeleteOpen(false);
                  deleteItemRef.current = null;
                  if (box) reloadItems(box.id);
                }}
                disabled={busy}
              >
                Cancel
              </button>

              {/* ✅ confirm delete as icon */}
              <DeleteIconButton
                title="Confirm delete"
                disabled={busy}
                variant="solid"
                onClick={async () => {
                  const item = deleteItemRef.current;
                  if (!item) return;
                  setConfirmDeleteOpen(false);
                  deleteItemRef.current = null;
                  await deleteItemAndPhoto(item);
                }}
              />
            </div>
          </Modal>
        </main>
      )}
    </RequireAuth>
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