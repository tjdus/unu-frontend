"use client";

import { useEffect, useState } from "react";
import { getMe } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/AuthContext";

// Shared across the app shell (sidebar user card, top bar avatar) so it is fetched once.
let cached: { userId: string; name: string } | null = null;
let pending: Promise<string> | null = null;

/** Display name of the signed-in user for the app shell. */
export function useMyName() {
  const { userId, isAuthenticated } = useAuth();
  const [name, setName] = useState<string | null>(
    cached && cached.userId === userId ? cached.name : null,
  );

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (cached && cached.userId === userId) {
      setName(cached.name);
      return;
    }
    let alive = true;
    pending ??= getMe().then((me) => me.name || me.username);
    pending
      .then((value) => {
        cached = { userId, name: value };
        if (alive) setName(value);
      })
      .catch(() => undefined)
      .finally(() => {
        pending = null;
      });
    return () => {
      alive = false;
    };
  }, [isAuthenticated, userId]);

  return name;
}
