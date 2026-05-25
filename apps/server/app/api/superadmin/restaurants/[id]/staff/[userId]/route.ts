import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { badRequest, getAuthContext, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

type RouteParams = {
  params: Promise<{
    id: string;
    userId: string;
  }>;
};

const updateStaffSchema = z.object({
  name: z.string().min(2, "Ism kamida 2 ta harf bo'lishi kerak").max(120).optional(),
  phone: z.string().max(40).optional(),
  role: z.enum(["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"]).optional(),
  newPin: z.string().min(4, "Parol kamida 4 ta belgi bo'lishi kerak").optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const user = await prisma.user.findFirst({
      where: { id: params.userId, restaurantId: params.id },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        restaurantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return notFound("Xodim topilmadi");
    return success(user);
  } catch (error) {
    console.error("[SuperAdmin Get Staff Error]", error);
    return serverError("Xodim ma'lumotini olishda xato");
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const existingUser = await prisma.user.findFirst({
      where: { id: params.userId, restaurantId: params.id },
      select: { id: true, restaurantId: true },
    });
    if (!existingUser) return notFound("Xodim topilmadi");

    const parsed = updateStaffSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const data = parsed.data;
    const updateData: {
      name?: string;
      phone?: string;
      role?: typeof data.role;
      isActive?: boolean;
      pin?: string;
    } = {};

    if (data.name) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.newPin) {
      const users = await prisma.user.findMany({
        where: { restaurantId: params.id, id: { not: params.userId } },
        select: { id: true, pin: true },
      });
      const pinExists = (
        await Promise.all(
          users.map(async (user) => ({
            user,
            matches: await bcrypt.compare(data.newPin as string, user.pin),
          }))
        )
      ).find(({ matches }) => matches)?.user;

      if (pinExists) return badRequest("Bu parol allaqachon ishlatilgan");
      updateData.pin = await bcrypt.hash(data.newPin, 10);
    }

    const user = await prisma.user.update({
      where: { id: params.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await publishEvent(restaurantChannel(params.id), "staff:updated", {
      action: "updated",
      user,
    });

    return success(user);
  } catch (error) {
    console.error("[SuperAdmin Update Staff Error]", error);
    return serverError("Xodim yangilashda xato");
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const existingUser = await prisma.user.findFirst({
      where: { id: params.userId, restaurantId: params.id },
      select: { id: true },
    });
    if (!existingUser) return notFound("Xodim topilmadi");

    const user = await prisma.user.update({
      where: { id: params.userId },
      data: { isActive: false },
      select: { id: true, name: true, role: true, isActive: true },
    });

    await publishEvent(restaurantChannel(params.id), "staff:updated", {
      action: "deleted",
      user,
    });

    return success({ message: "Xodim deaktivatsiya qilindi", user });
  } catch (error) {
    console.error("[SuperAdmin Delete Staff Error]", error);
    return serverError("Xodim o'chirishda xato");
  }
}
