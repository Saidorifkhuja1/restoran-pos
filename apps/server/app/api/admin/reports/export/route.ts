import { NextRequest, NextResponse } from "next/server";
import { generateReportExport, ReportFormat } from "@/lib/report-export";
import { badRequest, forbidden, serverError, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

function filename(format: string): string {
  return `restopos-report-${Date.now()}.${format}`;
}

function blobFromBinary(value: ArrayBuffer | Buffer): Blob {
  if (value instanceof ArrayBuffer) {
    return new Blob([value]);
  }
  return new Blob([new Uint8Array(value)]);
}

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.role === UserRole.CASHIER) return forbidden("Eksport uchun ruxsat yo'q");

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    if (!["csv", "xlsx", "pdf"].includes(format)) return badRequest("Format noto'g'ri");
    const from = searchParams.get("from") ? new Date(searchParams.get("from") as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = searchParams.get("to") ? new Date(searchParams.get("to") as string) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return badRequest("Sana oralig'i noto'g'ri");
    }

    const report = await generateReportExport(token.restaurantId, from, to, format as ReportFormat);

    return new NextResponse(blobFromBinary(report.buffer), {
      headers: {
        "content-type": report.mimeType,
        "content-disposition": `attachment; filename="${filename(report.extension)}"`,
      },
    });
  } catch (error) {
    console.error("[Report Export Error]", error);
    return serverError("Hisobot eksportida xato");
  }
}
