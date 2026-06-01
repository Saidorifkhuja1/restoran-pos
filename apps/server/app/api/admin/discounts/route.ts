import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { unauthorized, badRequest, serverError, success } from "@/lib/responses";
import { getPagination, getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

const createDiscountSchema = z.object({
  name: z.string().min(2, "Chegirma nomi kamida 2 ta harf bo'lishi kerak"),
  type: z.enum(["PERCENT", "FIXED"], { errorMap: () => ({ message: "Noto'g'ri chegirma turi" }) }),
  value: z.number().min(1, "Qiymat 1 dan katta bo'lishi kerak"),
}).refine((data) => data.type !== "PERCENT" || data.value <= 100, {
  message: "Foiz 1 dan 100 gacha bo'lishi kerak",
  path: ["value"],
});

const readRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;
const writeRoles = [UserRole.ADMIN] as const;

/**
 * GET /api/admin/discounts
 * List all discounts (ADMIN, MANAGER, CASHIER)
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, readRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    const { page, limit, skip } = getPagination(request);

    const [discounts, total] = await Promise.all([
      prisma.discount.findMany({
        where: {
          restaurantId: token.restaurantId,
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: { payments: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.discount.count({
        where: { restaurantId: token.restaurantId },
      }),
    ]);

    return success({
      items: discounts,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[Get Discounts Error]", error);
    return serverError("Chegirmalarni olishda xato");
  }
}

/**
 * POST /api/admin/discounts
 * Create new discount (ADMIN only)
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = createDiscountSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));
    const data = parsed.data;

    // Check if discount with same name exists
    const existing = await prisma.discount.findFirst({
      where: {
        restaurantId: token.restaurantId,
        name: data.name,
      },
    });

    if (existing) {
      return badRequest("Bu nom bilan chegirma allaqachon mavjud");
    }

    const discount = await prisma.discount.create({
      data: {
        restaurantId: token.restaurantId,
        name: data.name,
        type: data.type,
        value: data.value,
      },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "discount:updated", {
      action: "created",
      discount,
    });

    return success(discount, 201);
  } catch (error) {
    console.error("[Create Discount Error]", error);
    return serverError("Chegirma yaratishda xato");
  }
}
