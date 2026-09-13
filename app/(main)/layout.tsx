"use client";

import { Sidebar } from "@/components/layout/Sidebar";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-1 items-start">
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
