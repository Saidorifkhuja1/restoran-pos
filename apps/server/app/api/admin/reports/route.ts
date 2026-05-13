import { NextRequest } from "next/server";
import { getCachedJson, setCachedJson } from "@/lib/redis";
import { buildReportSummary, parseReportDate, utcDayStart } from "@/lib/report-summary";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.role === UserRole.CASHIER && new URL(request.url).searchParams.get("scope") === "staff") {
      return forbidden("Xodim hisobotlari uchun ruxsat yo'q");
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = parseReportDate(searchParams.get("from"), utcDayStart(now));
    const to = parseReportDate(searchParams.get("to"), now);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return badRequest("Sana oralig'i noto'g'ri");
    }

    const cacheKey = `reports:${token.restaurantId}:${from.toISOString()}:${to.toISOString()}:${token.role}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) return success(cached);

    const report = await buildReportSummary(token.restaurantId, from, to);
    await setCachedJson(cacheKey, report, 60);
    return success(report);
  } catch (error) {
    console.error("[Reports Error]", error);
    return serverError("Hisobotni olishda xato");
  }
}
