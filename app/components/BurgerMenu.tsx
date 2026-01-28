"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

/* ===== Icon components (simple, lightweight SVGs) ===== */

function IconLocations() {
  return <span>📍</span>;
}
function IconBoxes() {
  return <span>📦</span>;
}
function IconSearch() {
  return <span>🔍</span>;
}
function IconLabels() {
  return <span>🏷️</span>;
}
function IconScanQR() {
  return <span>📷</span>;
}
function IconScanItem() {
  return <span>➕</span>;
}
function IconLogout() {
  return <span>🚪</span>;
}

/* ===== Menu row ===== */

function MenuRow({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        fontWeight: 900,
        fontSize: 16,
        textAlign: "left",
        boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{ fontSize: 20, width: 24, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/* ===== Burger Menu ===== */

export default function BurgerMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setTimeout(() => panelRef.current?.focus(), 10);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const items = useMemo(() => {
    if (!user) return [];

    return [
      { label: "Locations", href: "/locations", icon: <IconLocations /> },
      { label: "Boxes", href: "/boxes", icon: <IconBoxes /> },
      { label: "Search", href: "/search", icon: <IconSearch /> },
      { label: "Labels", href: "/labels", icon: <IconLabels /> },
      { label: "Scan QR", href: "/scan", icon: <IconScanQR /> },
      { label: "Scan Item", href: "/scan-item", icon: <IconScanItem /> },
    ];
  }, [user]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {/* Burger button */}
      <button
        type="button"
        aria-label="Open menu"
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
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      </button>

      {/* Overlay */}
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
            zIndex: 5000,
            background: "rgba(0,0,0,0.55)",
          }}
        >
          {/* Drawer */}
          <div
            ref={panelRef}
            tabIndex={-1}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              height: "100%",
              width: "min(86vw, 340px)",
              background: "#fff",
              borderLeft: "1px solid #e5e7eb",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.25)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>Menu</div>

              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            {/* Menu items */}
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((it) => (
                <MenuRow
                  key={it.href}
                  icon={it.icon}
                  label={it.label}
                  active={pathname === it.href || pathname.startsWith(it.href + "/")}
                  onClick={() => go(it.href)}
                />
              ))}

              {user && (
                <MenuRow
                  icon={<IconLogout />}
                  label="Log out"
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                    router.push("/login");
                  }}
                />
              )}
            </div>

            <div style={{ marginTop: "auto", opacity: 0.6, fontSize: 12 }}>
              Tip: tap outside the menu to close.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
