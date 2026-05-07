import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/responses";
import { SuperAdminToken, UserToken } from "@restopos/types";

export type AuditInput = {
  action: string;
  entity: string;
  entityId?: string;
  restaurantId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(
  request: NextRequest,
  input: AuditInput
): Promise<void> {
  try {
    const auth = await getAuthContext(request);
    const actorUserId =
      auth.isRestaurantUser && auth.token && auth.token.role !== "SUPERADMIN"
        ? (auth.token as UserToken).userId
        : undefined;
    const actorSuperAdminId =
      auth.isSuperAdmin && auth.token
        ? (auth.token as SuperAdminToken).superAdminId
        : undefined;

    await prisma.auditLog.create({
      data: {
        restaurantId: input.restaurantId || undefined,
        actorUserId,
        actorSuperAdminId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });
  } catch (error) {
    console.error("[Audit Log Error]", error);
  }
}
