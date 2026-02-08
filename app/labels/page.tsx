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
  const [printLayout, setPrintLayout] = useState<string>("50x80");
  const [showHint, setShowHint] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

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
    let labelStyle = "width:50mm;height:80mm;";
    if (printLayout === "40x30") {
      labelStyle = "width:40mm;height:30mm;";
    }
    const labelClass = printLayout === "40x30" ? "label layout-40x30" : "label layout-50x80";

    for (let i = 0; i < finalCount; i++) {
      for (const code of selected) {
        const b = boxes.find((bb) => bb.code === code)!;
        const img = qrMap[code] || "";
        itemsHtml.push(`<div class="${labelClass}" style="${labelStyle}"><div class="inner"><div class="code">${code}</div>${b.name ? `<div class="name">${b.name}</div>` : ""}<img src="${img}" /></div></div>`);
      }
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Labels</title><style>body{padding:20px;font-family:Arial} .label{border:1px solid #000;padding:4px;border-radius:8px;display:inline-block;margin:6px;box-sizing:border-box;vertical-align:top;overflow:hidden;position:relative} .label .inner{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start} .label img{width:46mm;height:46mm;display:block;margin:10mm auto 0} .label .code,.label .name{font-weight:900;font-size:28px;text-align:center;width:100%} .layout-40x30 .inner{width:18mm;height:28mm;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg)} .layout-40x30 img{width:16mm;height:16mm;margin:4px auto 0} .layout-50x80 .code,.layout-50x80 .name{font-size:28px} .no-print{display:none}@media print{body{padding:6mm} .label{page-break-inside:avoid}}</style></head><body>${itemsHtml.join("")}</body></html>`; 

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
      const html2canvas = (await import("html2canvas")).default;

      let pxWidth = 600;
      let pxHeight = 960;
      if (printLayout === "40x30") {
        pxWidth = 480;
        pxHeight = 360;
      }

      for (const code of selected) {
        const b = boxes.find((bb) => bb.code === code);
        const qr = qrMap[code] || "";
        if (!b || !qr) continue;

        const el = document.createElement("div");
        el.style.width = pxWidth + "px";
        el.style.height = pxHeight + "px";
        el.style.padding = "16px";
        el.style.boxSizing = "border-box";
        el.style.border = "1px solid #000";
        el.style.background = "#fff";
        el.style.fontFamily = "Arial, sans-serif";

        const isLarge = printLayout === "50x80";
        const codeSize = isLarge ? 28 : 24;
        const qrWidth = isLarge ? "92%" : "70%";
        const innerStyle = printLayout === "40x30"
          ? "width:216px;height:336px;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg)"
          : "width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start";
        const qrMargin = isLarge ? "120px" : "6px";

        el.innerHTML = `
          <div style="position:relative;width:100%;height:100%">
            <div style="${innerStyle}">
              <div style="font-weight:900;font-size:${codeSize}px;text-align:center;width:100%">${code}</div>
              ${b.name ? `<div style=\"font-weight:900;font-size:${codeSize}px;text-align:center;width:100%;margin-top:4px\">${b.name}</div>` : ""}
              <img src="${qr}" style="width:${qrWidth};display:block;margin:${qrMargin} auto 0" />
            </div>
          </div>
        `;

        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);

        const canvas = await html2canvas(el, { scale: 2 });
        const dataUrl = canvas.toDataURL("image/png");
        document.body.removeChild(el);

        const res = await fetch(dataUrl);
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
        const codeSize = printLayout === "50x80" ? 28 : 24;
        const qrWidth = printLayout === "50x80" ? "46mm" : "16mm";
        const qrHeight = printLayout === "50x80" ? "46mm" : "16mm";
        const innerStyle = printLayout === "40x30"
          ? "width:18mm;height:28mm;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg)"
          : "width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start";
        const qrMargin = printLayout === "50x80" ? "10mm" : "6px";
        el.innerHTML = `<div style="position:relative;width:100%;height:100%"><div style="${innerStyle}"><div style="font-weight:900;font-size:${codeSize}px;text-align:center;width:100%">${code}</div>${b.name ? `<div style="font-weight:900;font-size:${codeSize}px;text-align:center;width:100%;margin-top:4px">${b.name}</div>` : ""}<img src="${qrMap[code] || ""}" style="width:${qrWidth};height:${qrHeight};display:block;margin:${qrMargin} auto 0" /></div></div>`;
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
    const finalCount = parseCopies();
    if (finalCount < 1) return alert("Please enter a quantity of at least 1");
    // Layouts: 50x80mm (600x960px), 40x30mm (480x360px)
    let pxWidth = 600, pxHeight = 960;
    if (printLayout === "40x30") {
      pxWidth = 480;
      pxHeight = 360;
    }
    for (let i = 0; i < finalCount; i++) {
      for (const code of selected) {
        const b = boxes.find((bb) => bb.code === code)!;
        const canvas = document.createElement("canvas");
        canvas.width = pxWidth;
        canvas.height = pxHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        // Fill background
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, pxWidth, pxHeight);
        // Draw border
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, pxWidth, pxHeight);
        // Draw code (move down, size based on label)
        const isLarge = printLayout === "50x80";
        const codeSize = isLarge ? 80 : 44;
        const nameSize = codeSize;
        const qrSize = isLarge ? Math.round(pxWidth * 0.92) : 192;

        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        if (printLayout === "40x30") {
          ctx.save();
          ctx.translate(pxWidth / 2, pxHeight / 2);
          ctx.rotate(Math.PI / 2);
          ctx.translate(-pxHeight / 2, -pxWidth / 2);
          const innerW = pxHeight;
          const insetY = 72;
          ctx.font = `900 ${codeSize}px Arial`;
          ctx.fillText(code, innerW / 2, 28 + insetY);
          if (b.name) {
            ctx.font = `900 ${nameSize}px Arial`;
            ctx.fillText(b.name, innerW / 2, 28 + insetY + codeSize + 8);
          }
          const qrImg = new window.Image();
          qrImg.src = qrMap[code] || "";
          await new Promise((resolve) => {
            qrImg.onload = resolve;
            qrImg.onerror = resolve;
          });
          const qrX = (innerW - qrSize) / 2;
          const qrY = 28 + insetY + codeSize + 8 + nameSize + 10;
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
          ctx.restore();
        } else {
          ctx.font = `900 ${codeSize}px Arial`;
          ctx.fillText(code, pxWidth / 2, 28);
          if (b.name) {
            ctx.font = `900 ${nameSize}px Arial`;
            ctx.fillText(b.name, pxWidth / 2, 28 + codeSize + 8);
          }
          const qrImg = new window.Image();
          qrImg.src = qrMap[code] || "";
          await new Promise((resolve) => {
            qrImg.onload = resolve;
            qrImg.onerror = resolve;
          });
          const qrX = (pxWidth - qrSize) / 2;
          const qrY = 28 + codeSize + 8 + nameSize + 10 + (isLarge ? 120 : 0);
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        }
        // Download the image
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${code}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
                      <option value="50x80">50 x 80 (mm)</option>
                      <option value="40x30">40 x 30 (mm)</option>
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
        <Modal open={showPrintModal} title="Print selected" onClose={() => setShowPrintModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                Copies:
                <input type="number" value={copies} onChange={(e) => setCopies(e.target.value)} placeholder="1" style={{ width: 80, padding: 6, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              </label>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                Layout:
                <select value={printLayout} onChange={(e) => setPrintLayout(e.target.value)} style={{ padding: 6, borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  <option value="50x80">50 x 80 (mm)</option>
                  <option value="40x30">40 x 30 (mm)</option>
                </select>
              </label>
            </div>

            {/* Preview */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              {(() => {
                const isLarge = printLayout === "50x80";
                const previewW = isLarge ? 200 : 160;
                const previewH = isLarge ? 320 : 120;
                const codeSize = isLarge ? 22 : 16;
                const qrSize = isLarge ? 120 : 56;
                const qrMarginTop = isLarge ? 40 : 6;
                const innerStyle: React.CSSProperties = isLarge
                  ? { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center" }
                  : {
                      width: 72,
                      height: 112,
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%) rotate(90deg)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    };

                const previewCode = selected.length > 0 ? selected[0] : (boxes[0]?.code ?? "BOX-CODE");
                const previewName = selected.length > 0 ? boxes.find((b) => b.code === selected[0])?.name : boxes[0]?.name;
                const previewQr = selected.length > 0 ? qrMap[selected[0]] : (boxes[0] ? qrMap[boxes[0].code] : "");

                return (
                  <div
                    style={{
                      width: previewW,
                      height: previewH,
                      border: "1px solid #000",
                      padding: 6,
                      borderRadius: 8,
                      position: "relative",
                      background: "#fff",
                      overflow: "hidden",
                    }}
                  >
                    <div style={innerStyle}>
                      <div style={{ fontWeight: 900, fontSize: codeSize, textAlign: "center", width: "100%" }}>{previewCode}</div>
                      {previewName && (
                        <div style={{ fontWeight: 900, fontSize: codeSize, textAlign: "center", width: "100%", marginTop: 4 }}>{previewName}</div>
                      )}
                      {previewQr ? (
                        <img src={previewQr} alt="preview" style={{ width: qrSize, height: qrSize, marginTop: qrMarginTop }} />
                      ) : (
                        <div style={{ width: qrSize, height: qrSize, background: "#f0f0f0", marginTop: qrMarginTop }} />
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => { setShowPrintModal(false); printSelected(); }} className="tap-btn">Print (system)</button>
              <button onClick={() => { setShowPrintModal(false); exportSelectedPDF(); }} className="tap-btn">Export PDF</button>
              <button onClick={() => { setShowPrintModal(false); exportSelectedImages(); }} className="tap-btn">Export image</button>
              <button onClick={() => { setShowPrintModal(false); setShowShareModal(true); }} className="tap-btn">Share</button>
              <button onClick={() => setShowPrintModal(false)} className="tap-btn">Cancel</button>
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

      </main>
    </RequireAuth>
  );
}
