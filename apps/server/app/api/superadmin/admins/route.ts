import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, badRequest, serverError, success, unauthorized } from "@/lib/responses";

const strongPassword = z
  .string()
  .min(8, "Parol kamida 8 ta belgi bo'lishi kerak")
  .regex(/[A-Z]/, "Parolda katta harf bo'lishi kerak")
  .regex(/[a-z]/, "Parolda kichik harf bo'lishi kerak")
  .regex(/\d/, "Parolda raqam bo'lishi kerak")
  .regex(/[^A-Za-z0-9]/, "Parolda maxsus belgi bo'lishi kerak");

const createSchema = z.object({
  name: z.string().min(2, "Ism kerak").max(80),
  email: z.string().email("Email noto'g'ri"),
  password: strongPassword,
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const admins = await prisma.superAdmin.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, lastLoginAt: true, createdAt: true },
    });

    return success(admins);
  } catch (error) {
    console.error("[SuperAdmin Admins Error]", error);
    return serverError("SuperAdminlarni olishda xato");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.errors[0]?.message || "Validation error");

    const exists = await prisma.superAdmin.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (exists) return badRequest("Bu email bilan SuperAdmin bor");

    const created = await prisma.superAdmin.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: await bcrypt.hash(parsed.data.password, 12),
      },
      select: { id: true, name: true, email: true, lastLoginAt: true, createdAt: true },
    });

    return success(created, 201);
  } catch (error) {
    console.error("[SuperAdmin Create Admin Error]", error);
    return serverError("SuperAdmin yaratishda xato");
  }
}
