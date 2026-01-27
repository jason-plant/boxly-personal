"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "./lib/auth";
import { supabase } from "./lib/supabaseClient";

const linkStyle = {
  textDecoration: "none",
  color: "#111",
  border: "1px solid #ddd",
  padding: "10px 12px",
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 700,
  background: "#fff",
};

export default function NavBarLinks() {
  const pathname = usePathname();
  const { user } = useAuth();

  function isActive(path: string) {
    return pathname.startsWith(path);
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {user && (
        <>
          <a href="/locations" style={linkStyle}>
            Locations
          </a>
          <a href="/boxes" style={linkStyle}>
            Boxes
          </a>
          <a href="/search" style={linkStyle}>
            Search
          </a>
          <a href="/labels" style={linkStyle}>
            Labels
          </a>
          <a href="/scan" style={linkStyle}>
            Scan QR
          </a>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            style={{
              ...linkStyle,
              border: "1px solid #ef4444",
              color: "#ef4444",
            }}
          >
            Log out
          </button>
        </>
      )}

      {!user && (
        <a href="/login" style={linkStyle}>
          Log in
        </a>
      )}
    </div>
  );
}
