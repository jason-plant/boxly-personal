"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppIcon } from "./Icons";

type Meta = { title: string; iconKey: string; href: string };


type HeaderTitleProps = {
  hideIcon?: boolean;
  iconOnly?: boolean;
};

export default function HeaderTitle({ hideIcon = false, iconOnly = false }: HeaderTitleProps = {}) {
  const pathname = usePathname() || "/";

  const { user } = useAuth();
  const userName = user?.user_metadata?.name;
  const nextMeta = useMemo<Meta>(() => {
    let section = '';
    let iconKey = 'home';
    let href = "/locations";
    if (pathname === "/" || pathname === "/locations") { section = 'Locations'; iconKey = 'locations'; href = "/locations"; }
    else if (pathname.startsWith("/boxes")) { section = 'Boxes'; iconKey = 'boxes'; href = "/boxes"; }
    else if (pathname.startsWith("/search")) { section = 'Search'; iconKey = 'search'; href = "/search"; }
    else if (pathname.startsWith("/labels")) { section = 'Labels'; iconKey = 'labels'; href = "/labels"; }
    else if (pathname.startsWith("/scan-item")) { section = 'Scan Item'; iconKey = 'scanItem'; href = "/scan-item"; }
    else if (pathname.startsWith("/scan")) { section = 'Scan QR'; iconKey = 'scanQR'; href = "/scan"; }
    else if (pathname.startsWith("/box/")) {
      const parts = pathname.split("/").filter(Boolean);
      section = parts[1] ? decodeURIComponent(parts[1]) : "Box";
      iconKey = 'boxes';
      href = `/box/${encodeURIComponent(section)}`;
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
    return { title, iconKey, href };
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

  const Icon = useAppIcon(meta.iconKey as any);

  if (iconOnly) {
    return (
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
            {Icon}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={meta.href} style={{ textDecoration: "none", color: "#111", display: "flex", alignItems: "center", gap: 10, minWidth: 0, width: '100%' }}>
      {!hideIcon && (
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
              {Icon}
            </div>
          </div>
        </div>
      )}
      <div style={{ position: "relative", minWidth: 80, height: 36, flex: 1, overflow: 'hidden' }}>
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
            maxWidth: 320,
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            lineHeight: 1.1,
            marginLeft: hideIcon ? 0 : 10,
            overflow: 'hidden',
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
                <div style={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  whiteSpace: 'nowrap',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 320,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 17, textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 180, display: 'inline-block' }}>{name}</span>
                  <span style={{ fontWeight: 700, fontSize: 17, textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 120, display: 'inline-block' }}>{inventory}</span>
                </div>
                {section && (
                  <div style={{ fontWeight: 900, fontSize: 16, marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 320, whiteSpace: 'nowrap' }}>{section}</div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </Link>
  );
}
