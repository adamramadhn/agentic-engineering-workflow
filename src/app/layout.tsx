import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Onyx — Premium Admin & SaaS Dashboard Template",
  description:
    "Production-grade, commercial admin template built with Next.js 16, React 19, Shadcn/UI, and Tailwind CSS. Multi-dashboard, analytics, transactions, alerts, and AI copilot.",
  keywords: [
    "shadcn admin",
    "tailwind dashboard",
    "nextjs admin template",
    "saas dashboard",
    "themeforest admin template",
    "onyx dashboard",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} h-full antialiased`}
    >
      <body className={`${geistSans.className} min-h-full font-sans transition-colors duration-200`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
