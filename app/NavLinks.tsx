"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const itemBase: React.CSSProperties = {
  textDecoration: "none",
  color: "#111",
  border: "1px solid #e5e7eb",
  padding: "12px 12px",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: 800,
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
};

const itemActive: React.CSSProperties = {
  background: "#111",
  color: "#fff",
  borderColor: "#111",
};

function isActive(pathname: string, href: string) {
  if (href === "/boxes") return pathname === "/boxes" || pathname.startsWith("/box/");
  if (href === "/locations") return pathname === "/locations" || pathname.startsWith("/locations/");
  return pathname === href || pathname.startsWith(href + "/");
}

export default function NavLinks() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const links = useMemo(
    () => [
      { href: "/locations", label: "Locations" },
      { href: "/boxes", label: "Boxes" },
      { href: "/search", label: "Search" },
      { href: "/labels", label: "Labels" },
      { href: "/scan", label: "Scan QR" },
    ],
    []
  );

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // ✅ KEY FIX: when opening, force scroll to TOP
  useEffect(() => {
    if (!open) return;
    // wait a tick for DOM to render
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = 0;
    });
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          borderRadius: 16,
          padding: "10px 12px",
          fontWeight: 900,
          display: "inline-flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Open menu"
      >
        <span aria-hidden>☰</span> Menu
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 5000,
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
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: 14,
              height: "min(340px, 65vh)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flex: "0 0 auto",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>Menu</div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                style={{
                  borderRadius: 999,
                  width: 42,
                  height: 42,
                  padding: 0,
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            <div
              ref={listRef}
              style={{
                marginTop: 12,
                display: "grid",
                gap: 10,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                flex: "1 1 auto",
                minHeight: 0,
                paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)",
              }}
            >
              {links.map((l) => {
                const active = isActive(pathname, l.href);
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    className="tap-btn"
                    style={{ ...itemBase, ...(active ? itemActive : null) }}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <span>{l.label}</span>
                    <span aria-hidden style={{ opacity: active ? 0.9 : 0.45 }}>
                      ›
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
