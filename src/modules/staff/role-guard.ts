/// Qui a le droit de donner quels droits à qui. Sans ces règles, un responsable qui peut « gérer l'équipe » pourrait se
/// donner (ou donner à un complice) des droits qu'il n'a pas — les finances, les paramètres, voire le statut de
/// propriétaire — ou régénérer le code du propriétaire pour se connecter à sa place.
export type RoleGrantCheck = {
  actor: { permissions: ReadonlySet<string>; isOwner: boolean };
  /// La personne dont on change le rôle (null à la création d'un compte).
  target: { currentRoleKey: string | null; isSelf: boolean };
  /// Ce qu'on veut lui donner : le rôle de base choisi et la liste finale de droits.
  next: { baseRoleKey: string; resultingKeys: readonly string[] };
};

export function checkRoleGrant({ actor, target, next }: RoleGrantCheck): string | null {
  if (target.isSelf) return "Tu ne peux pas modifier ton propre rôle ni tes propres droits.";
  if (target.currentRoleKey === "OWNER" && !actor.isOwner) return "Seul le propriétaire peut modifier le compte du propriétaire.";
  if (next.baseRoleKey === "OWNER" && !actor.isOwner) return "Seul le propriétaire peut donner le rôle de propriétaire.";
  if (!actor.isOwner) {
    const beyond = next.resultingKeys.filter((key) => !actor.permissions.has(key));
    if (beyond.length > 0) return "Tu ne peux pas donner des droits que tu n'as pas toi-même.";
  }
  return null;
}

/// Agir sur un compte (régénérer son code, le retirer) : le compte du propriétaire n'est touchable que par lui.
export function checkAccountAction(actor: { isOwner: boolean }, target: { roleKey: string }): string | null {
  if (target.roleKey === "OWNER" && !actor.isOwner) return "Seul le propriétaire peut agir sur le compte du propriétaire.";
  return null;
}
