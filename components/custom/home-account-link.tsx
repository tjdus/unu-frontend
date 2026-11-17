"use client";

import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";

/**
 * Top-right link of the home hero: "Login" for guests, "My Page" (→ the app's 내 활동)
 * once signed in. Renders nothing while the session is still being resolved so the
 * wrong label never flashes.
 */
export function HomeAccountLink({ className }: { className?: string }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return null;

  return isAuthenticated ? (
    <Link href="/home" className={className}>
      My Page
    </Link>
  ) : (
    <Link href="/login" className={className}>
      Login
    </Link>
  );
}
