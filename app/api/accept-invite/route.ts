import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();

    const userRes = await admin.auth.getUser(token);
    const user = userRes.data.user;
    if (!user || !user.email) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const email = user.email.toLowerCase();

    const invitesRes = await admin
      .from("inventory_invites")
      .select("owner_id, role")
      .eq("email", email)
      .is("accepted_at", null);

    if (invitesRes.error) {
      return NextResponse.json({ ok: true });
    }

    const invites = (invitesRes.data ?? []) as Array<{ owner_id: string; role?: string | null }>;

    for (const inv of invites) {
      const roleRaw = String(inv.role || "editor").toLowerCase();
      const role = roleRaw === "viewer" ? "viewer" : "editor";
      // insert membership (idempotent)
      await admin
        .from("inventory_members")
        .upsert(
          {
            owner_id: inv.owner_id,
            member_id: user.id,
            member_email: email,
            role,
          },
          { onConflict: "owner_id,member_id" }
        );
    }

    // mark accepted
    if (invites.length > 0) {
      await admin
        .from("inventory_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("email", email)
        .is("accepted_at", null);
    }

    return NextResponse.json({ ok: true, accepted: invites.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
