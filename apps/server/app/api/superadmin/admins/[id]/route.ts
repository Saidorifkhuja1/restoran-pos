import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext, notFound, serverError, success, unauthorized } from "@/lib/responses";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(_request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const { id } = await params;
    const admin = await prisma.superAdmin.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, lastLoginAt: true, createdAt: true },
    });

    if (!admin) return notFound("SuperAdmin topilmadi");
    return success(admin);
  } catch (error) {
    console.error("[SuperAdmin Admin Detail Error]", error);
    return serverError("SuperAdmin detail olishda xato");
  }
}
