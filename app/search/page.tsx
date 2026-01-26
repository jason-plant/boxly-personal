"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import RequireAuth from "../components/RequireAuth";

type SearchItem = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  quantity: number | null;
  box: {
    code: string;
    location: string | null;
  } | null;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IMPORTANT: state is typed
  const [items, setItems] = useState<SearchItem[]>([]);

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setItems([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      const res = await supabase
        .from("items")
        .select(
          `
          id,
          name,
          description,
          photo_url,
          quantity,
          box:boxes (
            code,
            location
          )
        `
        )
        .ilike("name", `%${q}%`)
        .limit(50);

      if (res.error) {
        setError(res.error.message);
        setItems([]);
      } else {
        const safeData: SearchItem[] = (res.data ?? []) as unknown as SearchItem[];
        setItems(safeData);
      }

      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <RequireAuth>
      <main style={{ paddingBottom: 90 }}>
        <h1 style={{ marginTop: 6 }}>Search</h1>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item name..."
          style={{
            width: "100%",
            marginTop: 10,
          }}
        />

        {loading && <p>Searching…</p>}
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

        {!loading && query && items.length === 0 && !error && <p>No items found.</p>}

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {items.map((i) => (
            <div
              key={i.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 14,
                boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              {i.photo_url && (
                <img
                  src={i.photo_url}
                  alt={i.name}
                  style={{
                    width: 84,
                    height: 84,
                    objectFit: "cover",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    flex: "0 0 auto",
                  }}
                />
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {i.name}
                  {i.quantity ? ` (x${i.quantity})` : ""}
                </div>

                {i.description && <div style={{ marginTop: 6, opacity: 0.9 }}>{i.description}</div>}

                {i.box && (
                  <div style={{ marginTop: 10, opacity: 0.9 }}>
                    Box:{" "}
                    <a
                      href={`/box/${encodeURIComponent(i.box.code)}`}
                      className="tap-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "8px 10px",
                        borderRadius: 14,
                        border: "1px solid #ddd",
                        background: "#fff",
                        fontWeight: 900,
                        textDecoration: "none",
                        color: "#111",
                        marginLeft: 6,
                      }}
                    >
                      {i.box.code}
                    </a>
                    {i.box.location ? <span style={{ marginLeft: 8 }}>— {i.box.location}</span> : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </RequireAuth>
  );
}
