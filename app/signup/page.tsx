"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

export default function SignupPage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) window.location.href = "/locations";
  }, [loading, user]);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);

    const res = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          "https://storage-inventory-git-main-jasons-projects-b71e691b.vercel.app/login",
      },
    });

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    setMsg("Account created. Check your email on your phone and confirm the account, then return to Login.");
    setBusy(false);
  }

  return (
    <main style={{ paddingBottom: 90 }}>
      <div
        style={{
          padding: 16,
          borderRadius: 18,
          border: "1px solid #e5e7eb",
          background: "#fff",
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
        }}
      >
        <h1 className="sr-only" style={{ marginTop: 0 }}>Sign up</h1>

        <form onSubmit={onSignup} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            placeholder="Password (min 6 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          {error && (
            <div style={{ color: "crimson", fontWeight: 700 }}>
              Error: {error}
            </div>
          )}
          {msg && (
            <div style={{ color: "#0f766e", fontWeight: 700 }}>{msg}</div>
          )}

          <button
            type="submit"
            disabled={busy || !email.trim() || password.length < 6}
          >
            {busy ? "Creating..." : "Create account"}
          </button>

          <a
            className="tap-btn"
            href="/login"
            style={{
              textAlign: "center",
              padding: 12,
              borderRadius: 14,
              border: "1px solid #ddd",
              background: "#fff",
              textDecoration: "none",
              color: "#111",
              fontWeight: 800,
            }}
          >
            Back to login
          </a>
        </form>
      </div>
    </main>
  );
}
