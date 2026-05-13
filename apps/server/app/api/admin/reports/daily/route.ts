import { NextRequest } from "next/server";
import { getCachedJson, setCachedJson } from "@/lib/redis";
import { buildReportSummary, parseReportDate, utcDayStart } from "@/lib/report-summary";
import { badRequest, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const now = new Date();
    const requestedDay = parseReportDate(new URL(request.url).searchParams.get("date"), now);
    if (Number.isNaN(requestedDay.getTime())) return badRequest("Sana noto'g'ri");

    const from = utcDayStart(requestedDay);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    to.setUTCMilliseconds(to.getUTCMilliseconds() - 1);

    const cacheKey = `reports:daily:${token.restaurantId}:${from.toISOString()}:${token.role}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) return success(cached);

    const report = await buildReportSummary(token.restaurantId, from, to);
    await setCachedJson(cacheKey, report, 60);
    return success(report);
  } catch (error) {
    console.error("[Daily Report Error]", error);
    return serverError("Kunlik hisobotni olishda xato");
  }
}
