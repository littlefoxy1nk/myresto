import type { PermissionKey } from "@/lib/permissions";
import { moduleKeyForHref, parseDisabledModules } from "@/lib/modules";

export type NavItem = {
  href: string;
  label: string;
  /// Libellé pour la barre du bas sur mobile, si différent de `label` — jusqu'à 6 onglets
  /// doivent tenir sur 375px, un mot un peu long y force sinon un retour à la ligne disgracieux.
  mobileLabel?: string;
  icon: string; // clé lucide-react
  permission?: PermissionKey;
  mobile?: boolean; // visible dans la barre de navigation mobile
  /// Le module existe dans l'architecture (routes, données, permissions) mais n'a pas
  /// encore d'interface aboutie. Tant que `available` est false, il reste volontairement
  /// hors de la navigation principale : mieux vaut un produit qui paraît maîtrisé et
  /// minimaliste qu'un menu qui promet des écrans inachevés. Passer à true est le seul
  /// changement nécessaire pour l'exposer, une fois la Phase correspondante livrée.
  available: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/aujourdhui", label: "Aujourd'hui", mobileLabel: "Auj.", icon: "Sun", mobile: true, available: true },
  // Sans `permission` : visible par tout le monde, y compris un rôle qui n'a accès à
  // rien d'autre — c'est l'espace de CHACUN, pas un module métier réservé.
  { href: "/mon-espace", label: "Mon espace", mobileLabel: "Moi", icon: "UserCircle", mobile: true, available: true },
  // Juste après "Mon espace" et visible en mobile : c'est la première chose qu'un
  // employé veut consulter depuis son téléphone (voir schedule.view — tout le monde
  // qui peut voir un planning peut aussi y accéder directement, pas seulement les
  // managers qui l'éditent).
  { href: "/planning", label: "Planning", icon: "CalendarDays", permission: "schedule.view", mobile: true, available: true },
  { href: "/reservations", label: "Réservations", mobileLabel: "Résa", icon: "CalendarClock", permission: "reservations.view", mobile: true, available: true },
  { href: "/plan-de-salle", label: "Plan de salle", mobileLabel: "Plan", icon: "LayoutGrid", permission: "floorplan.view", mobile: true, available: true },
  { href: "/equipe", label: "Équipe", icon: "Users", permission: "staff.view", mobile: true, available: true },

  // Phase 2
  { href: "/conges", label: "Congés", icon: "Palmtree", permission: "timeoff.manage", available: true },
  { href: "/clients", label: "Clients", icon: "Heart", permission: "crm.view", available: true },
  { href: "/finances", label: "Finances", icon: "LineChart", permission: "finance.view", available: true },
  { href: "/stock", label: "Stock", icon: "Boxes", permission: "inventory.view", available: true },
  { href: "/marketing", label: "Communication", icon: "Megaphone", permission: "marketing.view", available: true },

  // Toujours en dernier dans la sidebar desktop — la configuration de l'établissement
  // n'est pas une tâche opérationnelle du quotidien, elle ne doit pas se mêler aux
  // modules qu'on utilise pour faire tourner le service. Reste `mobile: true` : sa
  // position dans la barre du bas n'est pas affectée (déjà filtrée séparément).
  // Sans `permission` : chacun y règle son propre bonhomme, ses notifications et peut écrire au support ;
  // les réglages de l'établissement n'y apparaissent que pour qui a `settings.manage`.
  { href: "/parametres", label: "Paramètres", mobileLabel: "Réglages", icon: "Settings", mobile: true, available: true },
];

/// `disabledModules` : les fonctionnalités que l'établissement a masquées (Paramètres → Fonctionnalités).
export function visibleNavItems(can: (permission: PermissionKey) => boolean, disabledModules?: string | null): NavItem[] {
  const disabled = parseDisabledModules(disabledModules);
  return NAV_ITEMS.filter((item) => {
    if (!item.available) return false;
    if (item.permission && !can(item.permission)) return false;
    const key = moduleKeyForHref(item.href);
    return !(key && disabled.has(key));
  });
}
