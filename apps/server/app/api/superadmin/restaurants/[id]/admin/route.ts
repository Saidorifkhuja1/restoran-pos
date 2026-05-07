import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getAuthContext } from "@/lib/responses";
import { SuperAdminToken } from "@restopos/types";
import { zodMessage } from "@/lib/route-helpers";

type RouteParams = { params: Promise<{ id: string }> };

const adminSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(40).optional(),
  pin: z.string().length(4).regex(/^\d+$/),
});

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const admins = await prisma.user.findMany({
      where: { restaurantId: params.id, role: "ADMIN" },
      select: { id: true, name: true, phone: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return success(admins);
  } catch (error) {
    console.error("[Get Restaurant Admins Error]", error);
    return serverError("Adminlarni olishda xato");
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const parsed = adminSchema.safeParse(await request.json());
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
    if (pinExists) return badRequest("Bu PIN allaqachon ishlatilgan");

    const admin = await prisma.user.create({
      data: {
        restaurantId: params.id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        pin: await bcrypt.hash(parsed.data.pin, 10),
        role: "ADMIN",
        createdBy: (auth.token as SuperAdminToken).superAdminId,
      },
      select: { id: true, name: true, phone: true, role: true, isActive: true, createdAt: true },
    });

    return success(admin, 201);
  } catch (error) {
    console.error("[Create Restaurant Admin Error]", error);
    return serverError("Admin yaratishda xato");
  }
}
