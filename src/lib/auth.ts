import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isLockedOut, computeFailedAttempt } from "@/lib/login-lockout";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email ou identifiant", type: "text" },
        secret: { label: "Mot de passe ou code", type: "password" },
      },
      /// Un employé sans e-mail se connecte par identifiant + code, un compte créé avec
      /// e-mail se connecte par email + mot de passe — voir le commentaire sur User dans
      /// schema.prisma. On ne devine pas lequel des deux d'après la forme du champ saisi
      /// (un identifiant pourrait ressembler à un email) : on cherche l'utilisateur par
      /// l'un OU l'autre, puis on essaie chaque secret réellement défini pour ce compte.
      authorize: async (credentials) => {
        const identifier = credentials?.identifier as string | undefined;
        const secret = credentials?.secret as string | undefined;
        if (!identifier || !secret) return null;

        const user = await prisma.user.findFirst({
          where: { OR: [{ email: identifier }, { username: identifier }] },
        });
        if (!user) return null;

        const now = new Date();
        if (isLockedOut(user.lockedUntil, now)) {
          return null;
        }

        const candidateHashes = [user.passwordHash, user.codeHash].filter((h): h is string => !!h);
        for (const hash of candidateHashes) {
          if (await bcrypt.compare(secret, hash)) {
            if (user.failedLoginAttempts > 0 || user.lockedUntil) {
              await prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: 0, lockedUntil: null },
              });
            }
            return { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}` };
          }
        }

        const { failedLoginAttempts, lockedUntil } = computeFailedAttempt(user.failedLoginAttempts, now);
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts, lockedUntil },
        });
        return null;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.userId = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) session.user.id = token.userId as string;
      return session;
    },
  },
});
