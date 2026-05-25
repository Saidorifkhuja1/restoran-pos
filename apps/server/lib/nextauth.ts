import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const superAdminCredentialsSchema = z.object({
  flow: z.literal("SUPERADMIN"),
  email: z.string().email(),
  password: z.string().min(6),
});

const staffCredentialsSchema = z.object({
  flow: z.literal("STAFF"),
  restaurantId: z.string().min(1),
  pin: z.string().length(4),
});

const nextAuth = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "RestoPOS Credentials",
      credentials: {
        flow: {},
        email: {},
        password: {},
        restaurantId: {},
        pin: {},
      },
      async authorize(credentials) {
        const superAdminParsed = superAdminCredentialsSchema.safeParse(credentials);
        if (superAdminParsed.success) {
          const superAdmin = await prisma.superAdmin.findUnique({
            where: { email: superAdminParsed.data.email },
            select: { id: true, email: true, name: true, password: true },
          });
          if (!superAdmin) return null;
          const matches = await bcrypt.compare(superAdminParsed.data.password, superAdmin.password);
          if (!matches) return null;
          return {
            id: superAdmin.id,
            email: superAdmin.email,
            name: superAdmin.name,
            role: "SUPERADMIN",
          };
        }

        const staffParsed = staffCredentialsSchema.safeParse(credentials);
        if (!staffParsed.success) return null;

        // Hash the incoming PIN and use DB unique index lookup
        // Since PIN is stored as bcrypt hash, we need to compare against candidates.
        // Optimize: use findFirst with unique constraint on (restaurantId, pin) — but pin
        // is hashed. So we still need to iterate, but limit to active users only and
        // short-circuit on first match.
        const users = await prisma.user.findMany({
          where: { restaurantId: staffParsed.data.restaurantId, isActive: true },
          select: { id: true, name: true, role: true, pin: true, restaurantId: true },
        });

        // Sequential comparison with early exit (more efficient than parallel for small sets)
        for (const candidate of users) {
          const matches = await bcrypt.compare(staffParsed.data.pin, candidate.pin);
          if (matches) {
            return {
              id: candidate.id,
              name: candidate.name,
              role: candidate.role,
              restaurantId: candidate.restaurantId,
            };
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.restaurantId = (user as { restaurantId?: string }).restaurantId;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.sub ?? "",
        role: token.role as string,
        restaurantId: token.restaurantId as string | undefined,
      };
      return session;
    },
  },
});

export const handlers = nextAuth.handlers;

export async function auth(): Promise<Session | null> {
  return nextAuth.auth();
}

export async function createNextAuthSession(
  credentials: Record<string, string>
): Promise<void> {
  await nextAuth.signIn("credentials", {
    ...credentials,
    redirect: false,
  });
}
