"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) window.location.href = "/locations";
  }, [loading, user]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (res.error) {
      setError(res.error.message);
      setBusy(false);
      return;
    }

    window.location.href = "/locations";
  }

  return (
    <main style={{ paddingTop: 18, paddingBottom: 18 }}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
        }}
      >
        <h1 className="sr-only" style={{ margin: "0 0 6px 0" }}>Log in</h1>
        <div style={{ opacity: 0.75, marginBottom: 14 }}>
          Sign in to your inventory
        </div>

        <form onSubmit={onLogin} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontWeight: 800, fontSize: 13, opacity: 0.8 }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontWeight: 800, fontSize: 13, opacity: 0.8 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              style={{
                color: "crimson",
                fontWeight: 800,
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                padding: 10,
                borderRadius: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email.trim() || password.length < 6}
            className="tap-btn"
            style={{
              background: "#111",
              color: "#fff",
              border: "1px solid #111",
              fontWeight: 900,
            }}
          >
            {busy ? "Signing in…" : "Log in"}
          </button>

          <a
            href="/signup"
            className="tap-btn"
            style={{
              textAlign: "center",
              padding: 12,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#fff",
              textDecoration: "none",
              fontWeight: 900,
              color: "#111",
            }}
          >
            Create an account
          </a>
        </form>
      </div>
    </main>
  );
}
