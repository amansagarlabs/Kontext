import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GeistPixelGrid } from "geist/font/pixel";
import { ThemeInit } from "@/components/theme-init";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AmanAgent Lab | AI Agent Workspace",
  description:
    "AmanAgent Lab is an AI agent workspace for chat, documents, memory, and automation with a polished Magic UI inspired landing page.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${GeistPixelGrid.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
