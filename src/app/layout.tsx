import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary font-sans">
        {children}
      </body>
    </html>
  );
}
