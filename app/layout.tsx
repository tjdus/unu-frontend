import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Sans, Inter } from "next/font/google";
import "./globals.css";
import { NavigationBar } from "@/components/custom/navigation-bar";
import { SiteFooter } from "@/components/custom/site-footer";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { SidebarProvider } from "@/lib/contexts/SidebarContext";
import { Toaster } from "@/components/ui/sonner";
import { ActivityNoticeUnreadProvider } from "@/lib/contexts/ActivityNoticeUnreadContext";
import { MenuNotificationProvider } from "@/lib/contexts/MenuNotificationContext";
import { NoticeUnreadProvider } from "@/lib/contexts/NoticeUnreadContext";
import { ApplicantNotificationProvider } from "@/lib/contexts/ApplicantNotificationContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CNU&U",
  description: "서강대학교 CNU 운영 및 활동 관리 시스템",
  icons: {
    icon: "/cnu-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${instrumentSans.variable} antialiased`}
      >
        <AuthProvider>
          <NoticeUnreadProvider>
            <ActivityNoticeUnreadProvider>
              <MenuNotificationProvider>
                <ApplicantNotificationProvider>
                  <div className="min-h-screen flex flex-col">
                    <SidebarProvider>
                      <NavigationBar />
                      {children}
                      <SiteFooter />
                    </SidebarProvider>
                  </div>
                  <Toaster />
                </ApplicantNotificationProvider>
              </MenuNotificationProvider>
            </ActivityNoticeUnreadProvider>
          </NoticeUnreadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
