import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
    `self.addEventListener("install",event=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{});`,
    { headers: { "content-type": "application/javascript; charset=utf-8" } }
  );
}
