import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { Sprite } from "@/components/Sprite";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Toasts } from "@/components/Toasts";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "600"], variable: "--nf-display" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--nf-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--nf-mono" });

export const metadata: Metadata = {
  title: { default: "Student Pass — Your student status gets you more", template: "%s · Student Pass" },
  description: "Student Pass — Sri Lanka's student platform for benefits and a secure digital pass.",
  appleWebApp: { capable: true, title: "Student Pass", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#FFFFFF", viewportFit: "cover" };

// Applies the saved theme before first paint (avoids a light→dark flash).
const THEME_SCRIPT = `try{var t=localStorage.getItem("sp-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" className={`${display.variable} ${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Sprite />
        <div className="backdrop" aria-hidden="true"><div className="glow" /></div>
        <a href="#main" className="sr">Skip to content</a>
        {/* Nav reads the URL (usePathname); dynamic routes need that behind Suspense. */}
        <Suspense fallback={null}><Nav /></Suspense>
        <main id="main">{children}</main>
        <Footer />
        <Toasts />
      </body>
    </html>
  );
}
