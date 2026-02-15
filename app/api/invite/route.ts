import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const email = (body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    const userRes = await admin.auth.getUser(token);
    const inviter = userRes.data.user;
    if (!inviter) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // If the inviter is a member of someone else's inventory, invite into that owner's inventory.
    const ownerLookup = await admin
      .from("inventory_members")
      .select("owner_id")
      .eq("member_id", inviter.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const inventoryOwnerId = (ownerLookup.data as any)?.owner_id || inviter.id;

    // Record invite so we can link membership after sign-in
    const insert = await admin
      .from("inventory_invites")
      .upsert(
        {
          owner_id: inventoryOwnerId,
          email,
          accepted_at: null,
        },
        { onConflict: "owner_id,email" }
      );

    if (insert.error) {
      // Invite email already sent; still return ok
      return NextResponse.json({ ok: true, warning: insert.error.message });
    }

    const origin = new URL(req.url).origin;
    const link = `${origin}/signup?email=${encodeURIComponent(email)}`;
    return NextResponse.json({ ok: true, link });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
