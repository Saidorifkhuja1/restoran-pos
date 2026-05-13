import { NextRequest } from "next/server";
import { getCachedJson, setCachedJson } from "@/lib/redis";
import { buildReportSummary, parseReportDate, utcWeekStart } from "@/lib/report-summary";
import { badRequest, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const now = new Date();
    const requestedWeek = parseReportDate(new URL(request.url).searchParams.get("date"), now);
    if (Number.isNaN(requestedWeek.getTime())) return badRequest("Sana noto'g'ri");

    const from = utcWeekStart(requestedWeek);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 7);
    to.setUTCMilliseconds(to.getUTCMilliseconds() - 1);

    const cacheKey = `reports:weekly:${token.restaurantId}:${from.toISOString()}:${token.role}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) return success(cached);

    const report = await buildReportSummary(token.restaurantId, from, to);
    await setCachedJson(cacheKey, report, 60);
    return success(report);
  } catch (error) {
    console.error("[Weekly Report Error]", error);
    return serverError("Haftalik hisobotni olishda xato");
  }
}
