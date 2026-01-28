"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./lib/auth";

export default function NavBarLinks() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  // helper to detect active route (supports sub-pages)
  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const [menuOpen, setMenuOpen] = useState(false);

  // close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const authedLinks = useMemo(
    () => [
      { href: "/locations", label: "Locations" },
      { href: "/boxes", label: "Boxes" },
      { href: "/search", label: "Search" },
      { href: "/labels", label: "Labels" },
      { href: "/scan", label: "Scan QR" },
    ],
    []
  );

  return (
    <>
      {/* Desktop nav */}
      <nav
        className="nav-desktop"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {user ? (
          <>
            {authedLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-btn ${isActive(l.href) ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ))}

            <button className="nav-btn" onClick={signOut}>
              Log out
            </button>
          </>
        ) : (
          !isAuthPage && (
            <>
              <Link className="nav-btn" href="/login">
                Log in
              </Link>
              <Link className="nav-btn" href="/signup">
                Sign up
              </Link>
            </>
          )
        )}
      </nav>

      {/* Mobile nav (burger) */}
      <div
        className="nav-mobile"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {/* Hide burger on login/signup if you prefer (keeps it clean) */}
        {!isAuthPage && (
          <button
            type="button"
            className="nav-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              width: 44,
              height: 44,
              padding: 0,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* burger / close icon */}
            {menuOpen ? (
              <span style={{ fontWeight: 900, fontSize: 18, lineHeight: 1 }}>
                ✕
              </span>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        )}

        {/* Backdrop (click to close) */}
        {menuOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              border: "none",
              padding: 0,
              margin: 0,
              zIndex: 2999,
            }}
          />
        )}

        {/* Dropdown */}
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: 52,
              right: 0,
              zIndex: 3000,
              width: "min(260px, calc(100vw - 24px))",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 10, display: "grid", gap: 8 }}>
              {user ? (
                <>
                  {authedLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`nav-btn ${isActive(l.href) ? "active" : ""}`}
                      onClick={() => setMenuOpen(false)}
                      style={{ width: "100%", justifyContent: "flex-start" }}
                    >
                      {l.label}
                    </Link>
                  ))}

                  <button
                    className="nav-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    style={{ width: "100%", justifyContent: "flex-start" }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                !isAuthPage && (
                  <>
                    <Link
                      className="nav-btn"
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      style={{ width: "100%", justifyContent: "flex-start" }}
                    >
                      Log in
                    </Link>
                    <Link
                      className="nav-btn"
                      href="/signup"
                      onClick={() => setMenuOpen(false)}
                      style={{ width: "100%", justifyContent: "flex-start" }}
                    >
                      Sign up
                    </Link>
                  </>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Simple responsive rules */}
      <style jsx>{`
        .nav-desktop {
          display: flex;
        }
        .nav-mobile {
          display: none;
        }

        @media (max-width: 740px) {
          .nav-desktop {
            display: none !important;
          }
          .nav-mobile {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
