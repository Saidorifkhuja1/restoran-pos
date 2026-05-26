import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JWTPayload, UserRole } from "@restopos/types";
import { verifyToken } from "@/lib/auth";

export type PageRole = UserRole | "SUPERADMIN";

export async function getPageSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("restopos-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requirePageRole(roles: PageRole[]): Promise<JWTPayload> {
  const session = await getPageSession();
  if (!session) {
    const loginPath = roles.includes("SUPERADMIN") ? "/superadmin/login" : "/login";
    redirect(loginPath);
  }

  if (!roles.includes(session.role as PageRole)) {
    const loginPath = roles.includes("SUPERADMIN") ? "/superadmin/login" : "/login";
    redirect(`/switch-account?next=${encodeURIComponent(loginPath)}`);
  }

  return session;
}

export function defaultPathForPageRole(role: PageRole): string {
  if (role === "SUPERADMIN") return "/superadmin/dashboard";
  if (role === UserRole.KITCHEN) return "/kitchen";
  if (role === UserRole.CASHIER) return "/cashier";
  if (role === UserRole.ADMIN || role === UserRole.MANAGER) return "/admin/dashboard";
  return "/tables";
}
