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
    const owner = userRes.data.user;
    if (!owner) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Send Supabase invite email (creates user if needed)
    const inviteRes = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${new URL(req.url).origin}/login`,
    });

    if (inviteRes.error) {
      return NextResponse.json({ error: inviteRes.error.message }, { status: 400 });
    }

    // Record invite so we can link membership after sign-in
    const insert = await admin
      .from("inventory_invites")
      .upsert(
        {
          owner_id: owner.id,
          email,
          accepted_at: null,
        },
        { onConflict: "owner_id,email" }
      );

    if (insert.error) {
      // Invite email already sent; still return ok
      return NextResponse.json({ ok: true, warning: insert.error.message });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
