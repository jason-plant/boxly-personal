"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./lib/auth";

export default function NavBarLinks() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <nav
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {user ? (
        <>
          <Link
            href="/locations"
            className={`nav-btn ${isActive("/locations") ? "active" : ""}`}
          >
            Locations
          </Link>

          <Link
            href="/boxes"
            className={`nav-btn ${isActive("/boxes") ? "active" : ""}`}
          >
            Boxes
          </Link>

          <Link
            href="/search"
            className={`nav-btn ${isActive("/search") ? "active" : ""}`}
          >
            Search
          </Link>

          <Link
            href="/labels"
            className={`nav-btn ${isActive("/labels") ? "active" : ""}`}
          >
            Labels
          </Link>

          <Link
            href="/scan"
            className={`nav-btn ${isActive("/scan") ? "active" : ""}`}
          >
            Scan QR
          </Link>

          <Link
            href="/scan-item"
            className={`nav-btn ${isActive("/scan-item") ? "active" : ""}`}
          >
            Scan Item
          </Link>

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
  );
}
