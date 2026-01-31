import type { Metadata } from "next";
import React from "react";
import Image from "next/image";
import { AuthProvider } from "./lib/auth";
import BurgerMenu from "./components/BurgerMenu";
import BackButton from "./components/BackButton";
import HeaderTitle from "./components/HeaderTitle";
import { UnsavedChangesProvider } from "./components/UnsavedChangesProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storage Inventory",
  description: "Box and item inventory system",
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-32.png",
    apple: "/icons/apple-touch-180.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-180.png" />
        <meta name="theme-color" content="#333333" />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
          background: "#f6f7fb",
          color: "#111",
        }}
      >
        <AuthProvider>
          <UnsavedChangesProvider>
          <style>{`
            :root{
              --border:#e5e7eb;
              --shadow: 0 1px 10px rgba(0,0,0,0.06);
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

            /* ✅ Robust blur for ALL browsers (no backdrop-filter dependency) */
            body.menu-open #app-shell {
              filter: blur(6px) brightness(0.6);
              transform: translateZ(0);
            }
          `}</style>

          {/* Everything that should blur sits inside this wrapper */}
          <div id="app-shell">
            {/* NAV BAR */}
            <nav
              style={{
                position: "sticky",
                top: 0,
                zIndex: 100,
                background: "rgba(246,247,251,0.92)",
                backdropFilter: "blur(10px)",
                borderBottom: "1px solid #eaeaea",
              }}
            >
              <div
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
                {/* Dynamic page title + icon */}
                <HeaderTitle />

                {/* Back button + Burger (stay top-right) */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {/* Back arrow (navigates history or fallback) */}
                  <BackButton />

                  {/* Burger menu */}
                  <BurgerMenu />
                </div>
              </div>
            </nav>

            {/* CONTENT */}
            <div
              style={{
                maxWidth: 1100,
                margin: "0 auto",
                padding: "14px 14px 28px",
              }}
            >
              {children}
            </div>
          </div>
          </UnsavedChangesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}