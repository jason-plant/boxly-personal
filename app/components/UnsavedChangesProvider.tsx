"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Context = {
  isDirty: boolean;
  setDirty: (v: boolean) => void;
};

const ctx = createContext<Context>({ isDirty: false, setDirty: () => {} });

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);

  const setDirty = useCallback((v: boolean) => setIsDirty(v), []);

  // beforeunload to prevent accidental close/refresh
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = "";
      return "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const value = useMemo(() => ({ isDirty, setDirty }), [isDirty, setDirty]);

  return <ctx.Provider value={value}>{children}</ctx.Provider>;
}

export function useUnsavedChanges() {
  return useContext(ctx);
}
