import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "RestoPOS",
    short_name: "RestoPOS",
    display: "standalone",
    orientation: "landscape",
    start_url: "/",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
  });
}
