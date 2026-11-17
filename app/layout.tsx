import type { Metadata } from "next";
import { Geist, Geist_Mono, Google_Sans_Flex, Instrument_Sans, Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import "./public-page-swipe.css";
import { NavigationBar } from "@/components/custom/navigation-bar";
import { SiteFooter } from "@/components/custom/site-footer";
import { PublicPageSwipe } from "@/components/custom/public-page-swipe";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { SidebarProvider } from "@/lib/contexts/SidebarContext";
import { Toaster } from "@/components/ui/sonner";
import { ActivityNoticeUnreadProvider } from "@/lib/contexts/ActivityNoticeUnreadContext";
import { MenuNotificationProvider } from "@/lib/contexts/MenuNotificationContext";
import { NoticeUnreadProvider } from "@/lib/contexts/NoticeUnreadContext";

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

const googleSansFlex = Google_Sans_Flex({
  variable: "--font-google-sans-flex",
  weight: "variable",
  preload: false,
  adjustFontFallback: false,
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: "variable",
  preload: false,
  adjustFontFallback: false,
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
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${instrumentSans.variable} ${googleSansFlex.variable} ${notoSansKr.variable} antialiased`}
      >
        <AuthProvider>
          <NoticeUnreadProvider>
            <ActivityNoticeUnreadProvider>
              <MenuNotificationProvider>
                <PublicPageSwipe>
                  <SidebarProvider>
                    <NavigationBar />
                    {children}
                    <SiteFooter />
                  </SidebarProvider>
                </PublicPageSwipe>
                <Toaster />
              </MenuNotificationProvider>
            </ActivityNoticeUnreadProvider>
          </NoticeUnreadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
