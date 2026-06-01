import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signUserToken } from "@/lib/auth";
import { createNextAuthSession } from "@/lib/nextauth";
import { badRequest, unauthorized, serverError, success } from "@/lib/responses";
import { zodMessage } from "@/lib/route-helpers";

const loginSchema = z.object({
  login: z.string().trim().min(2, "Ism majburiy"),
  password: z.string().trim().min(4, "Parol kamida 4 ta belgi bo'lishi kerak"),
});

type LoginRequest = z.infer<typeof loginSchema>;

/**
 * POST /api/auth/login
 * Restaurant staff name + password login
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

    const users = await prisma.user.findMany({
      where: {
        name: { equals: login, mode: "insensitive" },
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
      take: 25,
      orderBy: { updatedAt: "desc" },
    });

    const user = (
      await Promise.all(
        users.map(async (candidate) => ({
          candidate,
          matches: await bcrypt.compare(password, candidate.pin),
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
      login,
      password,
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
      token,
    });

    return setAuthCookie(response, token);
  } catch (error) {
    console.error("[Staff Login Error]", error);
    return serverError("Login xatosi yuz berdi");
  }
}
