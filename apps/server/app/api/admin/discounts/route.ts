import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError, success } from "@/lib/responses";
import { UserToken, DiscountType } from "@restopos/types";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

const createDiscountSchema = z.object({
  name: z.string().min(2, "Chegirma nomi kamida 2 ta harf bo'lishi kerak"),
  type: z.enum(["PERCENT", "FIXED"], { errorMap: () => ({ message: "Noto'g'ri chegirma turi" }) }),
  value: z.number().min(1, "Qiymat 1 dan katta bo'lishi kerak"),
});

type CreateDiscountRequest = z.infer<typeof createDiscountSchema>;

/**
 * GET /api/admin/discounts
 * List all discounts (ADMIN, MANAGER, CASHIER)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (!["ADMIN", "MANAGER", "CASHIER"].includes(token.role)) {
      return forbidden("Ruxsat kerak");
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

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
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (token.role !== "ADMIN") {
      return forbidden("Admin ruxsat kerak");
    }

    const body = await request.json();
    const parseResult = createDiscountSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest(
        parseResult.error.errors[0]?.message || "Validation error"
      );
    }

    const data = parseResult.data as CreateDiscountRequest;

    // Validate value
    if (data.type === "PERCENT" && (data.value < 1 || data.value > 100)) {
      return badRequest("Foiz 1 dan 100 gacha bo'lishi kerak");
    }

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
        type: data.type as DiscountType,
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
