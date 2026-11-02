import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RailNavi — Find your way. Catch your train.",
  description: "Explore a fictional 12-platform station with real indoor pathfinding, accessible routes and clear turn-by-turn directions.",
  applicationName: "RailNavi",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#173e32" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
