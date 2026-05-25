import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, badRequest, serverError, success, unauthorized } from "@/lib/responses";
import { SuperAdminToken } from "@restopos/types";

const strongPassword = z
  .string()
  .min(8, "Parol kamida 8 ta belgi bo'lishi kerak")
  .regex(/[A-Z]/, "Parolda katta harf bo'lishi kerak")
  .regex(/[a-z]/, "Parolda kichik harf bo'lishi kerak")
  .regex(/\d/, "Parolda raqam bo'lishi kerak")
  .regex(/[^A-Za-z0-9]/, "Parolda maxsus belgi bo'lishi kerak");

const profileSchema = z.object({
  name: z.string().min(2, "Ism kerak").max(80),
  email: z.string().email("Email noto'g'ri"),
  currentPassword: z.string().optional(),
  newPassword: strongPassword.optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin || !auth.token) return unauthorized("SuperAdmin ruxsat kerak");

    const token = auth.token as SuperAdminToken;
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: token.superAdminId },
      select: { id: true, name: true, email: true, lastLoginAt: true, createdAt: true },
    });

    if (!superAdmin) return unauthorized("SuperAdmin topilmadi");
    return success(superAdmin);
  } catch (error) {
    console.error("[SuperAdmin Profile Error]", error);
    return serverError("Profilni olishda xato");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin || !auth.token) return unauthorized("SuperAdmin ruxsat kerak");

    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.errors[0]?.message || "Validation error");

    const token = auth.token as SuperAdminToken;
    const current = await prisma.superAdmin.findUnique({
      where: { id: token.superAdminId },
      select: { id: true, password: true },
    });
    if (!current) return unauthorized("SuperAdmin topilmadi");

    if (parsed.data.newPassword) {
      if (!parsed.data.currentPassword) return badRequest("Joriy parol kerak");
      const passwordMatch = await bcrypt.compare(parsed.data.currentPassword, current.password);
      if (!passwordMatch) return badRequest("Joriy parol noto'g'ri");
    }

    const updated = await prisma.superAdmin.update({
      where: { id: token.superAdminId },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        ...(parsed.data.newPassword ? { password: await bcrypt.hash(parsed.data.newPassword, 12) } : {}),
      },
      select: { id: true, name: true, email: true, lastLoginAt: true, createdAt: true },
    });

    return success(updated);
  } catch (error) {
    console.error("[SuperAdmin Profile Update Error]", error);
    return serverError("Profilni yangilashda xato");
  }
}
