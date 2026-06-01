import { NextRequest } from "next/server";
import { z } from "zod";
import { enqueueReport } from "@/lib/queue";
import { readReportJob, saveReportJob } from "@/lib/report-storage";
import { badRequest, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

const reportJobSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  format: z.enum(["csv", "xlsx", "pdf"]),
});

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = reportJobSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));
    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    if (from > to) return badRequest("Sana oralig'i noto'g'ri");

    const exportId = crypto.randomUUID();
    const stored = await saveReportJob({
      id: exportId,
      restaurantId: token.restaurantId,
      requestedBy: token.userId,
      from: parsed.data.from,
      to: parsed.data.to,
      format: parsed.data.format,
      status: "QUEUED",
      createdAt: new Date().toISOString(),
    });

    const job = await enqueueReport({
      exportId,
      restaurantId: token.restaurantId,
      requestedBy: token.userId,
      from: parsed.data.from,
      to: parsed.data.to,
      format: parsed.data.format,
    });

    return success({ ...stored, queueJobId: job.id, name: job.name }, 202);
  } catch (error) {
    console.error("[Report Queue Error]", error);
    return serverError("Hisobot navbatga qo'yishda xato");
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return badRequest("id majburiy");
    const job = await readReportJob(id);
    if (!job || job.restaurantId !== token.restaurantId) return badRequest("Job topilmadi");
    return success(job);
  } catch (error) {
    console.error("[Report Job Get Error]", error);
    return serverError("Hisobot jobini olishda xato");
  }
}
