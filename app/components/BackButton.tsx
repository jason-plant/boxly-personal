"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUnsavedChanges } from "./UnsavedChangesProvider";
import Modal from "./Modal";

function getBoxCodeFromPath(pathname: string | null): string {
  if (!pathname) return "";
  const m = /^\/box\/([^/?#]+)(?:\/|$)/i.exec(pathname);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export default function BackButton({ fallback = "/locations" }: { fallback?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { isDirty, setDirty } = useUnsavedChanges();

  const [showConfirm, setShowConfirm] = useState(false);

  const boxCode = useMemo(() => getBoxCodeFromPath(pathname), [pathname]);
  const [boxLocationTarget, setBoxLocationTarget] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!boxCode) {
      setBoxLocationTarget("");
      return;
    }

    const key = `boxLocation:${boxCode.toUpperCase()}`;
    const locId = window.sessionStorage.getItem(key) || "";
    if (locId) setBoxLocationTarget(`/locations/${encodeURIComponent(locId)}`);
    else setBoxLocationTarget("");
  }, [boxCode]);

  const returnToParam = searchParams?.get("returnTo") ?? "";
  const safeReturnTo = returnToParam.startsWith("/") && !returnToParam.startsWith("//") ? returnToParam : "";
  const forcedTarget = safeReturnTo || boxLocationTarget || (pathname === "/boxes" ? "/locations" : "");

  function goBack() {
    if (isDirty) {
      setShowConfirm(true);
      return;
    }

    if (forcedTarget) {
      router.push(forcedTarget);
      return;
    }

    // If there's a history entry, go back; otherwise navigate to a safe fallback
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Go back"
        onClick={goBack}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
          marginRight: 6,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <Modal open={showConfirm} title="Discard changes?" onClose={() => setShowConfirm(false)}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>You have unsaved changes. Discard and go back?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowConfirm(false)}>Cancel</button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setDirty(false);
                if (forcedTarget) {
                  router.push(forcedTarget);
                  return;
                }
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push(fallback);
                }
              }}
              style={{ background: "#ef4444", color: "#fff" }}
            >
              Discard
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
