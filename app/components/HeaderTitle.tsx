"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLocations,
  IconBoxes,
  IconSearch,
  IconLabels,
  IconScanQR,
  IconScanItem,
  IconHome,
} from "./Icons";

type Meta = { title: string; Icon: React.ComponentType; href: string };

export default function HeaderTitle() {
  const pathname = usePathname() || "/";

  const nextMeta = useMemo<Meta>(() => {
    if (pathname === "/" || pathname === "/locations") return { title: "Locations", Icon: IconLocations, href: "/locations" };
    if (pathname.startsWith("/boxes")) return { title: "Boxes", Icon: IconBoxes, href: "/boxes" };
    if (pathname.startsWith("/search")) return { title: "Search", Icon: IconSearch, href: "/search" };
    if (pathname.startsWith("/labels")) return { title: "Labels", Icon: IconLabels, href: "/labels" };
    if (pathname.startsWith("/scan-item")) return { title: "Scan Item", Icon: IconScanItem, href: "/scan-item" };
    if (pathname.startsWith("/scan")) return { title: "Scan QR", Icon: IconScanQR, href: "/scan" };
    if (pathname.startsWith("/box/")) {
      const parts = pathname.split("/").filter(Boolean);
      const code = parts[1] ? decodeURIComponent(parts[1]) : "Box";
      return { title: code, Icon: IconBoxes, href: `/box/${encodeURIComponent(code)}` };
    }
    return { title: "Storage Inventory", Icon: IconHome, href: "/locations" };
  }, [pathname]);

  const [prevMeta, setPrevMeta] = useState<Meta | null>(null);
  const [meta, setMeta] = useState<Meta>(nextMeta);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (nextMeta.title === meta.title) return;
    setPrevMeta(meta);
    setAnimating(true);

    // start entering new meta after a tiny delay so CSS can animate both layers
    requestAnimationFrame(() => setMeta(nextMeta));

    // finish animation after 260ms and clear prev
    const t = setTimeout(() => {
      setPrevMeta(null);
      setAnimating(false);
    }, 260);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextMeta]);

  const Icon = meta.Icon;

  return (
    <Link href={meta.href} style={{ textDecoration: "none", color: "#111", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, flex: "0 0 auto", position: "relative" }}>
        <div
          className={`ht-layer ${animating ? "entering" : ""}`}
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-hidden={!!prevMeta}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
              color: "#111",
            }}
          >
            <Icon />
          </div>
        </div>
      </div>

      <div style={{ position: "relative", minWidth: 80, height: 36 }}>
        {prevMeta && (
          <div className={`ht-layer exiting`} style={{ position: "absolute", left: 0, top: 0, right: 0 }}>
            <span style={{ fontWeight: 900, fontSize: 18, display: "inline-block", lineHeight: 1.9 }}>{prevMeta.title}</span>
          </div>
        )}

        <div className={`ht-layer ${animating ? "entering" : ""}`} style={{ position: "absolute", left: 0, top: 0, right: 0 }}>
          <span style={{ fontWeight: 900, fontSize: 18, display: "inline-block", lineHeight: 1.9 }}>{meta.title}</span>
        </div>
      </div>
    </Link>
  );
}
