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
  color: "#000",
  border: "1px solid #444",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 14,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          background: "#f9f9f9",
        }}
      >
        {/* NAVIGATION BAR */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: "#ffffff",
            borderBottom: "1px solid #ddd",
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
            {/* App title / home link */}
            <a
              href="/boxes"
              style={{
                fontWeight: 800,
                textDecoration: "none",
                color: "#000",
                fontSize: 18,
              }}
            >
              Storage Inventory
            </a>

            {/* Navigation links */}
            <div
              className="nav-links"
              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
            >
              <a href="/boxes" style={linkStyle}>
                Boxes
              </a>
              <a href="/search" style={linkStyle}>
                Search
              </a>
              <a href="/labels" style={linkStyle}>
                Labels
              </a>
              
                {/* Scan QR */}
                <a
                  href="https://www.google.com/search?q=scan+qr+code"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Scan QR
                </a>
            </div>
          </div>
        </nav>

        {/* PAGE CONTENT */}
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "16px",
          }}
        >
          {/* Mobile tweaks */}
          <style>{`
            @media (max-width: 600px) {
              .nav-wrap {
                flex-direction: column;
                align-items: flex-start;
              }
              .nav-links {
                width: 100%;
              }
              .nav-links a {
                flex: 1;
                text-align: center;
              }
              button {
                width: 100%;
              }
              input {
                width: 100%;
                box-sizing: border-box;
              }
            }
          `}</style>

          {children}
        </div>
      </body>
    </html>
  );
}
