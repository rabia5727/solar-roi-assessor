import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solar ROI Assessor — NASA-powered solar feasibility for Pakistan",
  description:
    "Enter a location in Pakistan and get system size, panel layout, savings under NEPRA 2026 net billing, payback and a professional report — powered by NASA satellite data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
