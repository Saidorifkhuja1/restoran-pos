import NextAuth from "next-auth";
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

        const users = await prisma.user.findMany({
          where: { restaurantId: staffParsed.data.restaurantId, isActive: true },
          select: { id: true, name: true, role: true, pin: true, restaurantId: true },
        });
        const user = (
          await Promise.all(
            users.map(async (candidate) => ({
              candidate,
              matches: await bcrypt.compare(staffParsed.data.pin, candidate.pin),
            }))
          )
        ).find(({ matches }) => matches)?.candidate;
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurantId,
        };
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
        id: token.sub || "",
        role: token.role as string,
        restaurantId: token.restaurantId as string | undefined,
      };
      return session;
    },
  },
});

export const handlers = nextAuth.handlers;

export async function createNextAuthSession(
  credentials: Record<string, string>
): Promise<void> {
  await nextAuth.signIn("credentials", {
    ...credentials,
    redirect: false,
  });
}
