import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isLockedOut, computeFailedAttempt } from "@/lib/login-lockout";

/// Un faux hash (celui d'un code aléatoire, donc jamais valable) pour faire le même calcul quand le compte n'existe pas.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), 12);

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Une session dure 14 jours (au lieu de 30) ; un téléphone perdu ne reste pas ouvert indéfiniment.
  session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60 },
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
          where: { OR: [{ email: identifier.trim().toLowerCase() }, { email: identifier }, { username: identifier }] },
        });
        // Même durée de réponse que le compte existe ou non : on ne laisse pas deviner quelles adresses ont un compte.
        if (!user) {
          await bcrypt.compare(secret, DUMMY_HASH);
          return null;
        }

        const now = new Date();
        if (isLockedOut(user.lockedUntil, now)) {
          await bcrypt.compare(secret, DUMMY_HASH);
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
            return { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`, sessionVersion: user.sessionVersion } as { id: string; email: string | null; name: string; sessionVersion: number };
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
      if (user) {
        token.userId = user.id;
        // La « génération » des sessions au moment de la connexion : si elle change ensuite (mot de passe réinitialisé…), cette session n'est plus valable.
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) session.user.id = token.userId as string;
      (session as { sv?: number }).sv = (token.sv as number | undefined) ?? 0;
      return session;
    },
  },
});
