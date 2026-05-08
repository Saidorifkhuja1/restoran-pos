import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, badRequest, serverError, success } from "@/lib/responses";
import { signUserToken } from "@/lib/auth";
import { SuperAdminToken } from "@restopos/types";
import { zodMessage } from "@/lib/route-helpers";

const createRestaurantSchema = z.object({
  name: z.string().min(2, "Restoran nomi kamida 2 ta harf bo'lishi kerak").max(100),
  type: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  taxPercent: z.number().min(0).max(100).default(12),
  currency: z.string().length(3).default("UZS"),
  receiptFooter: z.string().optional(),
  // Admin user
  adminName: z.string().min(2, "Admin nomi kamida 2 ta harf bo'lishi kerak"),
  adminPhone: z.string().optional(),
  adminPin: z.string().length(4, "PIN 4 raqam bo'lishi kerak").regex(/^\d+$/, "PIN faqat raqamlardan iborat bo'lishi kerak"),
});

type CreateRestaurantRequest = z.infer<typeof createRestaurantSchema>;

/**
 * GET /api/superadmin/restaurants
 * List all restaurants (SuperAdmin only)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isSuperAdmin) {
      return unauthorized("SuperAdmin ruxsat kerak");
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

    const [restaurants, total] = await Promise.all([
      prisma.restaurant.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          phone: true,
          isActive: true,
          plan: true,
          planExpiresAt: true,
          createdAt: true,
          users: {
            where: { role: "ADMIN" },
            select: { id: true, name: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.restaurant.count(),
    ]);

    return success({
      items: restaurants,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[Get Restaurants Error]", error);
    return serverError("Restoranlarni olishda xato");
  }
}

/**
 * POST /api/superadmin/restaurants
 * Create new restaurant with admin user (SuperAdmin only)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isSuperAdmin) {
      return unauthorized("SuperAdmin ruxsat kerak");
    }

    const body = await request.json();

    // Validate input
    const parseResult = createRestaurantSchema.safeParse(body);
    if (!parseResult.success) {
      return badRequest(zodMessage(parseResult.error));
    }

    const data = parseResult.data as CreateRestaurantRequest;
    const superAdminId = (auth.token as SuperAdminToken).superAdminId;

    // Hash admin PIN
    const hashedPin = await bcrypt.hash(data.adminPin, 10);

    // Create restaurant and admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create restaurant
      const restaurant = await tx.restaurant.create({
        data: {
          name: data.name,
          type: data.type,
          address: data.address,
          phone: data.phone,
          taxId: data.taxId,
          taxPercent: data.taxPercent,
          currency: data.currency,
          receiptFooter: data.receiptFooter,
          createdBy: superAdminId,
        },
      });

      // 2. Create admin user
      const adminUser = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          name: data.adminName,
          phone: data.adminPhone,
          pin: hashedPin,
          role: "ADMIN",
          createdBy: superAdminId,
        },
      });

      // 3. Create restaurant settings
      await tx.restaurantSettings.create({
        data: {
          restaurantId: restaurant.id,
        },
      });
      await tx.restaurantCounter.create({
        data: {
          restaurantId: restaurant.id,
        },
      });

      return { restaurant, adminUser };
    });

    // Generate token for admin
    const adminToken = await signUserToken(
      result.adminUser.id,
      result.restaurant.id,
      "ADMIN"
    );

    return success(
      {
        restaurant: result.restaurant,
        adminUser: {
          id: result.adminUser.id,
          name: result.adminUser.name,
          role: result.adminUser.role,
        },
        adminToken,
      },
      201
    );
  } catch (error) {
    console.error("[Create Restaurant Error]", error);
    return serverError("Restoran yaratishda xato");
  }
}
