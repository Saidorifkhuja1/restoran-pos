import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

const ALLOWED_NEXT_PATHS = new Set(["/login", "/superadmin/login"]);

export async function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get("next") ?? "/login";
  const safeNextPath = ALLOWED_NEXT_PATHS.has(nextPath) ? nextPath : "/login";
  const protocol =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const response = NextResponse.redirect(new URL(safeNextPath, `${protocol}://${host}`));

  return clearAuthCookie(response);
}
