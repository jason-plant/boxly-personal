"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Modal({
  open,
  title,
  children,
  onClose,
  anchor = "bottom",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  anchor?: "bottom" | "top-right" | "center";
}) {
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
    } else if (mounted) {
      // start exit animation
      setExiting(true);
      const t = setTimeout(() => {
        setMounted(false);
        setExiting(false);
      }, 260);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    // focus trap: move focus into modal
    const el = panelRef.current;
    const previous = (document.activeElement as HTMLElement) || null;

    const focusable = el
      ? Array.from(
          el.querySelectorAll(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((n) => !n.hasAttribute("disabled"))
      : [];

    if (focusable.length) (focusable[0] as HTMLElement).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // simple focus trap
        if (!focusable.length) return;
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      try {
        if (previous && previous.focus) previous.focus();
      } catch (e) {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  // container style varies based on anchor
  const containerStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 4000,
    display: "flex",
    padding: 12,
    justifyContent: anchor === "top-right" ? "flex-end" : "center",
    alignItems: anchor === "top-right" ? "flex-start" : "flex-end",
  };

  const panelStyle: React.CSSProperties = {
    width: anchor === "top-right" ? undefined : "100%",
    maxWidth: anchor === "top-right" ? 420 : 520,
    background: "#fff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    padding: 14,
    marginTop: anchor === "top-right" ? 56 : undefined, // offset beneath navbar
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`modal-backdrop ${anchor === "top-right" ? "top-right" : ""} ${exiting ? "exiting" : "show"}`}
      style={containerStyle}
    >
      <div
        ref={panelRef}
        className={`modal-panel ${anchor === "top-right" ? "top-right" : ""} ${exiting ? "exiting" : "show"}`}
        style={panelStyle}
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
