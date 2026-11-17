"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type HomeLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onNavigate">;

export function HomeLink(props: HomeLinkProps) {
  return (
    <Link
      {...props}
      href="/"
      onNavigate={(event) => {
        if (window.location.pathname !== "/") return;
        event.preventDefault();
        if (window.location.hash || window.location.search) {
          window.history.pushState(null, "", "/");
        }
        window.scrollTo({ top: 0, behavior: "instant" });
      }}
    />
  );
}
