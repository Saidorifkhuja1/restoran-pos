import { NextRequest, NextResponse } from "next/server";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-RestoPOS-CSRF",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

async function redisRateLimit(rateLimitKey: string, limit: number): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redisKey = `rate:${rateLimitKey}`;
  const response = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { result?: number };
  const count = payload.result ?? 0;

  if (count === 1) {
    // Set TTL only on first increment
    await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/60`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  }

  return count <= limit;
}

function memoryRateLimit(rateLimitKey: string, limit: number): boolean {
  const now = Date.now();
  const windowMs = 60_000;

  // Periodic cleanup
  if (rateLimitStore.size > 1000) {
    for (const [storedKey, entry] of rateLimitStore) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(storedKey);
      }
    }
  }

  const entry = rateLimitStore.get(rateLimitKey);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(rateLimitKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
}

export async function middleware(request: NextRequest) {
  // Preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
  }

  // CSRF protection for mutations
  const isMutation = !["GET", "HEAD"].includes(request.method);
  const isWebhook = request.nextUrl.pathname.startsWith("/api/webhooks/");
  if (isMutation && !isWebhook) {
    const origin = request.headers.get("origin");
    const csrfHeader = request.headers.get("x-restopos-csrf");

    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json(
        { success: false, error: "CSRF origin rejected" },
        { status: 403, headers: corsHeaders(request) }
      );
    }
    if (!csrfHeader && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "CSRF token required" },
        { status: 403, headers: corsHeaders(request) }
      );
    }
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rateLimitKey = `${ip}:${request.nextUrl.pathname}`;
  const limit = Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE || "120", 10);

  const redisAllowed = await redisRateLimit(rateLimitKey, limit);

  if (
    process.env.NODE_ENV === "production" &&
    process.env.RATE_LIMIT_PROD_REDIS_ONLY === "true" &&
    redisAllowed === null
  ) {
    return NextResponse.json(
      { success: false, error: "Rate limit service unavailable" },
      { status: 503, headers: corsHeaders(request) }
    );
  }

  const allowed = redisAllowed ?? memoryRateLimit(rateLimitKey, limit);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Too Many Requests" },
      { status: 429, headers: corsHeaders(request) }
    );
  }

  // Apply headers
  const response = NextResponse.next();
  const headers = corsHeaders(request);
  for (const [headerName, headerValue] of Object.entries(headers)) {
    response.headers.set(headerName, headerValue);
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
