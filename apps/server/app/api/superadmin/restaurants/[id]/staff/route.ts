import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { badRequest, getAuthContext, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { SuperAdminToken } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string }> };

const createStaffSchema = z.object({
  name: z.string().min(2, "Ism kamida 2 ta harf bo'lishi kerak").max(120),
  phone: z.string().max(40).optional(),
  pin: z.string().min(4, "Parol kamida 4 ta belgi bo'lishi kerak"),
  role: z.enum(["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"]),
});

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const parsed = createStaffSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!restaurant) return notFound("Restoran topilmadi");

    const users = await prisma.user.findMany({
      where: { restaurantId: params.id },
      select: { id: true, pin: true },
    });
    const pinExists = (
      await Promise.all(
        users.map(async (user) => ({
          user,
          matches: await bcrypt.compare(parsed.data.pin, user.pin),
        }))
      )
    ).find(({ matches }) => matches)?.user;
    if (pinExists) return badRequest("Bu parol allaqachon ishlatilgan");

    const user = await prisma.user.create({
      data: {
        restaurantId: params.id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        pin: await bcrypt.hash(parsed.data.pin, 10),
        role: parsed.data.role,
        createdBy: (auth.token as SuperAdminToken).superAdminId,
      },
      select: { id: true, name: true, phone: true, role: true, isActive: true, createdAt: true },
    });

    await publishEvent(restaurantChannel(params.id), "staff:updated", {
      action: "created",
      user,
    });

    return success(user, 201);
  } catch (error) {
    console.error("[SuperAdmin Create Staff Error]", error);
    return serverError("Xodim yaratishda xato");
  }
}
