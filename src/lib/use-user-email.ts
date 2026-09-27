"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Email of the signed-in user, for client pages that don't get it from the server.
// Undefined while loading or when signed out.
export function useUserEmail(): string | undefined {
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    try {
      createSupabaseBrowserClient()
        .auth.getUser()
        .then(({ data }) => {
          if (!cancelled) setEmail(data.user?.email ?? undefined);
        })
        .catch(() => {});
    } catch {
      // Supabase env missing: stay signed out.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return email;
}
