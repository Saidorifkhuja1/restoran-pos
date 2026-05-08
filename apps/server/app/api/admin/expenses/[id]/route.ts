import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { deleteCacheByPattern } from "@/lib/redis";
import { badRequest, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  amount: z.number().int().positive().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, [UserRole.ADMIN] as const);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const existing = await prisma.expense.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId, isActive: true },
      select: { id: true },
    });
    if (!existing) return notFound("Xarajat topilmadi");

    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, name: true, amount: true, note: true, createdAt: true },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "UPDATE",
      entity: "Expense",
      entityId: expense.id,
      metadata: parsed.data,
    });
    await deleteCacheByPattern(`reports:${token.restaurantId}:*`);

    return success(expense);
  } catch (error) {
    console.error("[Update Expense Error]", error);
    return serverError("Xarajatni yangilashda xato");
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, [UserRole.ADMIN] as const);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const existing = await prisma.expense.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId, isActive: true },
      select: { id: true },
    });
    if (!existing) return notFound("Xarajat topilmadi");

    await prisma.expense.update({ where: { id: params.id }, data: { isActive: false } });
    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "DELETE",
      entity: "Expense",
      entityId: params.id,
    });
    await deleteCacheByPattern(`reports:${token.restaurantId}:*`);

    return success({ id: params.id });
  } catch (error) {
    console.error("[Delete Expense Error]", error);
    return serverError("Xarajatni o'chirishda xato");
  }
}
