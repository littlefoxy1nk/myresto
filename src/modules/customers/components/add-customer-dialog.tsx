"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/lib/toast-bus";
import { createCustomer } from "@/modules/customers/server/actions";

const FIELD =
  "w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

/// « Ajouter un client » : la base clients ne se remplit pas toute seule, on y ajoute ici (ou depuis une réservation) les personnes à garder.
export function AddCustomerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  function reset() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus size={14} aria-hidden="true" />
          Ajouter un client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Ajouter un client</DialogTitle>
        <DialogDescription>Il rejoint ta base clients, avec ses réservations déjà faites sous ce téléphone ou cet email.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            try {
              await createCustomer({ firstName, lastName, phone, email });
              toast("Client ajouté");
              setOpen(false);
              reset();
              router.refresh();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Impossible d'ajouter ce client.", "error");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm font-medium">
              Prénom
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus className={FIELD} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Nom
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={FIELD} />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            GSM
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0475 12 34 56" className={FIELD} />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
          </label>
          <p className="text-xs text-muted-foreground">Un téléphone ou un email est nécessaire pour retrouver ce client sur ses réservations.</p>
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={pending || !firstName.trim() || (!phone.trim() && !email.trim())}>
              {pending ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
