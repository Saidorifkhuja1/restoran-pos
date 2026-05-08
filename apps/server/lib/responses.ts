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
  const session = await nextAuthSession().catch(() => null);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24;
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

  const token = extractToken(
    request.headers.get("authorization") || "",
    request.cookies.get("restopos-token")?.value
  );

  if (!token) {
    return {
      token: null,
      isAuthenticated: false,
      isSuperAdmin: false,
      isRestaurantUser: false,
    };
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return {
      token: null,
      isAuthenticated: false,
      isSuperAdmin: false,
      isRestaurantUser: false,
    };
  }

  const isSuperAdmin = payload.role === "SUPERADMIN";
  const isRestaurantUser = payload.role !== "SUPERADMIN";

  return {
    token: payload,
    isAuthenticated: true,
    isSuperAdmin,
    isRestaurantUser,
  };
}

export function unauthorized(message: string = "Unauthorized") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

export function forbidden(message: string = "Forbidden") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

export function badRequest(message: string = "Bad Request") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 400 }
  );
}

export function notFound(message: string = "Not Found") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 404 }
  );
}

export function serverError(message: string = "Internal Server Error") {
  console.error("[API Error]", message);
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  );
}

export function success<T>(data: T, status: number = 200) {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}
