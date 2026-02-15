import type { Metadata } from "next";
import React, { Suspense } from "react";
import Image from "next/image";
import { AuthProvider } from "./lib/auth";
import { IconSettingsProvider } from "./lib/iconSettings";
import BurgerMenu from "./components/BurgerMenu";
import BackButton from "./components/BackButton";
import HeaderTitle from "./components/HeaderTitle";
import HelpButton from "./components/HelpButton";
import { UnsavedChangesProvider } from "./components/UnsavedChangesProvider";
import ThemeInitializer from "./components/ThemeInitializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boxly",
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
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <IconSettingsProvider>
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
            {/* Ensure theme is applied on client mount */}
            <ThemeInitializer />
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
                  gap: 12,
                }}
              >
                {/* Back button on far left */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <Suspense fallback={<div style={{ width: 44, height: 44 }} />}> 
                    <BackButton />
                  </Suspense>
                </div>
                {/* Title and section name, always visible and centered */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HeaderTitle hideIcon />
                </div>
                {/* Controls on right (no page icon) */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {/* Help button */}
                  <HelpButton />
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
                padding: "15px 14px 28px",
              }}
            >
              {children}
            </div>
          </div>
            </UnsavedChangesProvider>
          </AuthProvider>
        </IconSettingsProvider>
      </body>
    </html>
  );
}