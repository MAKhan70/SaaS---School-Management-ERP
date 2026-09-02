import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NASAQ Academic Systems", template: "%s · NASAQ" },
  description: "Intelligent Systems for Smarter Campuses",
};

export const viewport: Viewport = { colorScheme: "light dark" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
        >{`try{const t=localStorage.getItem('nasaq-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch{}`}</Script>
        {children}
      </body>
    </html>
  );
}
