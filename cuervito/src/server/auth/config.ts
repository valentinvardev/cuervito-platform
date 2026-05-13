import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import type { UserRole, UserStatus } from "../../../generated/prisma";

/**
 * Module augmentation — extend the Session shape with our domain fields.
 * Anything read off `session.user.*` in app code must be added here.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    status?: UserStatus;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: UserStatus;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  // We sit behind nginx / Cloudflare in production. NextAuth v5 needs this
  // flag to trust X-Forwarded-Host instead of rejecting the request as
  // UntrustedHost. AUTH_TRUST_HOST=true env var also works, but explicit beats
  // implicit.
  trustHost: true,
  // Explicit cookies config — Cloudflare's edge can strip cookies with the
  // __Host- / __Secure- prefixes in some setups, which causes a MissingCSRF
  // loop on the login form (CSRF cookie is set by the server, sent to the
  // browser, but server doesn't see it back on submit). We use plain names
  // and rely on Secure + httpOnly + SameSite=lax for protection.
  cookies: {
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            role: true,
            status: true,
          },
        });
        if (!user || !user.passwordHash) return null;
        if (user.status === "DELETED") return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role,
          status: user.status,
        };
      },
    }),
    ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: env.AUTH_GOOGLE_ID,
            clientSecret: env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],

  callbacks: {
    /**
     * On sign-in, attach role/status to the JWT. Refreshed on every login.
     * For OAuth (Google) we fetch from DB because the adapter created the user
     * just before this callback runs.
     */
    jwt: async ({ token, user }) => {
      const t = token as typeof token & {
        id?: string;
        role?: UserRole;
        status?: UserStatus;
      };
      if (user) {
        t.id = user.id;
        t.role = user.role ?? "PHOTOGRAPHER";
        t.status = user.status ?? "ACTIVE";
        return t;
      }
      if (t.id) {
        const dbUser = await db.user.findUnique({
          where: { id: t.id },
          select: { role: true, status: true },
        });
        if (dbUser) {
          t.role = dbUser.role;
          t.status = dbUser.status;
        }
      }
      return t;
    },

    session: ({ session, token }) => {
      const t = token as typeof token & {
        id?: string;
        role?: UserRole;
        status?: UserStatus;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).id = t.id ?? "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).role = t.role ?? "PHOTOGRAPHER";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).status = t.status ?? "ACTIVE";
      return session;
    },

    /**
     * Block suspended users from completing sign-in.
     */
    signIn: async ({ user }) => {
      const u = user as { status?: string };
      if (u.status === "SUSPENDED") return false;
      if (u.status === "DELETED") return false;
      return true;
    },
  },
} satisfies NextAuthConfig;
