"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { updateCustomerProfile } from "@/modules/customers/server/actions";

export function CustomerProfileForm({
  customerId,
  initial,
  tables,
}: {
  customerId: string;
  initial: {
    preferences: string | null;
    allergies: string | null;
    notes: string | null;
    favoriteTableId: string | null;
    phone: string | null;
    birthday: string | null;
  };
  tables: { id: string; label: string }[];
}) {
  const [preferences, setPreferences] = useState(initial.preferences ?? "");
  const [allergies, setAllergies] = useState(initial.allergies ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [favoriteTableId, setFavoriteTableId] = useState(initial.favoriteTableId ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [birthday, setBirthday] = useState(initial.birthday ?? "");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await updateCustomerProfile(customerId, { preferences, allergies, notes, favoriteTableId, phone, birthday });
          toast("Fiche mise à jour");
        } catch (err) {
          toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="customer-phone" className="text-sm font-medium">
            GSM
          </label>
          <input
            id="customer-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0475 12 34 56"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="customer-birthday" className="text-sm font-medium">
            Date d&apos;anniversaire
          </label>
          <input
            id="customer-birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="customer-preferences" className="text-sm font-medium">
            Préférences
          </label>
          <textarea
            id="customer-preferences"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            rows={2}
            placeholder="ex: aime être près de la fenêtre"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="customer-allergies" className="text-sm font-medium">
            Allergies
          </label>
          <textarea
            id="customer-allergies"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            rows={2}
            placeholder="ex: fruits à coque"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="customer-table" className="text-sm font-medium">
          Table préférée
        </label>
        <select
          id="customer-table"
          value={favoriteTableId}
          onChange={(e) => setFavoriteTableId(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64"
        >
          <option value="">Aucune</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="customer-notes" className="text-sm font-medium">
          Notes internes
        </label>
        <textarea
          id="customer-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="ex: habitué du vendredi soir avec des collègues"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
