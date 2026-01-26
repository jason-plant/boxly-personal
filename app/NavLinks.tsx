"use client";

import React from "react";
import { usePathname } from "next/navigation";

const baseStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#111",
  border: "1px solid #ddd",
  padding: "10px 12px",
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 700,
  background: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 120ms ease, box-shadow 120ms ease, background 120ms ease, color 120ms ease, border-color 120ms ease",
};

const activeStyle: React.CSSProperties = {
  background: "#111",
  color: "#fff",
  borderColor: "#111",
};

function isActive(pathname: string, href: string) {
  // Special cases so sub-pages still highlight the right tab
  if (href === "/boxes") return pathname === "/boxes" || pathname.startsWith("/box/");
  if (href === "/locations") return pathname === "/locations" || pathname.startsWith("/locations/");
  return pathname === href || pathname.startsWith(href + "/");
}

export default function NavLinks() {
  const pathname = usePathname() || "/";

  const links = [
    { href: "/locations", label: "Locations" },
    { href: "/boxes", label: "Boxes" },
    { href: "/search", label: "Search" },
    { href: "/labels", label: "Labels" },
    { href: "/scan", label: "Scan QR" },
  ];

  return (
    <div className="nav-links" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <a
            key={l.href}
            href={l.href}
            className="tap-btn"
            style={{
              ...baseStyle,
              ...(active ? activeStyle : null),
            }}
            aria-current={active ? "page" : undefined}
          >
            {l.label}
          </a>
        );
      })}
    </div>
  );
}
