import { NextRequest, NextResponse } from "next/server";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-RestoPOS-CSRF",
    "X-Content-Type-Options": "nosniff",
  };
}

async function redisRateLimit(key: string, limit: number): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redisKey = `rate:${key}`;
  const increment = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!increment.ok) return null;
  const payload = (await increment.json()) as { result?: number };
  if (payload.result === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/60`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  }
  return (payload.result || 0) <= limit;
}

function memoryRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export async function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${ip}:${request.nextUrl.pathname}`;
  const limit = Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE || "120", 10);
  const redisAllowed = await redisRateLimit(key, limit);
  if (process.env.NODE_ENV === "production" && process.env.RATE_LIMIT_PROD_REDIS_ONLY === "true" && redisAllowed === null) {
    return NextResponse.json(
      { success: false, error: "Rate limit Redis is required in production" },
      { status: 503, headers: corsHeaders(request) }
    );
  }
  const allowed = redisAllowed ?? memoryRateLimit(key, limit);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Too Many Requests" },
      { status: 429, headers: corsHeaders(request) }
    );
  }

  const response = NextResponse.next();
  Object.entries(corsHeaders(request)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
