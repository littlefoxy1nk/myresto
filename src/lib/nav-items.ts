import type { PermissionKey } from "@/lib/permissions";
import { moduleKeyForHref, parseDisabledModules } from "@/lib/modules";

export type NavItem = {
  href: string;
  label: string;
  /// Libellé pour la barre du bas sur mobile, si différent de `label` — jusqu'à 6 onglets
  /// doivent tenir sur 375px, un mot un peu long y force sinon un retour à la ligne disgracieux.
  mobileLabel?: string;
  icon: string; // clé lucide-react
  group: NavGroup;
  permission?: PermissionKey;
  mobile?: boolean; // visible dans la barre de navigation mobile
  /// Épinglé dans la barre du bas sur mobile ; le reste passe par le bouton « Plus ».
  primary?: boolean;
  /// Le module existe dans l'architecture (routes, données, permissions) mais n'a pas
  /// encore d'interface aboutie. Tant que `available` est false, il reste volontairement
  /// hors de la navigation principale : mieux vaut un produit qui paraît maîtrisé et
  /// minimaliste qu'un menu qui promet des écrans inachevés. Passer à true est le seul
  /// changement nécessaire pour l'exposer, une fois la Phase correspondante livrée.
  available: boolean;
};

/// Les rubriques du menu : le quotidien en haut, puis la salle, l'équipe, la gestion.
/// Le libellé n'est affiché que si au moins un item de la rubrique est visible.
export type NavGroup = "jour" | "salle" | "equipe" | "gestion" | "compte";
export const NAV_GROUP_LABELS: Record<NavGroup, string | null> = {
  jour: null,
  salle: "Salle",
  equipe: "Personnel",
  gestion: "Gestion",
  compte: null,
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/aujourdhui", label: "Aujourd'hui", mobileLabel: "Auj.", icon: "Sun", group: "jour", mobile: true, primary: true, available: true },
  // Sans `permission` : visible par tout le monde, y compris un rôle qui n'a accès à
  // rien d'autre — c'est l'espace de CHACUN, pas un module métier réservé.
  { href: "/mon-espace", label: "Mon espace", mobileLabel: "Moi", icon: "UserCircle", group: "jour", mobile: true, available: true },

  { href: "/reservations", label: "Réservations", mobileLabel: "Résa", icon: "CalendarClock", permission: "reservations.view", group: "salle", mobile: true, primary: true, available: true },
  { href: "/plan-de-salle", label: "Plan de salle", mobileLabel: "Plan", icon: "LayoutGrid", permission: "floorplan.view", group: "salle", mobile: true, primary: true, available: true },

  // Le planning juste au-dessus de l'équipe : c'est la même famille (qui travaille quand),
  // et c'est la première chose qu'un employé veut consulter depuis son téléphone
  // (voir schedule.view — tout le monde qui peut voir un planning peut y accéder).
  { href: "/planning", label: "Planning", icon: "CalendarDays", permission: "schedule.view", group: "equipe", mobile: true, primary: true, available: true },
  { href: "/equipe", label: "Équipe", icon: "Users", permission: "staff.view", group: "equipe", mobile: true, available: true },
  { href: "/conges", label: "Congés", icon: "Palmtree", permission: "timeoff.manage", group: "equipe", available: true },

  { href: "/clients", label: "Clients", icon: "Heart", permission: "crm.view", group: "gestion", available: true },
  { href: "/finances", label: "Finances", icon: "LineChart", permission: "finance.view", group: "gestion", available: true },
  { href: "/stock", label: "Stock", icon: "Boxes", permission: "inventory.view", group: "gestion", available: true },
  { href: "/marketing", label: "Communication", icon: "Megaphone", permission: "marketing.view", group: "gestion", available: true },

  // Toujours en dernier — la configuration de l'établissement n'est pas une tâche
  // opérationnelle du quotidien, elle ne doit pas se mêler aux modules du service.
  // Sans `permission` : chacun y règle son propre bonhomme, ses notifications et peut écrire au support ;
  // les réglages de l'établissement n'y apparaissent que pour qui a `settings.manage`.
  { href: "/parametres", label: "Paramètres", mobileLabel: "Réglages", icon: "Settings", group: "compte", mobile: true, available: true },
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

/// Barre du bas sur mobile : quatre onglets épinglés au maximum, le reste passe par « Plus ».
/// Si peu d'onglets épinglés sont visibles (rôle restreint), on complète avec les suivants
/// pour que la barre ne soit jamais vide.
export function splitMobileNav(items: NavItem[]): { pinned: NavItem[]; more: NavItem[] } {
  const MAX = 4;
  const pinned = items.filter((i) => i.mobile && i.primary).slice(0, MAX);
  if (pinned.length < MAX) {
    for (const item of items) {
      if (pinned.length >= MAX) break;
      if (item.mobile && !pinned.includes(item) && item.href !== "/parametres") pinned.push(item);
    }
  }
  const order = (i: NavItem) => items.indexOf(i);
  pinned.sort((a, b) => order(a) - order(b));
  return { pinned, more: items.filter((i) => !pinned.includes(i)) };
}
