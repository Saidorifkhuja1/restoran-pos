import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext, serverError, success, unauthorized } from "@/lib/responses";
import { SuperAdminToken, UserToken } from "@restopos/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isAuthenticated || !auth.token) return unauthorized("Kirish uchun login qiling");

    if (auth.isSuperAdmin) {
      const token = auth.token as SuperAdminToken;
      const superAdmin = await prisma.superAdmin.findUnique({
        where: { id: token.superAdminId },
        select: { id: true, name: true, email: true },
      });
      if (!superAdmin) return unauthorized("Session topilmadi");
      return success({
        user: { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email, role: "SUPERADMIN" },
        restaurant: null,
      });
    }

    const token = auth.token as UserToken;
    const user = await prisma.user.findFirst({
      where: { id: token.userId, restaurantId: token.restaurantId, isActive: true, restaurant: { isActive: true } },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        restaurant: { select: { id: true, name: true, currency: true, taxPercent: true } },
      },
    });
    if (!user) return unauthorized("Session topilmadi");

    return success({
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
      restaurant: user.restaurant,
    });
  } catch (error) {
    console.error("[Auth Me Error]", error);
    return serverError("Sessionni olishda xato");
  }
}
