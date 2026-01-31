"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
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

  const { user } = useAuth();
  const userName = user?.user_metadata?.name;
  const nextMeta = useMemo<Meta>(() => {
    let section = '';
    if (pathname === "/" || pathname === "/locations") section = 'Locations';
    else if (pathname.startsWith("/boxes")) section = 'Boxes';
    else if (pathname.startsWith("/search")) section = 'Search';
    else if (pathname.startsWith("/labels")) section = 'Labels';
    else if (pathname.startsWith("/scan-item")) section = 'Scan Item';
    else if (pathname.startsWith("/scan")) section = 'Scan QR';
    else if (pathname.startsWith("/box/")) {
      const parts = pathname.split("/").filter(Boolean);
      section = parts[1] ? decodeURIComponent(parts[1]) : "Box";
    }
    let title;
    if (userName && userName.trim()) {
      if (section) {
        title = `${userName}'s Inventory\n${section}`;
      } else {
        title = `${userName}'s Inventory`;
      }
    } else {
      title = section ? `Storage Inventory\n${section}` : 'Storage Inventory';
    }
    let Icon = IconHome;
    let href = "/locations";
    if (pathname === "/" || pathname === "/locations") { Icon = IconLocations; href = "/locations"; }
    else if (pathname.startsWith("/boxes")) { Icon = IconBoxes; href = "/boxes"; }
    else if (pathname.startsWith("/search")) { Icon = IconSearch; href = "/search"; }
    else if (pathname.startsWith("/labels")) { Icon = IconLabels; href = "/labels"; }
    else if (pathname.startsWith("/scan-item")) { Icon = IconScanItem; href = "/scan-item"; }
    else if (pathname.startsWith("/scan")) { Icon = IconScanQR; href = "/scan"; }
    else if (pathname.startsWith("/box/")) {
      const parts = pathname.split("/").filter(Boolean);
      const code = parts[1] ? decodeURIComponent(parts[1]) : "Box";
      Icon = IconBoxes;
      href = `/box/${encodeURIComponent(code)}`;
    }
    return { title, Icon, href };
  }, [pathname, userName]);

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

        <div
          className={`ht-layer ${animating ? "entering" : ""}`}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            minWidth: 80,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.1,
          }}
        >
          {(() => {
            const [main, section] = meta.title.split('\n');
            // Split main into name and 'Inventory'
            let name = main;
            let inventory = '';
            const invIdx = main.indexOf("'s Inventory");
            if (invIdx !== -1) {
              name = main.slice(0, invIdx);
              inventory = main.slice(invIdx);
            }
            return (
              <>
                <div style={{ display: 'flex', flexWrap: 'nowrap', whiteSpace: 'nowrap', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 17 }}>{name}</span>
                  <span style={{ fontWeight: 700, fontSize: 17 }}>{inventory}</span>
                </div>
                {section && (
                  <div style={{ fontWeight: 900, fontSize: 20, marginTop: 0 }}>{section}</div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </Link>
  );
}
