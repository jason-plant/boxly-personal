"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

// small theme toggle import (lazy loaded)
const ThemeToggleSmall = React.lazy(() => import("./ThemeToggle").then((m) => ({ default: () => <m.default small /> })));

/* ===== Icons ===== */
import { IconLocations, IconBoxes, IconSearch, IconLabels, IconScanQR, IconScanItem } from "./Icons";
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

  const [open, setOpen] = useState(false);

  // Keep mounted for close animation
  const [mounted, setMounted] = useState(false);

  // Portal readiness (prevents SSR issues)
  const [portalReady, setPortalReady] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  // portal ready after mount
  useEffect(() => setPortalReady(true), []);

  // Mount/unmount for animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open, mounted]);

  // ✅ Apply blur to background via body class (reliable everywhere)
  useEffect(() => {
    if (!mounted) return;

    document.body.classList.add("menu-open");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("menu-open");
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted]);

  // Escape to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (mounted) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  // Focus drawer on open
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
    setTimeout(() => router.push(href), 200);
  }

  const overlay = mounted ? (
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
      {/* Backdrop (dim only; blur is handled by #app-shell filter) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: open ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0)",
          transition: "background 220ms ease",
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
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.35)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          zIndex: 1,

          // ✅ slide animation
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
              border: "1px solid var(--border)",
              background: "var(--surface)",
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

          {/* Settings */}
          <MenuRow icon={<span>⚙️</span>} label="Settings" onClick={() => go("/settings")} />

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

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, opacity: 0.8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>Appearance</div>
              {/* theme toggle compact */}
              <div style={{ marginLeft: "auto" }}>
                <React.Suspense fallback={null}>
                  {/* dynamically import to avoid SSR issues */}
                  <ThemeToggleSmall />
                </React.Suspense>
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.6 }}>Tip: tap outside the menu to close.</div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

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

      {/* Portal render (so drawer stays crisp while #app-shell blurs) */}
      {portalReady && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}