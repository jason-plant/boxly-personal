import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Storage Inventory",
  description: "Box + item inventory",
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>
        {/* Top Nav */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "#fff",
            borderBottom: "1px solid #ddd",
          }}
        >
          <div
            className="nav-wrap"
            style={{
              maxWidth: 1000,
              margin: "0 auto",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <a
              href="/boxes"
              style={{
                fontWeight: 800,
                textDecoration: "none",
                color: "#000",
              }}
            >
              Storage Inventory
            </a>

            <div className="nav-links" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/boxes" style={linkStyle}>
                Boxes
              </a>
              <a href="/search" style={linkStyle}>
                Search
              </a>
              <a href="/labels" style={linkStyle}>
                Labels
              </a>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <div
  style={{
    maxWidth: 1000,
    margin: "0 auto",
    padding: "16px",
  }}
>
  <style>{`
    /* Mobile tweaks */
    @media (max-width: 600px) {
      .nav-wrap { flex-direction: column; align-items: flex-start; }
      .nav-links { width: 100%; }
      .nav-links a { flex: 1; text-align: center; }
      .page-pad { padding: 12px !important; }
      button { width: 100%; }
      input { width: 100%; box-sizing: border-box; }
      img { max-width: 100%; height: auto; }
    }
  `}</style>

  <div className="page-pad">{children}</div>
</div>

      </body>
    </html>
  );
}

const linkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#000",
  border: "1px solid #444",
  padding: "8px 10px",
  borderRadius: 8,
};
