import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

const supplierSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(40).optional(),
  contactPerson: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
  balance: z.number().int().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    const { page, limit, skip } = getPagination(request);

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where: { restaurantId: token.restaurantId, isActive: true },
        skip,
        take: limit,
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
        orderBy: { createdAt: "desc" },
      }),
      prisma.supplier.count({ where: { restaurantId: token.restaurantId, isActive: true } }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Get Suppliers Error]", error);
    return serverError("Ta'minotchilarni olishda xato");
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.role !== UserRole.ADMIN) return forbidden("Ta'minotchi qo'shish uchun admin ruxsat kerak");

    const parsed = supplierSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const supplier = await prisma.supplier.create({
      data: { ...parsed.data, restaurantId: token.restaurantId },
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
      action: "CREATE",
      entity: "Supplier",
      entityId: supplier.id,
      metadata: { name: supplier.name },
    });
    await publishEvent(restaurantChannel(token.restaurantId), "supplier:updated", { action: "created", supplier });

    return success(supplier, 201);
  } catch (error) {
    console.error("[Create Supplier Error]", error);
    return serverError("Ta'minotchi yaratishda xato");
  }
}
