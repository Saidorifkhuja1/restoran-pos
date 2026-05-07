import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { badRequest, notFound, serverError, unauthorized } from "@/lib/responses";
import { readReportJob } from "@/lib/report-storage";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string }> };

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const job = await readReportJob(params.id);
    if (!job || job.restaurantId !== token.restaurantId) return notFound("Hisobot topilmadi");
    if (job.status !== "COMPLETED" || !job.filePath || !job.fileName || !job.mimeType) {
      return badRequest("Hisobot hali tayyor emas");
    }

    const buffer = await readFile(job.filePath);
    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      headers: {
        "content-type": job.mimeType,
        "content-disposition": `attachment; filename="${job.fileName}"`,
      },
    });
  } catch (error) {
    console.error("[Report Job Download Error]", error);
    return serverError("Hisobotni yuklashda xato");
  }
}
