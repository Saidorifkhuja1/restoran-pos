import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

const supplierSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(40).optional().nullable(),
  contactPerson: z.string().max(80).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  balance: z.number().int().default(0),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.role !== UserRole.ADMIN) return forbidden("Ta'minotchini yangilash uchun admin ruxsat kerak");

    const parsed = supplierSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const { id } = await context.params;
    const existing = await prisma.supplier.findFirst({
      where: { id, restaurantId: token.restaurantId, isActive: true },
      select: { id: true },
    });
    if (!existing) return notFound("Ta'minotchi topilmadi");

    const supplier = await prisma.supplier.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        phone: true,
        contactPerson: true,
        category: true,
        note: true,
        balance: true,
        isActive: true,
        createdAt: true,
      },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "UPDATE",
      entity: "Supplier",
      entityId: supplier.id,
      metadata: { name: supplier.name },
    });
    await publishEvent(restaurantChannel(token.restaurantId), "supplier:updated", { action: "updated", supplier });

    return success(supplier);
  } catch (error) {
    console.error("[Update Supplier Error]", error);
    return serverError("Ta'minotchini yangilashda xato");
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.role !== UserRole.ADMIN) return forbidden("Ta'minotchini o'chirish uchun admin ruxsat kerak");

    const { id } = await context.params;
    const existing = await prisma.supplier.findFirst({
      where: { id, restaurantId: token.restaurantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!existing) return notFound("Ta'minotchi topilmadi");

    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "DELETE",
      entity: "Supplier",
      entityId: id,
      metadata: { name: existing.name },
    });
    await publishEvent(restaurantChannel(token.restaurantId), "supplier:updated", { action: "deleted", id });

    return success({ id });
  } catch (error) {
    console.error("[Delete Supplier Error]", error);
    return serverError("Ta'minotchini o'chirishda xato");
  }
}
