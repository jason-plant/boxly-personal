"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      if (!email.trim() || !password) {
        setErr("Email and password are required.");
        setBusy(false);
        return;
      }

      if (mode === "signin") {
        const res = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (res.error) throw res.error;

        router.push("/boxes");
        return;
      }

      // signup
      const res = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (res.error) throw res.error;

      // If email confirmations are ON, user must confirm first
      setMsg(
        "Account created. If email confirmation is enabled, check your inbox then come back and sign in."
      );
    } catch (e: any) {
      setErr(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
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
        <h1 style={{ margin: 0 }}>{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p style={{ marginTop: 8, opacity: 0.85 }}>
          {mode === "signin"
            ? "Sign in to access your inventory."
            : "Create an account to start your own private inventory."}
        </p>

        {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
        {msg && <p style={{ color: "#166534" }}>{msg}</p>}

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            style={{ background: "#111", color: "#fff" }}
          >
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setErr(null);
              setMsg(null);
              setMode((m) => (m === "signin" ? "signup" : "signin"));
            }}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
