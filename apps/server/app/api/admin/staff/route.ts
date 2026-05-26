import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError, success } from "@/lib/responses";
import { UserToken } from "@restopos/types";
import { zodMessage } from "@/lib/route-helpers";
import { writeAuditLog } from "@/lib/audit";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Nom kamida 2 ta harf bo'lishi kerak"),
  phone: z.string().trim().optional(),
  pin: z.string().trim().optional(),
  password: z.string()
    .trim()
    .min(8, "Parol kamida 8 ta belgi bo'lishi kerak")
    .regex(/[A-Z]/, "Parolda katta harf bo'lishi kerak")
    .regex(/[a-z]/, "Parolda kichik harf bo'lishi kerak")
    .regex(/\d/, "Parolda raqam bo'lishi kerak")
    .regex(/[^A-Za-z0-9]/, "Parolda maxsus belgi bo'lishi kerak")
    .optional(),
  role: z.enum(["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"], {
    errorMap: () => ({ message: "Noto'g'ri rol" }),
  }),
}).superRefine((data, ctx) => {
  if (data.role === "ADMIN") {
    if (!data.password) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "Admin uchun kuchli parol majburiy" });
    }
    return;
  }

  if (!data.pin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pin"], message: "PIN majburiy" });
    return;
  }

  if (data.pin.length < 4) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pin"], message: "PIN kamida 4 ta raqam bo'lishi kerak" });
  }

  if (!/^\d+$/.test(data.pin)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pin"], message: "PIN faqat raqamlardan iborat" });
  }
});

type CreateStaffRequest = z.infer<typeof createStaffSchema>;

/**
 * GET /api/admin/staff
 * List all staff (ADMIN & MANAGER)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (!["ADMIN", "MANAGER", "CASHIER"].includes(token.role)) {
      return forbidden("Ruxsat kerak");
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          restaurantId: token.restaurantId,
          role: { not: "ADMIN" }, // Don't list admin users
        },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({
        where: {
          restaurantId: token.restaurantId,
          role: { not: "ADMIN" },
        },
      }),
    ]);

    return success({
      items: users,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[Get Staff Error]", error);
    return serverError("Xodimlari olishda xato");
  }
}

/**
 * POST /api/admin/staff
 * Create new staff (ADMIN only)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (token.role !== "ADMIN") {
      return forbidden("Admin ruxsat kerak");
    }

    const body = await request.json();
    const parseResult = createStaffSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest(zodMessage(parseResult.error));
    }

    const data = parseResult.data as CreateStaffRequest;

    const sameRestaurantUsers = await prisma.user.findMany({
      where: {
        restaurantId: token.restaurantId,
      },
      select: { id: true, pin: true },
    });

    const credential = data.role === "ADMIN" ? data.password : data.pin;
    if (!credential) {
      return badRequest(data.role === "ADMIN" ? "Admin uchun kuchli parol majburiy" : "PIN majburiy");
    }

    const existingUser = (
      await Promise.all(
        sameRestaurantUsers.map(async (candidate) => ({
          candidate,
          matches: await bcrypt.compare(credential, candidate.pin),
        }))
      )
    ).find(({ matches }) => matches)?.candidate;

    if (existingUser) {
      return badRequest(data.role === "ADMIN" ? "Bu parol allaqachon ishlatilgan" : "Bu PIN allaqachon ishlatilgan");
    }

    const hashedPin = await bcrypt.hash(credential, 10);

    const user = await prisma.user.create({
      data: {
        restaurantId: token.restaurantId,
        name: data.name,
        phone: data.phone || null,
        pin: hashedPin,
        role: data.role,
        createdBy: token.userId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      metadata: { name: user.name, role: user.role },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "staff:updated", {
      action: "created",
      user,
    });

    return success(user, 201);
  } catch (error) {
    console.error("[Create Staff Error]", error);
    return serverError("Xodim yaratishda xato");
  }
}
