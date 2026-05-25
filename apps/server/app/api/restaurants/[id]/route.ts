import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  currency: z.string().max(10).optional(),
  receiptFooter: z.string().max(500).nullable().optional(),
});

const writeRoles = [UserRole.ADMIN] as const;

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Ruxsat yo'q");

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const restaurant = await prisma.restaurant.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, name: true, phone: true, address: true, taxPercent: true, currency: true },
    });

    return success(restaurant);
  } catch (error) {
    console.error("[Update Restaurant Error]", error);
    return serverError("Restoranni yangilashda xato");
  }
}
