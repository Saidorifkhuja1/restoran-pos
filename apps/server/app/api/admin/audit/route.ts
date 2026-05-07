import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPagination, getRestaurantToken } from "@/lib/route-helpers";
import { serverError, success, unauthorized } from "@/lib/responses";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    const { page, limit, skip } = getPagination(request);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { restaurantId: token.restaurantId },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          metadata: true,
          ipAddress: true,
          createdAt: true,
          actorUser: { select: { id: true, name: true, role: true } },
          actorSuperAdminId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where: { restaurantId: token.restaurantId } }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Audit List Error]", error);
    return serverError("Audit log olishda xato");
  }
}
