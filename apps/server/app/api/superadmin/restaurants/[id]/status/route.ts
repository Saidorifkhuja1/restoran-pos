import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getAuthContext } from "@/lib/responses";
import { zodMessage } from "@/lib/route-helpers";

type RouteParams = { params: Promise<{ id: string }> };

const statusSchema = z.object({ isActive: z.boolean() });

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const existing = await prisma.restaurant.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) return notFound("Restoran topilmadi");

    const restaurant = await prisma.restaurant.update({
      where: { id: params.id },
      data: { isActive: parsed.data.isActive },
      select: { id: true, name: true, isActive: true },
    });

    return success(restaurant);
  } catch (error) {
    console.error("[Restaurant Status Error]", error);
    return serverError("Restoran statusini yangilashda xato");
  }
}
