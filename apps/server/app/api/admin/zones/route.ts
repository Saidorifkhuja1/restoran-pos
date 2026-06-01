import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { unauthorized, badRequest, serverError, success } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

const createZoneSchema = z.object({
  name: z.string().trim().min(2, "Zon nomi kamida 2 ta harf bo'lishi kerak"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Noto'g'ri rang"),
});

const readRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER] as const;
const writeRoles = [UserRole.ADMIN, UserRole.MANAGER] as const;

/**
 * GET /api/admin/zones
 * List all zones (ADMIN & MANAGER)
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, readRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const zones = await prisma.zone.findMany({
      where: { restaurantId: token.restaurantId, isActive: true },
      include: {
        _count: {
          select: { tables: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return success(zones);
  } catch (error) {
    console.error("[Get Zones Error]", error);
    return serverError("Zonalarni olishda xato");
  }
}

/**
 * POST /api/admin/zones
 * Create new zone (ADMIN & MANAGER)
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = createZoneSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));
    const data = parsed.data;

    // Check if zone with same name exists
    const existing = await prisma.zone.findFirst({
      where: {
        restaurantId: token.restaurantId,
        name: { equals: data.name, mode: "insensitive" },
      },
      include: {
        _count: {
          select: { tables: true },
        },
      },
    });

    if (existing?.isActive) {
      return badRequest("Bu nom bilan zon allaqachon mavjud");
    }

    // Get max sortOrder
    const lastZone = await prisma.zone.findFirst({
      where: { restaurantId: token.restaurantId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const sortOrder = (lastZone?.sortOrder || 0) + 1;

    if (existing) {
      const zone = await prisma.zone.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          color: data.color,
          sortOrder,
          isActive: true,
        },
        include: {
          _count: {
            select: { tables: true },
          },
        },
      });

      await publishEvent(restaurantChannel(token.restaurantId), "zone:updated", {
        action: "created",
        zone,
      });

      return success(zone, 201);
    }

    const zone = await prisma.zone.create({
      data: {
        restaurantId: token.restaurantId,
        name: data.name,
        color: data.color,
        sortOrder,
      },
      include: {
        _count: {
          select: { tables: true },
        },
      },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "zone:updated", {
      action: "created",
      zone,
    });

    return success(zone, 201);
  } catch (error) {
    console.error("[Create Zone Error]", error);
    return serverError("Zon yaratishda xato");
  }
}
