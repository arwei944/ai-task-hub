import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/error-boundary";
import { I18nProvider } from "@/lib/i18n";
import { I18nLangSync } from "@/components/i18n-lang-sync";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { ProjectProvider } from "@/lib/project-context";
import { SkipNav } from "@/components/ui/a11y";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { GlobalSearch } from "@/components/layout/global-search";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Task Hub",
  description: "AI 驱动的智能任务管理平台",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Task Hub",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex bg-background text-foreground">
        <ProjectProvider>
          <ThemeProvider>
            <I18nProvider>
              <I18nLangSync />
              <ToastProvider>
                <ErrorBoundary>
                  <SkipNav />
                  <Sidebar />
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center gap-3 px-4 md:px-6 pt-4">
                      <Breadcrumb />
                      <div className="ml-auto">
                        <GlobalSearch />
                      </div>
                    </div>
                    <main id="main-content" className="flex-1 pb-16 md:pb-0 px-4 md:px-6">{children}</main>
                    <MobileBottomNav />
                  </div>
                  <ServiceWorkerRegistration />
                  <PWAInstallPrompt />
                </ErrorBoundary>
              </ToastProvider>
            </I18nProvider>
          </ThemeProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
