import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError, success } from "@/lib/responses";
import { UserToken } from "@restopos/types";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

const createZoneSchema = z.object({
  name: z.string().trim().min(2, "Zon nomi kamida 2 ta harf bo'lishi kerak"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Noto'g'ri rang"),
});

type CreateZoneRequest = z.infer<typeof createZoneSchema>;

/**
 * GET /api/admin/zones
 * List all zones (ADMIN & MANAGER)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (!["ADMIN", "MANAGER", "WAITER", "CASHIER"].includes(token.role)) {
      return forbidden("Ruxsat kerak");
    }

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
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (!["ADMIN", "MANAGER"].includes(token.role)) {
      return forbidden("Ruxsat kerak");
    }

    const body = await request.json();
    const parseResult = createZoneSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest(
        parseResult.error.errors[0]?.message || "Validation error"
      );
    }

    const data = parseResult.data as CreateZoneRequest;

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
