import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { deleteCacheByPattern } from "@/lib/redis";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

const expenseSchema = z.object({
  name: z.string().min(2).max(120),
  amount: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    const { page, limit, skip } = getPagination(request);

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where: { restaurantId: token.restaurantId, isActive: true },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          amount: true,
          note: true,
          createdAt: true,
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.expense.count({ where: { restaurantId: token.restaurantId, isActive: true } }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Get Expenses Error]", error);
    return serverError("Xarajatlarni olishda xato");
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.role === UserRole.MANAGER) return forbidden("Xarajat qo'shish uchun admin ruxsat kerak");

    const parsed = expenseSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const expense = await prisma.expense.create({
      data: {
        restaurantId: token.restaurantId,
        userId: token.userId,
        name: parsed.data.name,
        amount: parsed.data.amount,
        note: parsed.data.note,
      },
      select: { id: true, name: true, amount: true, note: true, createdAt: true },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "CREATE",
      entity: "Expense",
      entityId: expense.id,
      metadata: { name: expense.name, amount: expense.amount },
    });
    await deleteCacheByPattern(`reports:${token.restaurantId}:*`);

    return success(expense, 201);
  } catch (error) {
    console.error("[Create Expense Error]", error);
    return serverError("Xarajat yaratishda xato");
  }
}
