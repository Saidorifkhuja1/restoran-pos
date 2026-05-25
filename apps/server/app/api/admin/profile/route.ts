import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthContext, badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { zodMessage } from "@/lib/route-helpers";
import { writeAuditLog } from "@/lib/audit";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserToken } from "@restopos/types";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Ism kamida 2 ta harf bo'lishi kerak").max(100).optional(),
  phone: z.string().max(32).nullable().optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string()
    .min(8, "Parol kamida 8 ta belgi bo'lishi kerak")
    .regex(/[A-Z]/, "Parolda katta harf bo'lishi kerak")
    .regex(/[a-z]/, "Parolda kichik harf bo'lishi kerak")
    .regex(/\d/, "Parolda raqam bo'lishi kerak")
    .regex(/[^A-Za-z0-9]/, "Parolda maxsus belgi bo'lishi kerak")
    .optional(),
}).refine((data) => !data.newPassword || Boolean(data.currentPassword), {
  message: "Parolni o'zgartirish uchun joriy parol kerak",
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isRestaurantUser || !auth.token) return unauthorized("Kirish uchun login qiling");

    const token = auth.token as UserToken;
    if (token.role !== "ADMIN") return forbidden("Admin ruxsat kerak");

    const profile = await prisma.user.findFirst({
      where: { id: token.userId, restaurantId: token.restaurantId, role: "ADMIN", isActive: true },
      select: { id: true, name: true, phone: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
    if (!profile) return unauthorized("Admin profil topilmadi");

    return success(profile);
  } catch (error) {
    console.error("[Admin Profile Get Error]", error);
    return serverError("Profilni olishda xato");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isRestaurantUser || !auth.token) return unauthorized("Kirish uchun login qiling");

    const token = auth.token as UserToken;
    if (token.role !== "ADMIN") return forbidden("Admin ruxsat kerak");

    const body = await request.json();
    const parseResult = updateProfileSchema.safeParse(body);
    if (!parseResult.success) return badRequest(zodMessage(parseResult.error));

    const current = await prisma.user.findFirst({
      where: { id: token.userId, restaurantId: token.restaurantId, role: "ADMIN", isActive: true },
      select: { id: true, pin: true },
    });
    if (!current) return unauthorized("Admin profil topilmadi");

    const data = parseResult.data;
    const updateData: { name?: string; phone?: string | null; pin?: string } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;

    if (data.newPassword) {
      const passwordMatches = await bcrypt.compare(data.currentPassword ?? "", current.pin);
      if (!passwordMatches) return badRequest("Joriy parol noto'g'ri");

      const users = await prisma.user.findMany({
        where: { restaurantId: token.restaurantId, id: { not: token.userId } },
        select: { id: true, pin: true },
      });
      const passwordExists = (
        await Promise.all(users.map(async (candidate) => ({
          id: candidate.id,
          matches: await bcrypt.compare(data.newPassword as string, candidate.pin),
        })))
      ).find((candidate) => candidate.matches);
      if (passwordExists) return badRequest("Bu parol boshqa userda ishlatilgan");

      updateData.pin = await bcrypt.hash(data.newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: token.userId },
      data: updateData,
      select: { id: true, name: true, phone: true, role: true, isActive: true, updatedAt: true },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "UPDATE",
      entity: "AdminProfile",
      entityId: updated.id,
      metadata: { name: updated.name, phone: updated.phone, passwordChanged: Boolean(data.newPassword) },
    });
    await publishEvent(restaurantChannel(token.restaurantId), "staff:updated", { action: "profile-updated", user: updated });

    return success(updated);
  } catch (error) {
    console.error("[Admin Profile Update Error]", error);
    return serverError("Profilni yangilashda xato");
  }
}
