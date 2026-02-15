"use client";

import { supabase } from "./supabaseClient";

export async function getInventoryOwnerIdForUser(userId: string): Promise<string> {
  if (typeof window !== "undefined") {
    const cached = window.sessionStorage.getItem(`inventoryOwnerId:${userId}`);
    if (cached) return cached;
  }

  const memberRes = await supabase
    .from("inventory_members")
    .select("owner_id")
    .eq("member_id", userId)
    .maybeSingle();

  const ownerId = (memberRes.data as any)?.owner_id || userId;

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(`inventoryOwnerId:${userId}`, ownerId);
  }

  return ownerId;
}

export async function getInventoryOwnerId(): Promise<string | null> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes.user;
  if (userErr || !user) return null;
  return getInventoryOwnerIdForUser(user.id);
}

export async function acceptPendingInvitesOnce(): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return;

  if (typeof window !== "undefined") {
    const already = window.sessionStorage.getItem(`invitesAccepted:${user.id}`);
    if (already === "1") return;
  }

  const { data: sessionRes } = await supabase.auth.getSession();
  const token = sessionRes.session?.access_token;
  if (!token) return;

  try {
    await fetch("/api/accept-invite", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } finally {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`invitesAccepted:${user.id}`, "1");
      // owner scope may have changed; clear cached owner id so next fetch sees membership.
      window.sessionStorage.removeItem(`inventoryOwnerId:${user.id}`);
    }
  }
}
