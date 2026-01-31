"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "../components/RequireAuth";

export default function ScanPage() {
  return (
    <RequireAuth>
      <ScanInner />
    </RequireAuth>
  );
}

function ScanInner() {
  const router = useRouter();

  const qrRef = useRef<any>(null); // Html5Qrcode instance
  const startingRef = useRef(false);
  const navigatingRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  async function stopAndClear() {
    const inst = qrRef.current;
    if (!inst) return;

    try {
      const isScanning = await inst.isScanning?.();
      if (isScanning) {
        await inst.stop();
      }
    } catch {
      // ignore
    }

    try {
      await inst.clear();
    } catch {
      // ignore
    }

    qrRef.current = null;

    // Important: remove leftover DOM that can block re-init on mobile
    const el = document.getElementById("qr-reader");
    if (el) el.innerHTML = "";
  }

  useEffect(() => {
    if (startingRef.current) return;
    startingRef.current = true;

    let cancelled = false;

    async function start() {
      setError(null);

      try {
        const mod = await import("html5-qrcode");
        const Html5Qrcode = (mod as any).Html5Qrcode;

        if (cancelled) return;

        // fresh container each time
        const el = document.getElementById("qr-reader");
        if (el) el.innerHTML = "";

        const html5Qr = new Html5Qrcode("qr-reader");
        qrRef.current = html5Qr;

        // Start camera
        await html5Qr.start(
          { facingMode: "environment" }, // back camera
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decodedText: string) => {
            if (navigatingRef.current) return;
            navigatingRef.current = true;

            const text = decodedText.trim();

            // vibrate
            if ("vibrate" in navigator) navigator.vibrate(120);

            // green flash
            setFlash(true);
            setTimeout(() => setFlash(false), 250);

            // fully release camera BEFORE navigating
            await stopAndClear();

            // Full URL in QR → go there
            if (text.startsWith("http://") || text.startsWith("https://")) {
              window.location.href = text;
              return;
            }

            // BOX-001 → go to box page
            if (/^BOX-\d{3}$/i.test(text)) {
              router.push(`/box/${encodeURIComponent(text.toUpperCase())}`);
              return;
            }

            // Relative path like /box/BOX-001
            if (text.startsWith("/")) {
              router.push(text);
              return;
            }

            navigatingRef.current = false;
            setError(`QR not recognised: ${text}`);
          },
          () => {
            // ignore per-frame scan errors
          }
        );
      } catch (e: any) {
        navigatingRef.current = false;
        setError(e?.message || "Unable to start camera. Check browser permissions.");
        // make sure nothing is half-open
        await stopAndClear();
      }
    }

    start();

    return () => {
      cancelled = true;
      navigatingRef.current = false;
      startingRef.current = false;
      stopAndClear();
    };
  }, [router]);

  return (
    <main style={{ padding: 20 }}>
      <h1 className="sr-only">Scan QR</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>Point your camera at a box QR code.</p>

      {error && <p style={{ color: "crimson", fontWeight: 700 }}>Error: {error}</p>}

      <div
        id="qr-reader"
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: 380,
          borderRadius: 18,
          overflow: "hidden",
          background: "#fff",
          border: flash ? "4px solid #22c55e" : "1px solid #e5e7eb",
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
          transition: "border 0.2s ease",
        }}
      />
    </main>
  );
}
