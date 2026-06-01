import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError, success, notFound } from "@/lib/responses";
import { UserToken } from "@restopos/types";
import { zodMessage } from "@/lib/route-helpers";
import { writeAuditLog } from "@/lib/audit";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

const updateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(["MANAGER", "WAITER", "KITCHEN", "CASHIER"]).optional(),
  newPassword: z.string().min(4, "Parol kamida 4 ta belgi bo'lishi kerak").optional(),
  isActive: z.boolean().optional(),
});

type UpdateStaffRequest = z.infer<typeof updateStaffSchema>;

/**
 * GET /api/admin/staff/[id]
 * Get staff details (ADMIN & MANAGER)
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

    const user = await prisma.user.findUnique({
      where: { id: params.id },
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

    if (!user) {
      return notFound("Xodim topilmadi");
    }

    // Check permission - can only view staff from own restaurant
    if (user.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran xodimini ko'ra olmaysiz");
    }

    return success(user);
  } catch (error) {
    console.error("[Get Staff Error]", error);
    return serverError("Xodim ma'lumotini olishda xato");
  }
}

/**
 * PUT /api/admin/staff/[id]
 * Update staff (ADMIN only)
 */
export async function PUT(request: NextRequest, context: RouteParams) {
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

    // Check if user exists and belongs to this restaurant
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { restaurantId: true, role: true },
    });

    if (!existingUser) {
      return notFound("Xodim topilmadi");
    }

    if (existingUser.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran xodimini tahrirlaya olmaysiz");
    }
    if (existingUser.role === "ADMIN") {
      return forbidden("Admin profilini faqat sozlamalar bo'limida o'zi tahrirlaydi");
    }

    const body = await request.json();
    const parseResult = updateStaffSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest(zodMessage(parseResult.error));
    }

    const data = parseResult.data as UpdateStaffRequest;
    const updateData: {
      name?: string;
      phone?: string;
      role?: UpdateStaffRequest["role"];
      isActive?: boolean;
      pin?: string;
    } = {};

    if (data.name) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.newPassword) {
      const users = await prisma.user.findMany({
        where: {
          restaurantId: token.restaurantId,
          id: { not: params.id },
        },
        select: { id: true, pin: true },
      });

      const pinExists = (
        await Promise.all(
          users.map(async (candidate) => ({
            candidate,
            matches: await bcrypt.compare(data.newPassword as string, candidate.pin),
          }))
        )
      ).find(({ matches }) => matches)?.candidate;

      if (pinExists) return badRequest("Bu parol allaqachon ishlatilgan");

      updateData.pin = await bcrypt.hash(data.newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
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

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "UPDATE",
      entity: "User",
      entityId: updated.id,
      metadata: { name: updated.name, role: updated.role, isActive: updated.isActive },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "staff:updated", {
      action: "updated",
      user: updated,
    });

    return success(updated);
  } catch (error) {
    console.error("[Update Staff Error]", error);
    return serverError("Xodim yangilashda xato");
  }
}

/**
 * DELETE /api/admin/staff/[id]
 * Delete staff (ADMIN only - soft delete)
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

    // Check if user exists and belongs to this restaurant
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { restaurantId: true, role: true },
    });

    if (!existingUser) {
      return notFound("Xodim topilmadi");
    }

    if (existingUser.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran xodimini o'chira olmaysiz");
    }
    if (existingUser.role === "ADMIN") {
      return forbidden("Adminlarni restoran admin panelidan o'chirish mumkin emas");
    }

    // Soft delete
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "DELETE",
      entity: "User",
      entityId: updated.id,
      metadata: { name: updated.name },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "staff:updated", {
      action: "deleted",
      user: updated,
    });

    return success({
      message: "Xodim deaktivatsiya qilindi",
      user: updated,
    });
  } catch (error) {
    console.error("[Delete Staff Error]", error);
    return serverError("Xodim o'chirishda xato");
  }
}
