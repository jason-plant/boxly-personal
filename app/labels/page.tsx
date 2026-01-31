"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";
import RequireAuth from "../components/RequireAuth";
import Modal from "../components/Modal";

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
  const [copies, setCopies] = useState<string>("1");
  const [printLayout, setPrintLayout] = useState<string>("default");
  const [showHint, setShowHint] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBluetoothConfirm, setShowBluetoothConfirm] = useState(false);

  // show first-run long-press hint (persisted in localStorage)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const seen = localStorage.getItem("labels_longpress_hint_seen");
      if (!seen) {
        setShowHint(true);
        const t = window.setTimeout(() => setShowHint(false), 5500);
        return () => clearTimeout(t);
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  function dismissHint() {
    try {
      localStorage.setItem("labels_longpress_hint_seen", "1");
    } catch (e) {}
    setShowHint(false);
  }

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

  function parseCopies(): number {
    const n = parseInt(copies || "", 10);
    if (isNaN(n) || n < 1) return 1;
    return n;
  }

  async function printSelected(count?: number) {
    if (selected.length === 0) return;
    const win = window.open("", "_blank") as Window | null;
    if (!win) {
      alert("Unable to open print window");
      return;
    }

    const itemsHtml: string[] = [];

    const finalCount = typeof count === "number" ? count : parseCopies();
    if (finalCount < 1) {
      alert("Please enter a quantity of at least 1");
      return;
    }

    // determine label CSS based on layout
    let labelStyle = "width:320px;";
    if (printLayout === "40x30") {
      labelStyle = "width:40mm;height:30mm;";
    } else if (printLayout === "50x80") {
      labelStyle = "width:50mm;height:80mm;";
    }

    for (let i = 0; i < finalCount; i++) {
      for (const code of selected) {
        const b = boxes.find((bb) => bb.code === code)!;
        const img = qrMap[code] || "";
        itemsHtml.push(`<div class="label" style="${labelStyle}"><div class="code">${code}</div>${b.name ? `<div class="name">${b.name}</div>` : ""}${b.location ? `<div class="loc">${b.location}</div>` : ""}<img src="${img}" /></div>`);
      }
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Labels</title><style>body{padding:20px;font-family:Arial} .label{border:1px solid #000;padding:8px;border-radius:8px;display:inline-block;margin:6px;box-sizing:border-box;vertical-align:top;overflow:hidden} .label img{width:70%;height:auto;display:block;margin:6px auto} .label .code{font-weight:900;font-size:26px;text-align:center;width:100%}.no-print{display:none}@media print{body{padding:6mm} .label{page-break-inside:avoid}}</style></head><body>${itemsHtml.join("")}</body></html>`; 

    win.document.open();
    win.document.write(html);
    win.document.close();
    // give it a moment to render then print
    setTimeout(() => win.print(), 400);
  }

  async function shareSelected() {
    if (selected.length === 0) return;
    try {
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

  async function exportSelectedPDF() {
    if (selected.length === 0) return;
    if (typeof window === "undefined") return;

    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;

    const finalCount = parseCopies();
    if (finalCount < 1) return alert("Please enter a quantity of at least 1");

    // determine page size based on layout
    let pageW = 210; // mm (A4)
    let pageH = 297;
    if (printLayout === "40x30") {
      pageW = 40;
      pageH = 30;
    } else if (printLayout === "50x80") {
      pageW = 50;
      pageH = 80;
    }

    const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH] });
    let first = true;

    for (let i = 0; i < finalCount; i++) {
      for (const code of selected) {
        const b = boxes.find((bb) => bb.code === code)!;

        // create offscreen element
        const el = document.createElement("div");
        el.style.width = `${pageW}mm`;
        el.style.height = `${pageH}mm`;
        el.style.padding = "8px";
        el.style.boxSizing = "border-box";
        el.style.border = "1px solid #000";
        el.innerHTML = `<div style="font-weight:900;font-size:26px;text-align:center;width:100%">${code}</div>${b.name ? `<div style="text-align:center;font-size:12px;margin-top:6px">${b.name}</div>` : ""}${b.location ? `<div style="text-align:center;font-size:11px;margin-top:4px">${b.location}</div>` : ""}<img src="${qrMap[code] || ""}" style="width:70%;display:block;margin:6px auto" />`;
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);

        // render
        const canvas = await html2canvas(el, { scale: 2 });
        const dataUrl = canvas.toDataURL("image/png");

        // add to pdf
        if (!first) pdf.addPage([pageW, pageH]);
        first = false;
        pdf.addImage(dataUrl, "PNG", 0, 0, pageW, pageH);

        document.body.removeChild(el);
      }
    }

    pdf.save("labels.pdf");
  }

  // Export selected labels as PNG images
  async function exportSelectedImages() {
    if (selected.length === 0) return;
    const html2canvas = (await import("html2canvas")).default;
    const finalCount = parseCopies();
    if (finalCount < 1) return alert("Please enter a quantity of at least 1");
    for (let i = 0; i < finalCount; i++) {
      for (const code of selected) {
        const b = boxes.find((bb) => bb.code === code)!;
        // create offscreen element
        const el = document.createElement("div");
        el.style.width = "320px";
        el.style.padding = "8px";
        el.style.boxSizing = "border-box";
        el.style.border = "1px solid #000";
        el.style.background = "#fff";
        el.innerHTML = `<div style="font-weight:900;font-size:26px;text-align:center;width:100%">${code}</div>${b.name ? `<div style="text-align:center;font-size:12px;margin-top:6px">${b.name}</div>` : ""}${b.location ? `<div style="text-align:center;font-size:11px;margin-top:4px">${b.location}</div>` : ""}<img src="${qrMap[code] || ""}" style="width:70%;display:block;margin:6px auto" />`;
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        const canvas = await html2canvas(el, { scale: 2 });
        const dataUrl = canvas.toDataURL("image/png");
        // Download the image
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${code}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        document.body.removeChild(el);
      }
    }
  }

  async function bluetoothPrintSelected() {
    if (selected.length === 0) return;
    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      return alert("Bluetooth printing is not supported in this browser.");
    }

    // confirmation moved to modal UI; caller should open confirmation modal before invoking this function

    try {
      // request any device (filtering by name prefix could be added)
      const device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [0xFFE0] });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(0xFFE0);
      // common writable characteristic for some printers
      const char = await service.getCharacteristic(0xFFE1);

      // helper to send image data in chunks
      async function sendImageData(dataUrl: string) {
        const res = await fetch(dataUrl);
        const blob = await res.arrayBuffer();
        const chunkSize = 512;
        for (let i = 0; i < blob.byteLength; i += chunkSize) {
          const slice = blob.slice(i, i + chunkSize);
          await char.writeValue(new Uint8Array(slice));
        }
      }

      // send each label image
      for (const code of selected) {
        const b = boxes.find((bb) => bb.code === code)!;
        // render offscreen element to canvas then send
        const el = document.createElement("div");
        el.style.width = `80mm`;
        el.style.padding = "6px";
        el.style.boxSizing = "border-box";
        el.style.border = "1px solid #000";
        el.innerHTML = `<div style="font-weight:900;font-size:26px;text-align:center;width:100%">${code}</div>${b.name ? `<div style="text-align:center;font-size:12px;margin-top:6px">${b.name}</div>` : ""}${b.location ? `<div style="text-align:center;font-size:11px;margin-top:4px">${b.location}</div>` : ""}<img src="${qrMap[code] || ""}" style="width:70%;display:block;margin:6px auto" />`;
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);

        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(el, { scale: 2 });
        const dataUrl = canvas.toDataURL("image/png");
        await sendImageData(dataUrl);
        document.body.removeChild(el);
      }

      alert("Sent to printer (experimental). Check your printer to confirm output.");
    } catch (err: any) {
      console.error(err);
      alert("Bluetooth print failed: " + (err?.message || err));
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

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch", position: "relative" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
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

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    Layout:
                    <select value={printLayout} onChange={(e) => setPrintLayout(e.target.value)} style={{ padding: 6, borderRadius: 8, border: "1px solid #e5e7eb" }}>
                      <option value="default">Default</option>
                      <option value="40x30">40 x 30 (mm)</option>
                      <option value="50x80">50 x 80 (mm)</option>
                    </select>
                  </label>
                </div>
              </div>

              {showHint && (
                <div style={{ background: "#111", color: "#fff", padding: "8px 12px", borderRadius: 8, boxShadow: "0 6px 24px rgba(0,0,0,0.16)", fontSize: 13 }}>
                  Long-press a label to select multiple. <button onClick={dismissHint} style={{ marginLeft: 8, background: "transparent", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>Got it</button>
                </div>
              )}
            </div>

            {selected.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-start", marginTop: 2 }}>
                <div style={{ fontWeight: 800 }}>{selected.length} selected</div>

                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  Copies:
                  <input type="number" value={copies} onChange={(e) => setCopies(e.target.value)} placeholder="" style={{ width: 80, padding: 6, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                </label>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setShowPrintModal(true)} style={{ padding: "8px 10px", borderRadius: 10, background: "#111", color: "#fff", fontWeight: 900 }}>Print selected</button>
                  <button onClick={() => exportSelectedPDF()} style={{ padding: "8px 10px", borderRadius: 10, background: "#111", color: "#fff", fontWeight: 900 }}>Export PDF</button>
                  <button onClick={exportSelectedImages} style={{ padding: "8px 10px", borderRadius: 10, background: "#111", color: "#fff", fontWeight: 900 }}>Export Image</button>
                  <button onClick={() => setShowPrintModal(true)} style={{ padding: "8px 10px", borderRadius: 10, background: "#fff", border: "1px solid #e5e7eb", fontWeight: 800 }}>Bluetooth print</button>
                  <button onClick={() => setShowShareModal(true)} style={{ padding: "8px 10px", borderRadius: 10, background: "#fff", border: "1px solid #e5e7eb", fontWeight: 800 }}>Share</button>
                  <button onClick={clearSelection} style={{ padding: "8px 10px", borderRadius: 10, background: "#fff", border: "1px solid #e5e7eb", fontWeight: 800 }}>Clear</button>
                </div>
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
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => { if ((e as React.PointerEvent).pointerType === "touch") (e as any).preventDefault(); startLongPress(b.code); }}
                onPointerUp={() => cancelLongPress(b.code)}
                onPointerLeave={() => cancelLongPress(b.code)}
                onClick={(e) => {
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
                  WebkitUserSelect: "none",
                  MozUserSelect: "none",
                  userSelect: "none",
                  WebkitTouchCallout: "none",
                  touchAction: "manipulation",
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
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ width: "70%", maxWidth: 240, display: "block", margin: "6px auto", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}
                    />
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Generating QR…</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modals */}
        {/* Print / Bluetooth modal */}
        <Modal open={showPrintModal} title="Print labels" onClose={() => setShowPrintModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                Copies:
                <input type="number" value={copies} onChange={(e) => setCopies(e.target.value)} placeholder="1" style={{ width: 80, padding: 6, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              </label>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                Layout:
                <select value={printLayout} onChange={(e) => setPrintLayout(e.target.value)} style={{ padding: 6, borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  <option value="default">Default</option>
                  <option value="40x30">40 x 30 (mm)</option>
                  <option value="50x80">50 x 80 (mm)</option>
                </select>
              </label>
            </div>

            {/* Preview */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: 160, border: "1px solid #000", padding: 8, borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 26 }}>{selected.length > 0 ? selected[0] : (boxes[0]?.code ?? "BOX-CODE")}</div>
                <div style={{ marginTop: 6 }}>
                  {selected.length > 0 && qrMap[selected[0]] ? (
                    <img src={qrMap[selected[0]]} alt="preview" style={{ width: "70%", display: "block", margin: "6px auto" }} />
                  ) : boxes[0] && qrMap[boxes[0].code] ? (
                    <img src={qrMap[boxes[0].code]} alt="preview" style={{ width: "70%", display: "block", margin: "6px auto" }} />
                  ) : (
                    <div style={{ width: "70%", height: 80, background: "#f0f0f0", margin: "6px auto" }} />
                  )}
                </div>
                {selected.length > 0 && (boxes.find((b) => b.code === selected[0])?.name) && (
                  <div style={{ fontSize: 12 }}>{boxes.find((b) => b.code === selected[0])?.name}</div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowPrintModal(false); printSelected(); }} className="tap-btn">Print (system)</button>
              <button onClick={() => { setShowPrintModal(false); exportSelectedPDF(); }} className="tap-btn primary">Export PDF</button>
              <button onClick={() => { setShowPrintModal(false); setShowBluetoothConfirm(true); }} className="tap-btn">Bluetooth print</button>
              <button onClick={() => setShowPrintModal(false)} className="tap-btn">Cancel</button>
            </div>

            <div style={{ fontSize: 13, opacity: 0.85 }}>
              You can print directly to a connected printer via the system dialog, export a PDF, or use experimental Bluetooth printing. Bluetooth support varies by device.
            </div>
          </div>
        </Modal>

        {/* Share modal */}
        <Modal open={showShareModal} title="Share labels" onClose={() => setShowShareModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14 }}>
              Share {selected.length} label{selected.length !== 1 ? "s" : ""} as images (if supported) or copy a list of codes to clipboard.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => { setShowShareModal(false); await shareSelected(); }} className="tap-btn">Share as images</button>
              <button onClick={() => { navigator.clipboard.writeText(`Boxes: ${selected.join(", ")}`); setShowShareModal(false); alert("Copied box list to clipboard"); }} className="tap-btn">Copy list</button>
              <button onClick={() => setShowShareModal(false)} className="tap-btn">Cancel</button>
            </div>
          </div>
        </Modal>

        {/* Bluetooth confirm modal */}
        <Modal open={showBluetoothConfirm} title="Bluetooth printing" onClose={() => setShowBluetoothConfirm(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14 }}>
              Bluetooth printing is experimental. Connect to a BLE label printer that accepts raw image data and proceed?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => { setShowBluetoothConfirm(false); await bluetoothPrintSelected(); }} className="tap-btn primary">Proceed</button>
              <button onClick={() => setShowBluetoothConfirm(false)} className="tap-btn">Cancel</button>
            </div>
          </div>
        </Modal>
      </main>
    </RequireAuth>
  );
}
