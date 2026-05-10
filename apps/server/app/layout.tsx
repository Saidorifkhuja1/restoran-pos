import "@/client/index.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "RestoPOS",
  description: "Professional multi-restaurant POS system",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
