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
    if (!loading && user) {
      window.location.href = "/locations";
    }
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
    <main style={{ maxWidth: 420, margin: "40px auto" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Log in</h1>
        <p style={{ opacity: 0.75, marginTop: 0 }}>
          Sign in to your inventory
        </p>

        <form onSubmit={onLogin} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <div style={{ color: "crimson", fontWeight: 700 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email || password.length < 6}
            style={{
              background: "#111",
              color: "#fff",
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
              fontWeight: 800,
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
