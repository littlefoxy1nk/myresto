import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { NewEmployeeForm } from "./new-employee-form";

export default async function NouvelEmployePage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("staff.manage")) redirect("/equipe");

  const roles = await prisma.role.findMany({
    where: { establishmentId: ctx.establishment.id, isSystem: true },
    include: { permissions: { include: { permission: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajouter un employé</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Un accès sera créé, avec le rôle et les permissions associées.
        </p>
      </div>

      <NewEmployeeForm
        roles={roles.map((r) => ({
          id: r.id,
          label: r.label,
          permissions: r.permissions.map((rp) => rp.permission.key),
        }))}
      />
    </div>
  );
}
