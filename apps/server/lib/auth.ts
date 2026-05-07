import { jwtVerify, SignJWT } from "jose";
import { JWTPayload } from "@restopos/types";
import { NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "24h";

export async function signSuperAdminToken(superAdminId: string): Promise<string> {
  const token = await new SignJWT({
    role: "SUPERADMIN",
    superAdminId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRATION)
    .setIssuedAt()
    .sign(JWT_SECRET);

  return token;
}

export async function signUserToken(
  userId: string,
  restaurantId: string,
  role: string
): Promise<string> {
  const token = await new SignJWT({
    role,
    userId,
    restaurantId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRATION)
    .setIssuedAt()
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as JWTPayload;
  } catch {
    return null;
  }
}

export function extractToken(authHeader?: string, cookieToken?: string): string | null {
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return cookieToken || null;
}

export function setAuthCookie<T>(
  response: NextResponse<T>,
  token: string
): NextResponse<T> {
  response.cookies.set("restopos-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}

export function clearAuthCookie<T>(response: NextResponse<T>): NextResponse<T> {
  response.cookies.set("restopos-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
