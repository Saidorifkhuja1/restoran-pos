import { jwtVerify, SignJWT } from "jose";
import { JWTPayload } from "@restopos/types";
import { NextResponse } from "next/server";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build"
    ) {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    console.warn("[AUTH] JWT_SECRET not set — using insecure default");
    return new TextEncoder().encode("dev-only-insecure-jwt-secret-do-not-use-in-prod");
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRATION = process.env.JWT_EXPIRATION ?? "24h";

const COOKIE_NAME = "restopos-token" as const;

export async function signSuperAdminToken(superAdminId: string): Promise<string> {
  return new SignJWT({ role: "SUPERADMIN", superAdminId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRATION)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function signUserToken(
  userId: string,
  restaurantId: string,
  role: string
): Promise<string> {
  return new SignJWT({ role, userId, restaurantId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRATION)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

export function extractToken(
  authHeader?: string | null,
  cookieToken?: string
): string | null {
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return cookieToken ?? null;
}

export function setAuthCookie<T>(
  response: NextResponse<T>,
  token: string
): NextResponse<T> {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}

export function clearAuthCookie<T>(response: NextResponse<T>): NextResponse<T> {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
