import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError, success, notFound } from "@/lib/responses";
import { UserToken } from "@restopos/types";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

const updateZoneSchema = z.object({
  name: z.string().trim().min(2).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Noto'g'ri rang").optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

type UpdateZoneRequest = z.infer<typeof updateZoneSchema>;

/**
 * GET /api/admin/zones/[id]
 * Get zone details (ADMIN & MANAGER)
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (!["ADMIN", "MANAGER"].includes(token.role)) {
      return forbidden("Ruxsat kerak");
    }

    const zone = await prisma.zone.findUnique({
      where: { id: params.id },
      include: {
        tables: {
          select: {
            id: true,
            number: true,
            capacity: true,
            status: true,
          },
        },
        _count: {
          select: { tables: true },
        },
      },
    });

    if (!zone) {
      return notFound("Zon topilmadi");
    }

    // Check permission
    if (zone.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran zonasini ko'ra olmaysiz");
    }

    return success(zone);
  } catch (error) {
    console.error("[Get Zone Error]", error);
    return serverError("Zon ma'lumotini olishda xato");
  }
}

/**
 * PUT /api/admin/zones/[id]
 * Update zone (ADMIN & MANAGER)
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (!["ADMIN", "MANAGER"].includes(token.role)) {
      return forbidden("Ruxsat kerak");
    }

    // Check if zone exists and belongs to this restaurant
    const existingZone = await prisma.zone.findUnique({
      where: { id: params.id },
      select: { restaurantId: true },
    });

    if (!existingZone) {
      return notFound("Zon topilmadi");
    }

    if (existingZone.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran zonasini tahrirlaya olmaysiz");
    }

    const body = await request.json();
    const parseResult = updateZoneSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest(
        parseResult.error.errors[0]?.message || "Validation error"
      );
    }

    const data = parseResult.data as UpdateZoneRequest;

    // If name is changing, check uniqueness
    if (data.name) {
      const existing = await prisma.zone.findFirst({
        where: {
          restaurantId: token.restaurantId,
          name: { equals: data.name, mode: "insensitive" },
          id: { not: params.id },
          isActive: true,
        },
      });

      if (existing) {
        return badRequest("Bu nom bilan zon allaqachon mavjud");
      }
    }

    const updated = await prisma.zone.update({
      where: { id: params.id },
      data,
      include: {
        _count: {
          select: { tables: true },
        },
      },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "zone:updated", {
      action: "updated",
      zone: updated,
    });

    return success(updated);
  } catch (error) {
    console.error("[Update Zone Error]", error);
    return serverError("Zon yangilashda xato");
  }
}

/**
 * DELETE /api/admin/zones/[id]
 * Delete zone (ADMIN only - soft delete)
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (token.role !== "ADMIN") {
      return forbidden("Admin ruxsat kerak");
    }

    // Check if zone exists and belongs to this restaurant
    const existingZone = await prisma.zone.findUnique({
      where: { id: params.id },
      select: { restaurantId: true },
    });

    if (!existingZone) {
      return notFound("Zon topilmadi");
    }

    if (existingZone.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran zonasini o'chira olmaysiz");
    }

    // Check if zone has tables
    const tableCount = await prisma.table.count({
      where: { zoneId: params.id },
    });

    if (tableCount > 0) {
      return badRequest(
        `Bu zon ${tableCount} ta stolni o'z ichiga oladi. Avval stollarni o'chiring.`
      );
    }

    // Soft delete
    const updated = await prisma.zone.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "zone:updated", {
      action: "deleted",
      zone: updated,
    });

    return success({
      message: "Zon deaktivatsiya qilindi",
      zone: updated,
    });
  } catch (error) {
    console.error("[Delete Zone Error]", error);
    return serverError("Zon o'chirishda xato");
  }
}
