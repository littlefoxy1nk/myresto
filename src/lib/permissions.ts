// Catalogue central des permissions. C'est la seule source de vérité :
// la base de données est peuplée à partir de cette liste (voir prisma/seed.ts),
// et tout contrôle d'accès serveur passe par les clés définies ici.

export const PERMISSIONS = [
  // Réservations & salle
  { key: "reservations.view", label: "Voir les réservations", category: "reservations" },
  { key: "reservations.edit", label: "Créer / modifier les réservations", category: "reservations" },
  { key: "floorplan.edit", label: "Modifier le plan de salle", category: "reservations" },
  { key: "service.run", label: "Piloter le mode service", category: "reservations" },

  // Équipe / planning
  { key: "staff.view", label: "Voir l'équipe", category: "staff" },
  { key: "staff.manage", label: "Gérer l'équipe (fiches, rôles)", category: "staff" },
  { key: "schedule.view", label: "Voir le planning", category: "staff" },
  { key: "schedule.edit", label: "Modifier le planning", category: "staff" },
  { key: "timeoff.manage", label: "Valider les congés / absences", category: "staff" },

  // Finances
  { key: "payroll.view", label: "Voir les salaires", category: "finance" },
  { key: "finance.view", label: "Voir les finances de l'établissement", category: "finance" },

  // Stock
  { key: "inventory.view", label: "Voir le stock", category: "inventory" },
  { key: "inventory.manage", label: "Gérer le stock", category: "inventory" },

  // CRM
  { key: "crm.view", label: "Voir la fiche client", category: "crm" },
  { key: "crm.manage", label: "Gérer les clients", category: "crm" },

  // Marketing
  { key: "marketing.view", label: "Voir le calendrier marketing", category: "marketing" },
  { key: "marketing.publish", label: "Publier / planifier du contenu", category: "marketing" },

  // Paramètres
  { key: "settings.manage", label: "Gérer les paramètres de l'établissement", category: "settings" },
  { key: "insights.view", label: "Voir les statistiques et insights", category: "settings" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const SYSTEM_ROLES = [
  "OWNER",
  "DIRECTOR",
  "MANAGER",
  "FLOOR_MANAGER",
  "CHEF",
  "BAR_MANAGER",
  "FLOOR_STAFF",
  "KITCHEN_STAFF",
  "BAR_STAFF",
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[number];

const ALL: PermissionKey[] = PERMISSIONS.map((p) => p.key);

/// Matrice par défaut appliquée à la création d'un établissement.
/// Le propriétaire peut ensuite l'ajuster ou créer des rôles personnalisés.
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleKey, PermissionKey[]> = {
  OWNER: ALL,
  DIRECTOR: ALL,
  MANAGER: [
    "reservations.view", "reservations.edit", "floorplan.edit", "service.run",
    "staff.view", "staff.manage", "schedule.view", "schedule.edit", "timeoff.manage",
    "inventory.view", "inventory.manage",
    "crm.view", "crm.manage",
    "marketing.view", "marketing.publish",
    "insights.view", "finance.view",
  ],
  FLOOR_MANAGER: [
    "reservations.view", "reservations.edit", "floorplan.edit", "service.run",
    "staff.view", "schedule.view",
    "crm.view", "crm.manage",
    "insights.view",
  ],
  CHEF: [
    "reservations.view", "service.run",
    "staff.view", "schedule.view",
    "inventory.view", "inventory.manage",
  ],
  BAR_MANAGER: [
    "reservations.view", "service.run",
    "staff.view", "schedule.view",
    "inventory.view", "inventory.manage",
  ],
  FLOOR_STAFF: ["reservations.view", "service.run", "schedule.view"],
  KITCHEN_STAFF: ["service.run", "schedule.view", "inventory.view"],
  BAR_STAFF: ["service.run", "schedule.view", "inventory.view"],
};

export const ROLE_LABELS: Record<SystemRoleKey, string> = {
  OWNER: "Propriétaire",
  DIRECTOR: "Directeur",
  MANAGER: "Gérant",
  FLOOR_MANAGER: "Responsable de salle",
  CHEF: "Chef",
  BAR_MANAGER: "Responsable de bar",
  FLOOR_STAFF: "Employé de salle",
  KITCHEN_STAFF: "Employé de cuisine",
  BAR_STAFF: "Employé de bar",
};
