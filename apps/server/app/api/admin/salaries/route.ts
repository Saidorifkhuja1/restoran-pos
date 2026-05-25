import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

const salarySchema = z.object({
  userId: z.string().min(1, "Xodim tanlang"),
  amount: z.number().int().positive("Summa musbat bo'lishi kerak"),
  note: z.string().max(300).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const { page, limit, skip } = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.salary.findMany({
        where: { restaurantId: token.restaurantId },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          amount: true,
          note: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.salary.count({ where: { restaurantId: token.restaurantId } }),
    ]);

    return success({
      items: items.map((s) => ({ ...s, userName: s.user.name })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[Get Salaries Error]", error);
    return serverError("Maosh ro'yxatini olishda xato");
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.role !== UserRole.ADMIN) return forbidden("Maosh berish uchun admin ruxsat kerak");

    const parsed = salarySchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const user = await prisma.user.findFirst({
      where: { id: parsed.data.userId, restaurantId: token.restaurantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!user) return badRequest("Xodim topilmadi");

    const salary = await prisma.salary.create({
      data: {
        restaurantId: token.restaurantId,
        userId: parsed.data.userId,
        amount: parsed.data.amount,
        note: parsed.data.note,
      },
      select: { id: true, userId: true, amount: true, note: true, createdAt: true },
    });

    return success({ ...salary, userName: user.name }, 201);
  } catch (error) {
    console.error("[Create Salary Error]", error);
    return serverError("Maosh yaratishda xato");
  }
}
