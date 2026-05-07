import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthContext } from "@/lib/responses";
import { UserRole, UserToken } from "@restopos/types";

export function zodMessage(error: ZodError): string {
  return error.errors[0]?.message || "Validation error";
}

export function getPagination(request: NextRequest): {
  page: number;
  limit: number;
  skip: number;
} {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10))
  );

  return { page, limit, skip: (page - 1) * limit };
}

export async function getRestaurantToken(
  request: NextRequest,
  roles: readonly UserRole[]
): Promise<UserToken | null> {
  const auth = await getAuthContext(request);

  if (!auth.isRestaurantUser || !auth.token || auth.token.role === "SUPERADMIN") {
    return null;
  }

  const token = auth.token;
  return roles.includes(token.role) ? token : null;
}

export function isRestaurantRole(
  token: UserToken | null,
  roles: readonly UserRole[]
): token is UserToken {
  return Boolean(token && roles.includes(token.role));
}
