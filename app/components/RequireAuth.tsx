"use client";

import React, { useEffect } from "react";
import { useAuth } from "../lib/auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [loading, user]);

  if (loading) return <p>Loading...</p>;
  if (!user) return null;

  return <>{children}</>;
}
