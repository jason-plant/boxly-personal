"use client";

import React, { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Modal from "./Modal";

export default function HelpButton() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  const meta = useMemo(() => {
    if (pathname === "/" || pathname === "/locations")
      return { title: "Locations", content: (
        <>
          <p>Overview of locations and how to manage them.</p>
          <ul>
            <li>Create a new location with <strong>New</strong>.</li>
            <li>Edit or delete a location using the edit/delete buttons.</li>
            <li>Click a location to view its boxes and manage them.</li>
          </ul>
        </>
      ) };

    if (pathname.startsWith("/locations/"))
      return { title: "Location", content: (
        <>
          <p>Manage boxes within this location.</p>
          <ul>
            <li>Add new boxes using <strong>New</strong>.</li>
            <li>Select boxes to move or bulk actions.</li>
            <li>Use the edit/delete buttons on each box card to manage details.</li>
          </ul>
        </>
      ) };

    if (pathname.startsWith("/boxes"))
      return { title: "Boxes", content: (
        <>
          <p>Box list and quick actions.</p>
          <ul>
            <li>Open a box to view its items and edit details.</li>
            <li>Use Edit/Delete buttons on each card to change the box.</li>
            <li>Use the New button to create a box.</li>
          </ul>
        </>
      ) };

    if (pathname.startsWith("/box/"))
      return { title: "Box", content: (
        <>
          <p>Inside a box: view and manage items.</p>
          <ul>
            <li>Tap an item to edit; add photos, quantity and descriptions.</li>
            <li>Use the Edit / Delete buttons for items and the box itself.</li>
            <li>Use the camera button on item edit to take photos or choose files.</li>
          </ul>
        </>
      ) };

    if (pathname.startsWith("/labels"))
      return { title: "Labels", content: (
        <>
          <p>Print or share QR labels for boxes.</p>
          <ul>
            <li>Long-press a label to select multiple.</li>
            <li>Choose a layout (Default, 40×30 mm, 50×80 mm) and copies.</li>
            <li>Print via system dialog, Export PDF, or try the experimental Bluetooth print.</li>
          </ul>
        </>
      ) };

    if (pathname.startsWith("/scan-item") || pathname.startsWith("/scan"))
      return { title: "Scan", content: (
        <>
          <p>Scan barcodes or QR codes to find a box or item.</p>
          <ul>
            <li>Use the scanner to quickly open the related box/item page.</li>
            <li>Ensure camera permission is allowed for scanning to work.</li>
          </ul>
        </>
      ) };

    if (pathname.startsWith("/search"))
      return { title: "Search", content: (
        <>
          <p>Search for boxes and items by code or name.</p>
          <ul>
            <li>Type a code or name and press Enter to view results.</li>
            <li>Click a result to open the box or item.</li>
          </ul>
        </>
      ) };

    if (pathname.startsWith("/login") || pathname.startsWith("/signup"))
      return { title: "Account", content: (
        <>
          <p>Sign in or create an account to access the app.</p>
          <ul>
            <li>Use your credentials to sign in.</li>
            <li>Signup requires an email and password.</li>
          </ul>
        </>
      ) };

    return { title: "Storage Inventory", content: (
      <>
        <p>General app help.</p>
        <ul>
          <li>Navigate with the menu in the top-right.</li>
          <li>Use the search to quickly find boxes or items.</li>
        </ul>
      </>
    ) };
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Help"
        onClick={() => setOpen(true)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 17v.01" />
          <path d="M12 13a2 2 0 1 0-2-2" />
        </svg>
      </button>

      <Modal open={open} title={`Help — ${meta.title}`} onClose={() => setOpen(false)} anchor="top-right">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14 }}>{meta.content}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setOpen(false)} className="tap-btn">Close</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
