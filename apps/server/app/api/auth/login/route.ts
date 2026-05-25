import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signUserToken } from "@/lib/auth";
import { createNextAuthSession } from "@/lib/nextauth";
import { badRequest, unauthorized, serverError, success, notFound } from "@/lib/responses";
import { zodMessage } from "@/lib/route-helpers";

const loginSchema = z.object({
  login: z.string().min(2, "Login majburiy").optional(),
  password: z.string().min(4, "Parol kamida 4 ta belgi bo'lishi kerak").optional(),
  restaurantId: z.string().min(1, "Restoran ID majburiy").optional(),
  pin: z.string().min(4, "PIN kamida 4 ta raqam bo'lishi kerak").regex(/^\d+$/, "PIN faqat raqamlardan iborat bo'lishi kerak").optional(),
}).refine((data) => Boolean((data.login && data.password) || (data.restaurantId && data.pin)), {
  message: "Login/parol majburiy",
});

type LoginRequest = z.infer<typeof loginSchema>;

/**
 * POST /api/auth/login
 * Restaurant staff PIN login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return badRequest(zodMessage(parseResult.error));
    }

    const { login, password } = parseResult.data as LoginRequest;
    let restaurantId = parseResult.data.restaurantId;
    const pin = parseResult.data.pin ?? password;
    if (!pin) {
      return badRequest("Parol majburiy");
    }

    const normalizedLogin = login?.trim();
    const roleLogin = normalizedLogin?.toUpperCase();
    const userCandidates = normalizedLogin
      ? await prisma.user.findMany({
          where: {
            isActive: true,
            OR: [
              { phone: normalizedLogin },
              { name: { equals: normalizedLogin, mode: "insensitive" } },
              ...(roleLogin && ["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"].includes(roleLogin) ? [{ role: roleLogin as "ADMIN" | "MANAGER" | "WAITER" | "KITCHEN" | "CASHIER" }] : []),
            ],
          },
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                currency: true,
                taxPercent: true,
                isActive: true,
              },
            },
          },
        })
      : [];

    const legacyRestaurant = restaurantId
      ? await prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: { id: true, isActive: true },
        })
      : null;

    if (!normalizedLogin && !legacyRestaurant) {
      return notFound("Restoran topilmadi");
    }

    if (legacyRestaurant && !legacyRestaurant.isActive) {
      return unauthorized("Bu restoran faollashtirilmagan");
    }

    const users = normalizedLogin
      ? userCandidates
      : await prisma.user.findMany({
          where: {
            restaurantId,
            isActive: true,
          },
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                currency: true,
                taxPercent: true,
                isActive: true,
              },
            },
          },
        });

    const user = (
      await Promise.all(
        users.map(async (candidate) => ({
          candidate,
          matches: await bcrypt.compare(pin, candidate.pin),
        }))
      )
    ).find(({ matches }) => matches)?.candidate;

    if (!user) {
      return unauthorized("Login yoki parol noto'g'ri");
    }

    if (!user.restaurant.isActive) {
      return unauthorized("Bu restoran faollashtirilmagan");
    }

    const authRestaurantId = user.restaurantId;

    // Generate JWT token
    const token = await signUserToken(user.id, authRestaurantId, user.role);

    // NextAuth session is best-effort; the cookie-based JWT is the primary auth
    createNextAuthSession({
      flow: "STAFF",
      restaurantId: authRestaurantId,
      pin,
    }).catch(() => undefined);

    const response = success({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      restaurant: {
        id: user.restaurant.id,
        name: user.restaurant.name,
        currency: user.restaurant.currency,
        taxPercent: user.restaurant.taxPercent,
      },
    });

    return setAuthCookie(response, token);
  } catch (error) {
    console.error("[Staff Login Error]", error);
    return serverError("Login xatosi yuz berdi");
  }
}
