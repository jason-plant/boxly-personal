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
    name: string | null;
    location: { name: string } | null; // joined from locations table
  } | null;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (authErr || !userId) {
        setError(authErr?.message || "Not logged in.");
        setItems([]);
        setLoading(false);
        return;
      }

      // ✅ Pull location via boxes.location_id -> locations.name

      // Search for items where the query matches item name, box code, box name, or location name
      // Only search item name in the query, filter other fields client-side
      const res = await supabase
        .from("items")
        .select(`
          id,
          name,
          description,
          photo_url,
          quantity,
          box:boxes (
            code,
            name,
            location:locations ( name )
          )
        `)
        .eq("owner_id", userId)
        .ilike("name", `%${q}%`)
        .limit(100);

      if (res.error) {
        setError(res.error.message);
        setItems([]);
      } else {
        // Filter by box code, box name, and location name client-side
        let results = (res.data ?? []) as unknown as SearchItem[];
        if (q) {
          const qLower = q.toLowerCase();
          results = results.filter(item => {
            const locName = item.box?.location?.name?.toLowerCase() || "";
            return (
              item.name?.toLowerCase().includes(qLower) ||
              item.box?.code?.toLowerCase().includes(qLower) ||
              item.box?.name?.toLowerCase().includes(qLower) ||
              locName.includes(qLower)
            );
          });
        }
        setItems(results);
      }

      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <RequireAuth>
      <main style={{ paddingBottom: 90 }}>
        <h1 className="sr-only" style={{ marginTop: 6 }}>Search</h1>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item name..."
          style={{ width: "100%", marginTop: 10 }}
        />

        {loading && <p>Searching…</p>}
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

        {!loading && query && items.length === 0 && !error && <p>No items found.</p>}

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {items.map((i) => {
            const boxCode = i.box?.code ?? "";
            const boxName = i.box?.name ?? null;
            const locationName = i.box?.location?.name ?? null;

            return (
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
                    {typeof i.quantity === "number" ? ` (x${i.quantity})` : ""}
                  </div>

                  {i.description && <div style={{ marginTop: 6, opacity: 0.9 }}>{i.description}</div>}

                  {(boxCode || boxName || locationName) && (
                    <div style={{ marginTop: 10, opacity: 0.9 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span style={{ fontWeight: 800 }}>Box:</span>

                        {boxCode ? (
                          <a
                            href={`/box/${encodeURIComponent(boxCode)}`}
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
                            }}
                          >
                            {boxCode}
                          </a>
                        ) : (
                          <span style={{ opacity: 0.7 }}>Unknown</span>
                        )}

                        {boxName ? (
                          <span style={{ opacity: 0.95 }}>
                            — <strong>{boxName}</strong>
                          </span>
                        ) : null}
                      </div>

                      {locationName ? (
                        <div style={{ marginTop: 6, opacity: 0.85 }}>
                          Location: <strong>{locationName}</strong>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </RequireAuth>
  );
}
