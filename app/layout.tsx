import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Storage Inventory",
  description: "Box and item inventory system",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const linkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#111",
  border: "1px solid #ddd",
  padding: "10px 12px",
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 700,
  background: "#fff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
          background: "#f6f6f7",
          color: "#111",
        }}
      >
        <style>{`
          :root{
            --card:#ffffff;
            --border:#e5e7eb;
            --shadow: 0 1px 10px rgba(0,0,0,0.06);
            --radius: 16px;
          }

          input, select, button, textarea {
            font-size: 16px;
            border-radius: 14px;
            border: 1px solid var(--border);
            padding: 12px 12px;
            box-sizing: border-box;
          }

          button {
            background: #fff;
            font-weight: 800;
            cursor: pointer;
            box-shadow: var(--shadow);
          }

          button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
            box-shadow: none;
          }

          a, button, input, select {
            -webkit-tap-highlight-color: transparent;
          }

          @media (max-width: 600px) {
            .nav-wrap { flex-direction: column; align-items: flex-start; }
            .nav-links { width: 100%; }
            .nav-links a { flex: 1; text-align: center; }
            .full-width-mobile { width: 100% !important; }
          }
        `}</style>

        {/* NAV BAR */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: "rgba(246,246,247,0.9)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid #eaeaea",
          }}
        >
          <div
            className="nav-wrap"
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {/* Title now goes to Locations */}
            <a
              href="/locations"
              style={{
                fontWeight: 900,
                textDecoration: "none",
                color: "#111",
                fontSize: 18,
              }}
            >
              Storage Inventory
            </a>

            <div className="nav-links" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/locations" style={linkStyle}>Locations</a>
              <a href="/boxes" style={linkStyle}>Boxes</a>
              <a href="/search" style={linkStyle}>Search</a>
              <a href="/labels" style={linkStyle}>Labels</a>
              <a href="/scan" style={linkStyle}>Scan QR</a>
            </div>
          </div>
        </nav>

        {/* CONTENT */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 14px 28px" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
