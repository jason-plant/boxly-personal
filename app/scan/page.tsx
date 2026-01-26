"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "../components/RequireAuth";

export default function ScanPage() {
  const router = useRouter();
  const scannerRef = useRef<any>(null);
  const startedRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    // Prevent double start in React strict mode
    if (startedRef.current) return;
    startedRef.current = true;

    async function startScanner() {
      setError(null);

      try {
        const mod = await import("html5-qrcode");
        const Html5QrcodeScanner = (mod as any).Html5QrcodeScanner;

        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            rememberLastUsedCamera: true,
          },
          false
        );

        scannerRef.current = scanner;

        scanner.render(
          (decodedText: string) => {
            const text = decodedText.trim();

            // 🔔 HAPTIC FEEDBACK (phone only)
            if ("vibrate" in navigator) {
              navigator.vibrate(120);
            }

            // 🟢 Green border flash
            setFlash(true);
            setTimeout(() => setFlash(false), 300);

            // Stop scanning immediately after success
            try {
              scanner.clear();
            } catch {
              /* ignore */
            }

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

            setError(`QR not recognised: ${text}`);
          },
          () => {
            // ignore scan errors while camera is searching
          }
        );
      } catch (e: any) {
        setError(e?.message || "Unable to start camera. Check browser permissions.");
      }
    }

    startScanner();

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {
          /* ignore */
        }
      }
    };
  }, [router]);

  return (
    <RequireAuth>
      <main style={{ paddingBottom: 90 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
            marginTop: 6,
          }}
        >
          <h1 style={{ margin: 0 }}>Scan QR</h1>
          <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.85 }}>
            Point your camera at a box QR code.
          </p>

          {error && <p style={{ color: "crimson", marginTop: 10 }}>Error: {error}</p>}

          <div
            id="qr-reader"
            style={{
              width: "100%",
              maxWidth: 520,
              minHeight: 380,
              marginTop: 12,
              borderRadius: 18,
              overflow: "hidden",
              background: "#fff",
              border: flash ? "4px solid #22c55e" : "2px solid #e5e7eb",
              transition: "border 0.2s ease",
              boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
            }}
          />
        </div>
      </main>
    </RequireAuth>
  );
}
