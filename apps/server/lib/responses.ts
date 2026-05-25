import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken } from "@/lib/auth";
import { auth as nextAuthSession } from "@/lib/nextauth";
import { UserToken, SuperAdminToken } from "@restopos/types";

export type AuthContext = {
  token: UserToken | SuperAdminToken | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isRestaurantUser: boolean;
};

export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  // 1. Try cookie-based JWT first (primary, always reliable)
  const rawToken = extractToken(
    request.headers.get("authorization"),
    request.cookies.get("restopos-token")?.value
  );

  if (rawToken) {
    const payload = await verifyToken(rawToken);
    if (payload) {
      return {
        token: payload,
        isAuthenticated: true,
        isSuperAdmin: payload.role === "SUPERADMIN",
        isRestaurantUser: payload.role !== "SUPERADMIN",
      };
    }
  }

  // 2. Fall back to NextAuth session (secondary, may not be set)
  const session = await nextAuthSession().catch(() => null);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 86_400;

  if (session?.user?.role === "SUPERADMIN" && session.user.id) {
    return {
      token: { role: "SUPERADMIN", superAdminId: session.user.id, iat: now, exp },
      isAuthenticated: true,
      isSuperAdmin: true,
      isRestaurantUser: false,
    };
  }

  if (session?.user?.role && session.user.id && session.user.restaurantId) {
    return {
      token: {
        role: session.user.role as UserToken["role"],
        userId: session.user.id,
        restaurantId: session.user.restaurantId,
        iat: now,
        exp,
      },
      isAuthenticated: true,
      isSuperAdmin: false,
      isRestaurantUser: true,
    };
  }

  return { token: null, isAuthenticated: false, isSuperAdmin: false, isRestaurantUser: false };
}

// --- Response helpers ---

type ErrorBody = { success: false; error: string };
type SuccessBody<T> = { success: true; data: T };

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json<ErrorBody>({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json<ErrorBody>({ success: false, error: message }, { status: 403 });
}

export function badRequest(message = "Bad Request") {
  return NextResponse.json<ErrorBody>({ success: false, error: message }, { status: 400 });
}

export function notFound(message = "Not Found") {
  return NextResponse.json<ErrorBody>({ success: false, error: message }, { status: 404 });
}

export function serverError(message = "Internal Server Error") {
  console.error("[API Error]", message);
  return NextResponse.json<ErrorBody>({ success: false, error: message }, { status: 500 });
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json<SuccessBody<T>>({ success: true, data }, { status });
}
