import { NextRequest } from "next/server";
import { UserToken } from "@restopos/types";
import { getAuthContext } from "@/lib/responses";

export async function requireAdminAuth(request: NextRequest): Promise<{
  auth: ReturnType<typeof getAuthContext> extends Promise<infer T> ? T : never;
  token: UserToken;
  restaurantId: string;
}> {
  const auth = await getAuthContext(request);

  if (!auth.isRestaurantUser) {
    throw new Error("Unauthorized");
  }

  const token = auth.token as UserToken;

  if (token.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return {
    auth,
    token,
    restaurantId: token.restaurantId,
  };
}
