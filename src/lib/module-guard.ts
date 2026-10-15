import { redirect } from "next/navigation";
import { isModuleEnabled, type ModuleKey } from "@/lib/modules";

/// À mettre en tête de chaque page d'une fonctionnalité masquable : si l'établissement l'a désactivée
/// (Paramètres → Fonctionnalités), on renvoie vers Aujourd'hui au lieu d'afficher la page.
export function requireModule(ctx: { establishment: { disabledModules: string } }, key: ModuleKey) {
  if (!isModuleEnabled(ctx.establishment.disabledModules, key)) redirect("/aujourdhui");
}
