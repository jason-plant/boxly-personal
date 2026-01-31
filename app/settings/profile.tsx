"use client";

import React, { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import { supabase } from "../lib/supabaseClient";

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        setEmail(data.user.email || "");
        setAvatar(data.user.user_metadata?.avatar_url || null);
        setName(data.user.user_metadata?.name || "");
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ data: { name } });
    if (error) {
      setStatus("Failed to update name: " + error.message);
    } else {
      setStatus("Name updated!");
    }
    setLoading(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setAvatarFile(e.target.files[0]);
    // Optionally upload to storage and update user_metadata
    // ...implement upload logic here if desired...
    setStatus("Avatar upload not implemented in demo.");
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Are you sure you want to permanently delete your account? This cannot be undone.")) return;
    setStatus("");
    // Supabase does not allow self-service account deletion by default; you may need a backend function
    setStatus("Account deletion is not available in this demo. Contact support.");
  }

  return (
    <RequireAuth>
      <main style={{ padding: 16 }}>
        <h1 style={{ marginTop: 6, marginBottom: 10 }}>Profile</h1>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 14, borderRadius: 14, maxWidth: 420 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              <form onSubmit={handleNameSave} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontWeight: 700 }}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  style={{ marginTop: 4, marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "#f7f7f7" }}
                  disabled={loading}
                />
                <button type="submit" className="tap-btn" style={{ minWidth: 120 }} disabled={loading || !name.trim()}>
                  Save Name
                </button>
              </form>

              <div>
                <label style={{ fontWeight: 700 }}>Email</label>
                <div style={{ marginTop: 4, marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "#f7f7f7" }}>
                  {email}
                </div>
              </div>



              <div>
                <label style={{ fontWeight: 700, color: "#b91c1c" }}>Danger zone</label>
                <button className="tap-btn danger" onClick={handleDeleteAccount} style={{ minWidth: 160, marginTop: 6 }}>
                  Delete account
                </button>
              </div>

              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{status}</div>
            </div>
          </section>
        )}
      </main>
    </RequireAuth>
  );
}
