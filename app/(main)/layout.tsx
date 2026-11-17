"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppTopBar } from "@/components/layout/AppTopBar";
import "./app-m3.css";

/**
 * Keeps --app-scrollbar in sync with the page scrollbar's width so the panel's right
 * margin can give that space back (the green frame then looks even on top and right).
 */
function useScrollbarWidth() {
  useEffect(() => {
    const root = document.documentElement;
    // The gutter is always reserved (scrollbar-gutter: stable), so measure the platform's
    // scrollbar with a probe instead of waiting for the page to overflow.
    const update = () => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll";
      document.body.appendChild(probe);
      const width = probe.offsetWidth - probe.clientWidth;
      probe.remove();
      root.style.setProperty("--app-scrollbar", `${width}px`);
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      root.style.removeProperty("--app-scrollbar");
    };
  }, []);
}

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useScrollbarWidth();

  return (
    // data-app-m3 switches on the M3 minimal theme (app-m3.css) for the logged-in app.
    // The page sits in a rounded white panel framed by the sidebar's green.
    <div data-app-m3 className="flex min-h-dvh flex-1 items-start bg-[#10603f]">
      <Sidebar />
      <main data-app-main className="app-panel min-w-0 flex-1 rounded-2xl bg-white">
        <AppTopBar />
        {children}
      </main>
    </div>
  );
}
