import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-devanagari/devanagari-400.css";
import "@fontsource/noto-sans-devanagari/devanagari-600.css";
import "./globals.css";
import {LanguageProvider} from "@/components/language-provider";
import {PwaProvider} from "@/components/pwa-provider";

export const metadata: Metadata = {
  title: "RailNavi — Find your way. Catch your train.",
  description: "Indoor station navigation with QR checkpoints, offline maps, accessible routes and English/Hindi guidance. Fictional demonstration data.",
  applicationName: "RailNavi",
  appleWebApp: {capable:true,title:"RailNavi",statusBarStyle:"default"},
  icons: {apple:"/icon-180.png"},
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1b32", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LanguageProvider><PwaProvider>{children}</PwaProvider></LanguageProvider></body></html>;
}
