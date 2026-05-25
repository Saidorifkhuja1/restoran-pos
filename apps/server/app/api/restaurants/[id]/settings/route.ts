import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

type RouteParams = { params: Promise<{ id: string }> };

const settingsSchema = z.object({
  kitchenAlertMinutes: z.number().int().positive().optional(),
  autoPrintReceipt: z.boolean().optional(),
  requireGuestCount: z.boolean().optional(),
  allowItemNotes: z.boolean().optional(),
  allowDiscount: z.boolean().optional(),
  showTax: z.boolean().optional(),
  showWaiterName: z.boolean().optional(),
  showTableNumber: z.boolean().optional(),
});

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, [UserRole.ADMIN, UserRole.MANAGER] as const);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const settings = await prisma.restaurantSettings.findUnique({
      where: { restaurantId: token.restaurantId },
      select: {
        restaurantId: true,
        kitchenAlertMinutes: true,
        autoPrintReceipt: true,
        requireGuestCount: true,
        allowItemNotes: true,
        allowDiscount: true,
        showTax: true,
        showWaiterName: true,
        showTableNumber: true,
      },
    });

    if (!settings) return notFound("Sozlamalar topilmadi");
    return success(settings);
  } catch (error) {
    console.error("[Get Settings Error]", error);
    return serverError("Sozlamalarni olishda xato");
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, [UserRole.ADMIN] as const);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const settings = await prisma.restaurantSettings.upsert({
      where: { restaurantId: token.restaurantId },
      create: { restaurantId: token.restaurantId, ...parsed.data },
      update: parsed.data,
    });

    await publishEvent(restaurantChannel(token.restaurantId), "settings:updated", settings);

    return success(settings);
  } catch (error) {
    console.error("[Update Settings Error]", error);
    return serverError("Sozlamalarni yangilashda xato");
  }
}
