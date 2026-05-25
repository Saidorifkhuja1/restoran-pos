import { NextRequest } from "next/server";
import { UserRole, UserToken } from "@restopos/types";
import { getAuthContext } from "@/lib/responses";

const ADMIN_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function requireAdminAuth(
  request: NextRequest,
  roles: readonly UserRole[] = ADMIN_ROLES
): Promise<{
  auth: Awaited<ReturnType<typeof getAuthContext>>;
  token: UserToken;
  restaurantId: string;
}> {
  const auth = await getAuthContext(request);

  if (!auth.isRestaurantUser || !auth.token || auth.token.role === "SUPERADMIN") {
    throw new Error("Unauthorized");
  }

  const token = auth.token as UserToken;

  if (!roles.includes(token.role)) {
    throw new Error("Forbidden");
  }

  return { auth, token, restaurantId: token.restaurantId };
}
