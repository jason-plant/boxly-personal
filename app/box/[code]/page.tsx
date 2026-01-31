"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabaseClient";
import RequireAuth from "../../components/RequireAuth";
import EditIconButton from "../../components/EditIconButton";
import DeleteIconButton from "../../components/DeleteIconButton";
import { useUnsavedChanges } from "../../components/UnsavedChangesProvider";

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
};

type BoxMini = {
  id: string;
  code: string;
};

type LocationRow = {
  id: string;
  name: string;
};

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  quantity: number | null;
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
function getStoragePathFromPublicUrl(url: string) {
  const marker = "/item-photos/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}

export default function BoxPage() {
  const params = useParams<{ code?: string }>();
  const code = params?.code ? decodeURIComponent(String(params.code)) : "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [box, setBox] = useState<BoxRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [allBoxes, setAllBoxes] = useState<BoxMini[]>([]);

  // Locations for "create box" modal
  const [locations, setLocations] = useState<LocationRow[]>([]);

  // Photo viewer
  const [viewItem, setViewItem] = useState<ItemRow | null>(null);

  // Move mode
  const [moveMode, setMoveMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedRef = useRef<Set<string>>(new Set());
  const [bulkDestBoxId, setBulkDestBoxId] = useState("");

  // Modals
  const [newBoxOpen, setNewBoxOpen] = useState(false);
  const [newBoxName, setNewBoxName] = useState("");

  // "Create new location" inside create box modal
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newBoxLocationId, setNewBoxLocationId] = useState<string>("");

  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false);
  const confirmMoveInfoRef = useRef<{
    count: number;
    fromCode: string;
    toId: string;
    toCode: string;
    itemIds: string[];
  } | null>(null);

  // Delete item modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteItemRef = useRef<ItemRow | null>(null);
  const deleteReasonRef = useRef<"qty0" | "button">("button");

  // ✅ Edit item modal (name/desc/qty/photo replace)
  const [editItemOpen, setEditItemOpen] = useState(false);
  const editItemRef = useRef<ItemRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editQty, setEditQty] = useState<number>(0);
  const [editRemovePhoto, setEditRemovePhoto] = useState(false);


  // Photo inputs: choose OR take
  const chooseFileInputRef = useRef<HTMLInputElement | null>(null);
  const takePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [editNewPhoto, setEditNewPhoto] = useState<File | null>(null);

  const { setDirty } = useUnsavedChanges();

  useEffect(() => {
    if (!code) return;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      const boxRes = await supabase
        .from("boxes")
        .select("id, code, name, location")
        .eq("owner_id", userId)
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
        .eq("owner_id", userId)
        .eq("box_id", boxRes.data.id)
        .order("name");

      setItems(itemsRes.data ?? []);

      const boxesRes = await supabase
        .from("boxes")
        .select("id, code")
        .eq("owner_id", userId)
        .order("code");

      setAllBoxes((boxesRes.data ?? []) as BoxMini[]);

      const locRes = await supabase
        .from("locations")
        .select("id, name")
        .eq("owner_id", userId)
        .order("name");

      setLocations((locRes.data ?? []) as LocationRow[]);

      // reset move state
      setMoveMode(false);
      const empty = new Set<string>();
      setSelectedIds(empty);
      selectedRef.current = empty;
      setBulkDestBoxId("");

      // close modals
      setNewBoxOpen(false);
      setConfirmMoveOpen(false);
      setConfirmDeleteOpen(false);
      setNewBoxName("");
      setNewBoxLocationId("");
      setNewLocOpen(false);
      setNewLocName("");
      confirmMoveInfoRef.current = null;
      deleteItemRef.current = null;
      deleteReasonRef.current = "button";

      // edit modal reset
      setEditItemOpen(false);
      editItemRef.current = null;
      setEditName("");
      setEditDesc("");
      setEditQty(0);
      setEditRemovePhoto(false);
      setEditNewPhoto(null);

      setLoading(false);
    }

    load();
  }, [code]);

  async function reloadItems(boxId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from("items")
      .select("id, name, description, photo_url, quantity")
      .eq("owner_id", userId)
      .eq("box_id", boxId)
      .order("name");

    setItems(data ?? []);
  }

  /* ============= Delete ============= */

  async function deleteItemAndPhoto(item: ItemRow) {
    setBusy(true);
    setError(null);

    // delete photo (best effort)
    if (item.photo_url) {
      const path = getStoragePathFromPublicUrl(item.photo_url);
      if (path) {
        await supabase.storage.from("item-photos").remove([path]);
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setError("Not logged in.");
      setBusy(false);
      return;
    }

    const delRes = await supabase.from("items").delete().eq("owner_id", userId).eq("id", item.id);

    if (delRes.error) {
      setError(delRes.error.message);
      setBusy(false);
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== item.id));

    setSelectedIds((prev) => {
      const copy = new Set(prev);
      copy.delete(item.id);
      selectedRef.current = copy;
      return copy;
    });

    setBusy(false);
  }

  function requestDeleteItem(item: ItemRow, reason: "qty0" | "button") {
    deleteItemRef.current = item;
    deleteReasonRef.current = reason;
    setConfirmDeleteOpen(true);
  }

  /* ============= Quantity ============= */

  async function saveQuantity(itemId: string, qty: number) {
    const safeQty = Math.max(0, Math.floor(qty));
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (safeQty === 0) {
      requestDeleteItem(item, "qty0");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setError("Not logged in.");
      return;
    }

    const res = await supabase.from("items").update({ quantity: safeQty }).eq("owner_id", userId).eq("id", itemId);

    if (res.error) {
      setError(res.error.message);
      return;
    }

    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: safeQty } : i)));
  }

  /* ============= Edit Item (name/desc/qty/photo replace) ============= */

  function openEditItem(i: ItemRow) {
    setError(null);
    editItemRef.current = i;
    setEditName(i.name ?? "");
    setEditDesc(i.description ?? "");
    setEditQty(i.quantity ?? 0);
    setEditRemovePhoto(false);
    setEditNewPhoto(null);
    setEditItemOpen(true);
  }

  function onPickNewPhoto(file: File | null) {
    setEditNewPhoto(file);
    if (file) setEditRemovePhoto(false);
  }

  async function saveItemEdits() {
    const it = editItemRef.current;
    if (!it || !box) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setError("Item name is required.");
      return;
    }

    const safeQty = Math.max(0, Math.floor(Number(editQty) || 0));
    if (safeQty === 0) {
      setEditItemOpen(false);
      editItemRef.current = null;
      setEditNewPhoto(null);
      setEditRemovePhoto(false);
      requestDeleteItem(it, "qty0");
      return;
    }

    setBusy(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setError("Not logged in.");
      setBusy(false);
      return;
    }

    // Photo handling
    let newPhotoUrl: string | null = it.photo_url ?? null;
    const oldPhotoUrl = it.photo_url;

    // Remove existing photo
    if (editRemovePhoto) {
      if (oldPhotoUrl) {
        const oldPath = getStoragePathFromPublicUrl(oldPhotoUrl);
        if (oldPath) {
          await supabase.storage.from("item-photos").remove([oldPath]);
        }
      }
      newPhotoUrl = null;
    }

    // Replace with new photo (either camera or file picker)
    if (editNewPhoto) {
      // delete old if present
      if (oldPhotoUrl) {
        const oldPath = getStoragePathFromPublicUrl(oldPhotoUrl);
        if (oldPath) {
          await supabase.storage.from("item-photos").remove([oldPath]);
        }
      }

      const safeName = editNewPhoto.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${it.id}/${Date.now()}-${safeName}`;

      const uploadRes = await supabase.storage.from("item-photos").upload(path, editNewPhoto, {
        cacheControl: "3600",
        upsert: false,
        contentType: editNewPhoto.type || "image/jpeg",
      });

      if (uploadRes.error) {
        setError(uploadRes.error.message);
        setBusy(false);
        return;
      }

      const pub = supabase.storage.from("item-photos").getPublicUrl(path);
      newPhotoUrl = pub.data.publicUrl;
    }

    const updatePayload = {
      name: trimmedName,
      description: editDesc.trim() ? editDesc.trim() : null,
      quantity: safeQty,
      photo_url: newPhotoUrl,
    };

    const res = await supabase
      .from("items")
      .update(updatePayload)
      .eq("owner_id", userId)
      .eq("id", it.id)
      .select("id, name, description, photo_url, quantity")
      .single();

    if (res.error || !res.data) {
      setError(res.error?.message || "Failed to update item.");
      setBusy(false);
      return;
    }

    setItems((prev) => prev.map((x) => (x.id === it.id ? (res.data as ItemRow) : x)));

// clear dirty when edits are saved
      setDirty(false);
      setEditItemOpen(false);
    editItemRef.current = null;
    setEditNewPhoto(null);
    setEditRemovePhoto(false);
    setBusy(false);
  }

  /* ============= Move Mode ============= */

  const nextAutoCode = useMemo(() => {
    let max = 0;
    for (const b of allBoxes) {
      const n = parseBoxNumber(b.code);
      if (n !== null && n > max) max = n;
    }
    return `BOX-${pad3(max + 1)}`;
  }, [allBoxes]);

  function enterMoveMode() {
    setMoveMode(true);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setBulkDestBoxId("");
  }

  function exitMoveMode() {
    setMoveMode(false);
    const empty = new Set<string>();
    setSelectedIds(empty);
    selectedRef.current = empty;
    setBulkDestBoxId("");
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

  async function createLocationInlineForNewBox() {
    const trimmed = newLocName.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);

    const { data: sessionData, error: sErr } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (sErr || !userId) {
      setError(sErr?.message || "Not logged in.");
      setBusy(false);
      return;
    }

    const res = await supabase
      .from("locations")
      .insert({ owner_id: userId, name: trimmed })
      .select("id, name")
      .single();

    if (res.error || !res.data) {
      setError(res.error?.message || "Failed to create location.");
      setBusy(false);
      return;
    }

    setLocations((prev) => {
      const next = [...prev, res.data as LocationRow];
      next.sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });

    setNewBoxLocationId(res.data.id);
    setNewLocOpen(false);
    setNewLocName("");
    setBusy(false);
  }

  async function createNewBoxFromMove(name: string) {
    if (!name.trim()) {
      setError("Box name is required.");
      return null;
    }

    setBusy(true);
    setError(null);

    const { data: sessionData, error: sErr } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (sErr || !userId) {
      setError(sErr?.message || "Not logged in.");
      setBusy(false);
      return null;
    }

    const insertRes = await supabase
      .from("boxes")
      .insert({
        owner_id: userId,
        code: nextAutoCode,
        name: name.trim(),
        location_id: newBoxLocationId || null,
      })
      .select("id, code")
      .single();

    if (insertRes.error || !insertRes.data) {
      setError(insertRes.error?.message || "Failed to create new box.");
      setBusy(false);
      return null;
    }

    setAllBoxes((prev) => {
      const next = [...prev, { id: insertRes.data.id, code: insertRes.data.code }];
      next.sort((a, b) => a.code.localeCompare(b.code));
      return next;
    });

    setBulkDestBoxId(insertRes.data.id);

    setBusy(false);
    return insertRes.data;
  }

  async function onDestinationChange(value: string) {
    if (value === "__new__") {
      setBulkDestBoxId("");
      setNewBoxName("");
      setNewBoxLocationId("");
      setNewBoxOpen(true);
      return;
    }
    setBulkDestBoxId(value);
  }

  function requestMoveSelected() {
    if (!box) return;

    const ids = Array.from(selectedRef.current);
    if (ids.length === 0) {
      setError("Select at least one item.");
      return;
    }
    if (!bulkDestBoxId) {
      setError("Choose a destination box.");
      return;
    }

    const dest = allBoxes.find((b) => b.id === bulkDestBoxId);
    const toCode = dest?.code ?? "destination";

    confirmMoveInfoRef.current = {
      count: ids.length,
      fromCode: box.code,
      toId: bulkDestBoxId,
      toCode,
      itemIds: ids,
    };

    setConfirmMoveOpen(true);
  }

  async function confirmMoveSelected() {
    if (!box) return;

    const info = confirmMoveInfoRef.current;
    if (!info) return;

    setBusy(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setError("Not logged in.");
      setBusy(false);
      return;
    }

    const res = await supabase
      .from("items")
      .update({ box_id: info.toId })
      .eq("owner_id", userId)
      .in("id", info.itemIds);

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    setItems((prev) => prev.filter((i) => !selectedRef.current.has(i.id)));

    setConfirmMoveOpen(false);
    confirmMoveInfoRef.current = null;
    exitMoveMode();

    setBusy(false);
  }

  /* ============= QR ============= */

  async function printSingleQrLabel(boxCode: string, name?: string | null, location?: string | null) {
    const url = `${window.location.origin}/box/${encodeURIComponent(boxCode)}`;
    const qr = await QRCode.toDataURL(url, { width: 420, margin: 1 });

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <body style="font-family:Arial;padding:20px">
          <div style="width:320px;border:2px solid #000;padding:14px;border-radius:12px">
            <div style="font-size:22px;font-weight:800">${boxCode}</div>
            ${name ? `<div style="margin-top:6px">${name}</div>` : ""}
            ${location ? `<div style="margin-top:6px">Location: ${location}</div>` : ""}
            <img src="${qr}" style="width:100%;margin-top:10px" />
            <div style="font-size:10px;margin-top:10px;word-break:break-all">${url}</div>
          </div>
          <script>window.onload=()=>window.print()</script>
        </body>
      </html>
    `);
  }

  const destinationBoxes = box ? allBoxes.filter((b) => b.id !== box.id) : [];

  return (
    <RequireAuth>
      {loading ? (
        <main style={{ padding: 16 }}>
          <p>Loading…</p>
        </main>
      ) : !box ? (
        <main style={{ padding: 16 }}>
          <p>{error ?? "Box not found."}</p>
        </main>
      ) : (
        <main style={{ paddingBottom: 180 }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 14,
              boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 className="sr-only" style={{ margin: "0 0 6px 0" }}>{box.code}</h1>
                {box.name && <div style={{ fontWeight: 800 }}>{box.name}</div>}
                {box.location && <div style={{ opacity: 0.8 }}>Location: {box.location}</div>}
              </div>

              <button onClick={() => printSingleQrLabel(box.code, box.name, box.location)}>Print QR</button>
            </div>

            {error && <p style={{ color: "crimson", marginTop: 10 }}>Error: {error}</p>}
          </div>

          {moveMode && (
            <div
              style={{
                marginTop: 12,
                background: "#fff",
                border: "2px solid #111",
                borderRadius: 18,
                padding: 14,
                boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: 0 }}>Move items</h2>
                  <div style={{ opacity: 0.85 }}>Tap item cards to select. Use the sticky bar to move.</div>
                </div>

                <button type="button" onClick={exitMoveMode} disabled={busy}>
                  Done
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button type="button" onClick={selectAll} disabled={items.length === 0 || busy}>
                  Select all
                </button>
                <button type="button" onClick={clearSelected} disabled={selectedIds.size === 0 || busy}>
                  Clear
                </button>
                <div style={{ alignSelf: "center", opacity: 0.85 }}>
                  Selected: <strong>{selectedIds.size}</strong>
                </div>
              </div>
            </div>
          )}

          <h2 style={{ margin: "14px 0 8px" }}>Items</h2>

          <div style={{ display: "grid", gap: 10 }}>
            {items.map((i) => {
              const hasPhoto = Boolean(i.photo_url);
              const isSelected = selectedIds.has(i.id);

              return (
                <div
                  key={i.id}
                  onClick={() => {
                    if (moveMode) toggleSelected(i.id);
                  }}
                  style={{
                    background: "#fff",
                    border: moveMode ? (isSelected ? "2px solid #16a34a" : "2px solid #e5e7eb") : "1px solid #e5e7eb",
                    borderRadius: 18,
                    padding: 14,
                    boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
                    cursor: moveMode ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {moveMode && (
                        <div
                          aria-hidden
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            border: isSelected ? "2px solid #16a34a" : "2px solid #cbd5e1",
                            background: isSelected ? "#16a34a" : "transparent",
                            flex: "0 0 auto",
                          }}
                        />
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (moveMode) return;
                          if (hasPhoto) setViewItem(i);
                        }}
                        disabled={moveMode || !hasPhoto}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          boxShadow: "none",
                          textAlign: "left",
                          fontWeight: 900,
                          cursor: !moveMode && hasPhoto ? "pointer" : "default",
                          opacity: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        title={!moveMode && hasPhoto ? "Tap to view photo" : undefined}
                      >
                        {i.name}
                        {hasPhoto ? <span style={{ opacity: 0.6 }}>📷</span> : null}
                      </button>
                    </div>

                    {!moveMode && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <EditIconButton
                          onClick={(e: any) => {
                            e?.stopPropagation();
                            openEditItem(i);
                          }}
                          disabled={busy}
                        />

                        <DeleteIconButton
                          onClick={(e: any) => {
                            e?.stopPropagation();
                            requestDeleteItem(i, "button");
                          }}
                          disabled={busy}
                        />
                      </div>
                    )}
                  </div>

                  {i.description && <div style={{ marginTop: 8, opacity: 0.9 }}>{i.description}</div>}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveQuantity(i.id, (i.quantity ?? 0) - 1);
                      }}
                      disabled={busy || moveMode}
                    >
                      −
                    </button>

                    <input
                      type="number"
                      min={0}
                      value={i.quantity ?? 0}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setItems((prev) => prev.map((it) => (it.id === i.id ? { ...it, quantity: n } : it)));
                      }}
                      onBlur={(e) => {
                        if (moveMode) return;
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) saveQuantity(i.id, n);
                      }}
                      style={{ width: 110 }}
                      disabled={busy || moveMode}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveQuantity(i.id, (i.quantity ?? 0) + 1);
                      }}
                      disabled={busy || moveMode}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <a
            href={`/box/${encodeURIComponent(box.code)}/new-item`}
            aria-label="Add item"
            style={{
              position: "fixed",
              right: 18,
              bottom: 18,
              width: 58,
              height: 58,
              borderRadius: 999,
              background: "#111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
              zIndex: 2000,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </a>

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
              boxShadow: "0 14px 30px rgba(0,0,0,0.2)",
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

              <div style={{ flex: 1, minWidth: 160 }}>
                <select
                  value={bulkDestBoxId}
                  onChange={(e) => onDestinationChange(e.target.value)}
                  disabled={busy}
                  style={{ width: "100%" }}
                >
                  <option value="">Destination…</option>
                  <option value="__new__">{`➕ Create new box (${nextAutoCode})…`}</option>
                  {destinationBoxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  const ids = Array.from(selectedRef.current);
                  if (ids.length === 0) {
                    setError("Select at least one item.");
                    return;
                  }
                  if (!bulkDestBoxId) {
                    setError("Choose a destination box.");
                    return;
                  }
                  const dest = allBoxes.find((b) => b.id === bulkDestBoxId);
                  confirmMoveInfoRef.current = {
                    count: ids.length,
                    fromCode: box.code,
                    toId: bulkDestBoxId,
                    toCode: dest?.code ?? "destination",
                    itemIds: ids,
                  };
                  setConfirmMoveOpen(true);
                }}
                disabled={busy || selectedIds.size === 0 || !bulkDestBoxId}
                style={{
                  background: "#111",
                  color: "#fff",
                  fontWeight: 900,
                  padding: "10px 16px",
                  borderRadius: 14,
                }}
              >
                {busy ? "Moving…" : "Move"}
              </button>
            </div>
          )}

          {!moveMode && viewItem && viewItem.photo_url && (
            <div
              onClick={() => setViewItem(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3000,
                padding: 12,
              }}
            >
              <img
                src={viewItem.photo_url}
                alt={viewItem.name}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  borderRadius: 16,
                }}
              />
            </div>
          )}

          {/* ✅ Edit Item Modal (with Take Photo + Choose File) */}
          <Modal
            open={editItemOpen}
            title="Edit item"
            onClose={() => {
              if (busy) return;
              setEditItemOpen(false);
              editItemRef.current = null;
              setEditNewPhoto(null);
              setEditRemovePhoto(false);
              if (chooseFileInputRef.current) chooseFileInputRef.current.value = "";
              if (takePhotoInputRef.current) takePhotoInputRef.current.value = "";
            }}
          >
            <p style={{ marginTop: 0, opacity: 0.85 }}>
              Update name/description/quantity and replace (or remove) the photo.
            </p>

            {error && <p style={{ color: "crimson", margin: 0 }}>Error: {error}</p>}

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Name</span>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Item name" autoFocus disabled={busy} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Description</span>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Optional description"
                disabled={busy}
                style={{ minHeight: 90 }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Quantity</span>
              <input type="number" min={0} value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} disabled={busy} />
              <div style={{ opacity: 0.7, fontSize: 13 }}>Setting quantity to 0 will ask to delete the item.</div>
            </label>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Photo</div>

              {editItemRef.current?.photo_url && !editRemovePhoto && !editNewPhoto && (
                <img
                  src={editItemRef.current.photo_url}
                  alt="Current"
                  style={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                  }}
                />
              )}

              {/* Hidden inputs */}
              <input
                ref={chooseFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => onPickNewPhoto(e.target.files?.[0] ?? null)}
                disabled={busy}
              />

              <input
                ref={takePhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => onPickNewPhoto(e.target.files?.[0] ?? null)}
                disabled={busy}
              />

              {/* Buttons: choose vs take */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => chooseFileInputRef.current?.click()}
                  disabled={busy}
                  style={{
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    borderRadius: 16,
                    padding: "10px 14px",
                    fontWeight: 900,
                  }}
                >
                  Choose file
                </button>

                <button
                  type="button"
                  onClick={() => takePhotoInputRef.current?.click()}
                  disabled={busy}
                  style={{
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    borderRadius: 16,
                    padding: "10px 14px",
                    fontWeight: 900,
                  }}
                >
                  Take photo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditRemovePhoto((v) => !v);
                    if (!editRemovePhoto) {
                      setEditNewPhoto(null);
                      if (chooseFileInputRef.current) chooseFileInputRef.current.value = "";
                      if (takePhotoInputRef.current) takePhotoInputRef.current.value = "";
                    }
                  }}
                  disabled={busy || !editItemRef.current?.photo_url}
                  style={{
                    border: "1px solid rgba(239,68,68,0.45)",
                    color: "#b91c1c",
                    background: "#fff",
                    fontWeight: 900,
                    borderRadius: 16,
                    padding: "10px 14px",
                  }}
                >
                  {editRemovePhoto ? "Undo remove photo" : "Remove photo"}
                </button>
              </div>

              {editNewPhoto && (
                <div style={{ opacity: 0.85, fontSize: 13 }}>
                  Selected: <strong>{editNewPhoto.name}</strong>
                </div>
              )}
              {editRemovePhoto && <div style={{ opacity: 0.85, fontSize: 13 }}>Photo will be removed when you save.</div>}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  setDirty(false);
                  setEditItemOpen(false);
                  editItemRef.current = null;
                  setEditNewPhoto(null);
                  setEditRemovePhoto(false);
                  if (chooseFileInputRef.current) chooseFileInputRef.current.value = "";
                  if (takePhotoInputRef.current) takePhotoInputRef.current.value = "";
                }}
                disabled={busy}
              >
                Cancel
              </button>

              <button type="button" onClick={saveItemEdits} disabled={busy || !editName.trim()} style={{ background: "#111", color: "#fff" }}>
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </Modal>

          {/* Delete modal */}
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
              {deleteReasonRef.current === "qty0" ? (
                <>
                  Quantity is 0. Delete <strong>{deleteItemRef.current?.name ?? "this item"}</strong> (and remove photo)?
                </>
              ) : (
                <>
                  Delete <strong>{deleteItemRef.current?.name ?? "this item"}</strong> (and remove photo)?
                </>
              )}
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

              <button
                type="button"
                onClick={async () => {
                  const item = deleteItemRef.current;
                  if (!item) return;
                  setConfirmDeleteOpen(false);
                  deleteItemRef.current = null;
                  await deleteItemAndPhoto(item);
                }}
                disabled={busy}
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {busy ? "Deleting..." : "Delete"}
              </button>
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
