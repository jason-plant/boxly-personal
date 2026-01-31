"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";
import RequireAuth from "../components/RequireAuth";

type BoxRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
};

export default function LabelsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const origin = useMemo(() => {
    return typeof window !== "undefined" ? window.location.origin : "";
  }, []);

  useEffect(() => {
    async function loadBoxes() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("boxes")
        .select("id, code, name, location")
        .order("code", { ascending: true });

      if (error) {
        setError(error.message);
        setBoxes([]);
      } else {
        setBoxes((data ?? []) as BoxRow[]);
      }

      setLoading(false);
    }

    loadBoxes();
  }, []);

  useEffect(() => {
    async function makeQrs() {
      if (!origin) return;
      if (boxes.length === 0) return;

      const next: Record<string, string> = {};

      for (const b of boxes) {
        const url = `${origin}/box/${encodeURIComponent(b.code)}`;
        const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
        next[b.code] = dataUrl;
      }

      setQrMap(next);
    }

    makeQrs();
  }, [boxes, origin]);

  // selection state & refs
  const [selected, setSelected] = useState<string[]>([]);
  const longPressTimers = useRef<Record<string, number>>({});
  const longPressFired = useRef<Record<string, boolean>>({});
  const [copies, setCopies] = useState<number>(1);

  function toggleSelect(code: string) {
    setSelected((prev) => (prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]));
  }

  function clearSelection() {
    setSelected([]);
  }

  function startLongPress(code: string) {
    longPressFired.current[code] = false;
    longPressTimers.current[code] = window.setTimeout(() => {
      longPressFired.current[code] = true;
      toggleSelect(code);
    }, 600) as unknown as number;
  }

  function cancelLongPress(code: string) {
    const t = longPressTimers.current[code];
    if (t) window.clearTimeout(t);
    delete longPressTimers.current[code];
    // allow click handler to ignore fired if it was a longpress
    setTimeout(() => {
      longPressFired.current[code] = false;
    }, 0);
  }

  async function printSelected(count: number) {
    if (selected.length === 0) return;
    const win = window.open("", "_blank") as Window | null;
    if (!win) {
      alert("Unable to open print window");
      return;
    }

    const itemsHtml: string[] = [];

    for (let i = 0; i < count; i++) {
      for (const code of selected) {
        const b = boxes.find((bb) => bb.code === code)!;
        const img = qrMap[code] || "";
        itemsHtml.push(`<div class="label"><div class="code">${code}</div>${b.name ? `<div class="name">${b.name}</div>` : ""}${b.location ? `<div class="loc">${b.location}</div>` : ""}<img src="${img}" /></div>`);
      }
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Labels</title><style>body{padding:20px;font-family:Arial} .label{border:1px solid #000;padding:12px;border-radius:8px;display:inline-block;margin:8px;width:320px;box-sizing:border-box} .label img{width:100%;height:auto;display:block;margin-top:8px} .label .code{font-weight:900;font-size:18px;text-align:center;width:100%}.no-print{display:none}</style></head><body>${itemsHtml.join("")}</body></html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
    // give it a moment to render then print
    setTimeout(() => win.print(), 400);
  }

  async function shareSelected() {
    if (selected.length === 0) return;
    const canShareFiles = !!(navigator as any).canShare || !!(navigator as any).share;

    try {
      // try to share images (if supported)
      const files: File[] = [];
      for (const code of selected) {
        const data = qrMap[code];
        if (!data) continue;
        const res = await fetch(data);
        const blob = await res.blob();
        files.push(new File([blob], `${code}.png`, { type: blob.type }));
      }

      if ((navigator as any).share && files.length) {
        await (navigator as any).share({ files, title: "Box labels" });
      } else if ((navigator as any).share) {
        await (navigator as any).share({ title: "Box labels", text: `Boxes: ${selected.join(", ")}` });
      } else {
        // fallback: copy text to clipboard
        await navigator.clipboard.writeText(`Boxes: ${selected.join(", ")}`);
        alert("Copied box list to clipboard (share fallback)");
      }
    } catch (err) {
      console.warn(err);
      try {
        await navigator.clipboard.writeText(`Boxes: ${selected.join(", ")}`);
        alert("Copied box list to clipboard (share fallback)");
      } catch (e) {
        alert("Share not available in this browser");
      }
    }
  }

  return (
    <RequireAuth>
      <main style={{ paddingBottom: 90 }}>
        <div
          className="no-print"
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
            marginTop: 6,
            marginBottom: 14,
          }}
        >
          <h1 className="sr-only" style={{ margin: 0 }}>QR Labels</h1>

          <p style={{ marginTop: 8, marginBottom: 6, opacity: 0.9 }}>
            Print this page. Each label opens the box page when scanned.
          </p>

          <p style={{ marginTop: 0, opacity: 0.75 }}>
            Tip: In print settings, enable “Background graphics” for cleaner QR edges (optional).
          </p>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: "#111",
                color: "#fff",
                fontWeight: 900,
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid #111",
                cursor: "pointer",
              }}
            >
              Print
            </button>

            {selected.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{selected.length} selected</div>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  Copies:
                  <input type="number" value={copies} min={1} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} style={{ width: 70, padding: 6, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                </label>

                <button onClick={() => printSelected(copies)} className="tap-btn">Print selected</button>
                <button onClick={shareSelected} className="tap-btn">Share</button>
                <button onClick={clearSelection} className="tap-btn">Clear</button>
              </div>
            )}
          </div>
        </div>

        {loading && <p>Loading boxes…</p>}
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

        {!loading && !error && boxes.length === 0 && <p>No boxes found.</p>}

        {/* Print-friendly rules */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            a { text-decoration: none !important; color: #000 !important; }
            .selected-badge { display: none; }
          }
          .label-selected { border-color: #2563eb !important; background: #eef2ff }
          .selected-badge { position: absolute; right: 8px; top: 8px; background: #2563eb; color: #fff; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-weight: 900; }
        `}</style>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 18,
          }}
        >
          {boxes.map((b) => {
            const isSelected = selected.includes(b.code);
            return (
              <div
                key={b.id}
                onPointerDown={() => startLongPress(b.code)}
                onPointerUp={() => cancelLongPress(b.code)}
                onPointerLeave={() => cancelLongPress(b.code)}
                onClick={() => {
                  if (longPressFired.current[b.code]) {
                    // long press already toggled selection
                    longPressFired.current[b.code] = false;
                    return;
                  }
                  if (selected.length > 0) {
                    toggleSelect(b.code);
                  } else {
                    window.location.href = `/box/${encodeURIComponent(b.code)}`;
                  }
                }}
                style={{
                  position: "relative",
                  background: "#fff",
                  border: isSelected ? "2px solid #2563eb" : "1px solid #000", // keep bold for printing
                  padding: 14,
                  borderRadius: 12,
                  breakInside: "avoid",
                  cursor: "pointer",
                }}
              >
                {isSelected && <div className="selected-badge">✓</div>}

                <div style={{ width: "100%", textAlign: "center", fontSize: 18, fontWeight: 900 }}>{b.code}</div>
                {b.name && <div style={{ fontSize: 12, marginTop: 4, textAlign: "center" }}>{b.name}</div>}
                {b.location && (
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, textAlign: "center" }}>{b.location}</div>
                )}

                <div style={{ marginTop: 10 }}>
                  {qrMap[b.code] ? (
                    <img
                      src={qrMap[b.code]}
                      alt={`QR for ${b.code}`}
                      style={{ width: "100%", maxWidth: 240, display: "block" }}
                    />
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Generating QR…</div>
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
