"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { getCurrentContext } from "@/lib/current-context";
import { deleteEstablishmentCompletely, isOwner } from "@/lib/account-deletion";
import { createRateLimiter } from "@/modules/booking/logic";

const perUser = createRateLimiter(5, 60 * 60_000);

const CloseSchema = z.object({
  confirmName: z.string(),
  password: z.string().min(1, "Saisis ton mot de passe."),
});

export type CloseEstablishmentResult = { ok: false; error: string };

/// Fermer son activité sur MYRESTO : supprime DÉFINITIVEMENT l'établissement et toutes ses données (voir
/// lib/account-deletion.ts). Réservé au propriétaire, qui doit recopier le nom de l'établissement ET redonner son mot de
/// passe : un compte laissé ouvert sur un écran ne suffit pas pour tout effacer. Ne retourne que s'il y a une erreur ;
/// en cas de succès la personne est déconnectée et renvoyée vers la page de connexion.
export async function closeEstablishment(input: z.infer<typeof CloseSchema>): Promise<CloseEstablishmentResult> {
  const ctx = await getCurrentContext();
  if (!isOwner(ctx)) return { ok: false, error: "Seul le propriétaire peut fermer l'établissement." };
  if (!perUser.allow(ctx.user.id, Date.now())) return { ok: false, error: "Trop de tentatives. Réessaie dans une heure." };

  const data = CloseSchema.safeParse(input);
  if (!data.success) return { ok: false, error: data.error.issues[0]?.message ?? "Données invalides." };

  if (data.data.confirmName.trim() !== ctx.establishment.name.trim()) {
    return { ok: false, error: "Le nom recopié ne correspond pas à celui de l'établissement." };
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { passwordHash: true, codeHash: true } });
  const hashes = [user?.passwordHash, user?.codeHash].filter((h): h is string => !!h);
  let valid = false;
  for (const hash of hashes) if (await bcrypt.compare(data.data.password, hash)) valid = true;
  if (!valid) return { ok: false, error: "Mot de passe incorrect." };

  // La trace reste côté serveur : le journal de l'établissement disparaît avec lui.
  const result = await deleteEstablishmentCompletely(ctx.establishment.id);
  console.info(
    JSON.stringify({ event: "establishment.deleted", establishmentId: ctx.establishment.id, by: ctx.user.id, at: new Date().toISOString(), ...result })
  );

  await signOut({ redirect: false });
  redirect("/login?closed=1");
}
