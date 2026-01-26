"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!mounted) return;

      setAuthed(hasSession);
      setChecking(false);

      if (!hasSession && pathname !== "/login") {
        router.replace("/login");
      }
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = !!session;
      setAuthed(hasSession);
      setChecking(false);

      if (!hasSession && pathname !== "/login") {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (checking) {
    return (
      <main style={{ padding: 16 }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!authed) {
    // We redirect to /login. Returning null prevents flashing protected UI.
    return null;
  }

  return <>{children}</>;
}
