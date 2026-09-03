import type { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
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
  { href: "/aujourdhui", label: "Aujourd'hui", icon: "Sun", mobile: true, available: true },
  { href: "/reservations", label: "Réservations", icon: "CalendarClock", permission: "reservations.view", mobile: true, available: true },
  { href: "/equipe", label: "Équipe", icon: "Users", permission: "staff.view", mobile: true, available: true },
  { href: "/parametres", label: "Paramètres", icon: "Settings", permission: "settings.manage", mobile: true, available: true },

  // Phase 3
  { href: "/plan-de-salle", label: "Plan de salle", icon: "LayoutGrid", permission: "floorplan.edit", available: false },
  { href: "/service", label: "Service", icon: "Utensils", permission: "service.run", available: false },
  // Phase 2
  { href: "/planning", label: "Planning", icon: "CalendarDays", permission: "schedule.view", available: false },
  { href: "/conges", label: "Congés", icon: "Palmtree", permission: "timeoff.manage", available: false },
  // Phase 4
  { href: "/clients", label: "Clients", icon: "Heart", permission: "crm.view", available: false },
  // Phase 5
  { href: "/marketing", label: "Marketing", icon: "Megaphone", permission: "marketing.view", available: false },
  // Phase 6
  { href: "/stock", label: "Stock", icon: "Boxes", permission: "inventory.view", available: false },
  { href: "/finances", label: "Finances", icon: "LineChart", permission: "finance.view", available: false },
];

export function visibleNavItems(can: (permission: PermissionKey) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => item.available && (!item.permission || can(item.permission)));
}
