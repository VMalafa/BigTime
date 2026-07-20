import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { AppHeader } from "@/components/shared/AppHeader";
import "./globals.css";

// Self-hosted via next/font (#109): the render-blocking Google Fonts
// stylesheet is gone — first paint no longer waits on an external CSS
// round trip, and the font files ship from our own origin with
// size-adjusted fallbacks (no layout shift).
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Your Rich Life — Financial Wellness",
  description:
    "From financial anxiety to a clear, automated plan — in under 10 minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${dmSans.variable} ${playfair.variable}`}
    >
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary font-sans">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
