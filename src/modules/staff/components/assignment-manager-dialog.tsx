"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { assignStaffToZone, removeStaffAssignment } from "@/modules/staff/server/assignments";
import type { AssignableMember, ZoneAssignments } from "@/modules/staff/server/assignments";

export function AssignmentManagerDialog({
  zones,
  assignableMembers,
  trigger,
}: {
  zones: ZoneAssignments[];
  assignableMembers: AssignableMember[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pickerZoneId, setPickerZoneId] = useState<string | null>(null);

  async function guarded(action: () => Promise<unknown>, successMessage?: string) {
    try {
      await action();
      if (successMessage) toast(successMessage);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogTitle>Affectations du service</DialogTitle>
        <DialogDescription>Qui s&apos;occupe de quelle zone en ce moment.</DialogDescription>

        <div className="mt-4 space-y-4">
          {zones.map((zone) => {
            const assignedIds = new Set(zone.members.map((m) => m.membershipId));
            const available = assignableMembers.filter((m) => !assignedIds.has(m.membershipId));

            return (
              <div key={zone.zoneId} className="space-y-2">
                <p className="text-sm font-semibold">{zone.zoneName}</p>
                <div className="flex flex-wrap gap-2">
                  {zone.members.map((m) => (
                    <span
                      key={m.assignmentId}
                      className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
                    >
                      {m.firstName} {m.lastName}
                      <button
                        onClick={() => guarded(() => removeStaffAssignment(m.assignmentId), `${m.firstName} retiré(e)`)}
                        aria-label={`Retirer ${m.firstName} ${m.lastName} de ${zone.zoneName}`}
                        className="rounded-full outline-none hover:text-urgent focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {zone.members.length === 0 && (
                    <span className="text-xs text-muted-foreground">Personne pour l&apos;instant</span>
                  )}
                </div>

                {pickerZoneId === zone.zoneId ? (
                  <div className="flex gap-2">
                    <select
                      autoFocus
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onChange={(e) => {
                        const membershipId = e.target.value;
                        if (!membershipId) return;
                        const member = assignableMembers.find((m) => m.membershipId === membershipId);
                        guarded(
                          () => assignStaffToZone({ membershipId, zoneId: zone.zoneId }),
                          member ? `${member.firstName} affecté(e) à ${zone.zoneName}` : undefined
                        );
                        setPickerZoneId(null);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Choisir une personne
                      </option>
                      {available.map((m) => (
                        <option key={m.membershipId} value={m.membershipId}>
                          {m.firstName} {m.lastName}
                          {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="ghost" onClick={() => setPickerZoneId(null)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPickerZoneId(zone.zoneId)}
                    disabled={available.length === 0}
                    className="text-xs font-medium text-accent outline-none hover:underline focus-visible:underline disabled:pointer-events-none disabled:opacity-50"
                  >
                    + Ajouter quelqu&apos;un
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
