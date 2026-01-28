"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

/* ===== Icons ===== */
const IconLocations = () => <span>📍</span>;
const IconBoxes = () => <span>📦</span>;
const IconSearch = () => <span>🔍</span>;
const IconLabels = () => <span>🏷️</span>;
const IconScanQR = () => <span>📷</span>;
const IconScanItem = () => <span>➕</span>;
const IconLogout = () => <span>🚪</span>;

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
      {label}
    </button>
  );
}

export default function BurgerMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  // open = target state
  const [open, setOpen] = useState(false);

  // mounted = keep DOM around to play close animation
  const [mounted, setMounted] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  // When open becomes true, mount immediately.
  // When open becomes false, wait for animation to finish then unmount.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;

    const t = setTimeout(() => setMounted(false), 220); // match CSS duration
    return () => clearTimeout(t);
  }, [open, mounted]);

  // Lock scroll only while mounted (overlay exists)
  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted]);

  // Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (mounted) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  // focus drawer on open
  useEffect(() => {
    if (!open) return;
    setTimeout(() => panelRef.current?.focus(), 10);
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
    // Wait for close animation then navigate (feels smoother)
    setTimeout(() => {
      router.push(href);
    }, 200);
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

      {/* Overlay + Drawer (mounted for open/close animation) */}
      {mounted && (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
          }}
        >
          {/* Backdrop */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: open ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0)",
              backdropFilter: open ? "blur(6px)" : "blur(0px)",
              WebkitBackdropFilter: open ? "blur(6px)" : "blur(0px)",
              transition: "background 220ms ease, backdrop-filter 220ms ease",
            }}
          />

          {/* Drawer */}
          <div
            ref={panelRef}
            tabIndex={-1}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              height: "100%",
              width: "min(86vw, 340px)",
              background: "#fff",
              borderLeft: "1px solid #e5e7eb",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.35)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              zIndex: 1,

              // ✅ animation
              transform: open ? "translateX(0)" : "translateX(16px)",
              opacity: open ? 1 : 0,
              transition: "transform 220ms cubic-bezier(.2,.9,.2,1), opacity 220ms ease",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

            {/* Menu list */}
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
                    setTimeout(async () => {
                      await signOut();
                      router.push("/login");
                    }, 200);
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
