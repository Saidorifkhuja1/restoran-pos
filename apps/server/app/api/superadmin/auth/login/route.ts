import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signSuperAdminToken } from "@/lib/auth";
import { createNextAuthSession } from "@/lib/nextauth";
import { badRequest, unauthorized, serverError, success } from "@/lib/responses";

const loginSchema = z.object({
  email: z.string().email("Noto'g'ri email"),
  password: z.string().min(6, "Parol kamida 6 ta belgi bo'lishi kerak"),
});

type LoginRequest = z.infer<typeof loginSchema>;

/**
 * POST /api/superadmin/auth/login
 * SuperAdmin email + password login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return badRequest(
        parseResult.error.errors[0]?.message || "Validation error"
      );
    }

    const { email, password } = parseResult.data as LoginRequest;

    // Find SuperAdmin
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, password: true },
    });

    if (!superAdmin) {
      return unauthorized("Email yoki parol noto'g'ri");
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, superAdmin.password);
    if (!passwordMatch) {
      return unauthorized("Email yoki parol noto'g'ri");
    }

    // Generate JWT token
    const token = await signSuperAdminToken(superAdmin.id);
    await createNextAuthSession({
      flow: "SUPERADMIN",
      email,
      password,
    }).catch(() => undefined);

    // Update last login
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLoginAt: new Date() },
    });

    return setAuthCookie(success({
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
      },
    }), token);
  } catch (error) {
    console.error("[SuperAdmin Login Error]", error);
    return serverError("Login xatosi yuz berdi");
  }
}
