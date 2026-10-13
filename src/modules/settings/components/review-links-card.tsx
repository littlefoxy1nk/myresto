"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { updateReviewLinks } from "@/modules/newsletter/server/actions";

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function ReviewLinksCard({ google, tripadvisor }: { google: string | null; tripadvisor: string | null }) {
  const [googleUrl, setGoogleUrl] = useState(google ?? "");
  const [tripadvisorUrl, setTripadvisorUrl] = useState(tripadvisor ?? "");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await updateReviewLinks({ google: googleUrl, tripadvisor: tripadvisorUrl });
          toast("Liens d'avis enregistrés");
        } catch (err) {
          toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="review-google" className="text-sm font-medium">
          Lien d&apos;avis Google
        </label>
        <input id="review-google" value={googleUrl} onChange={(e) => setGoogleUrl(e.target.value)} placeholder="https://g.page/r/…" className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="review-tripadvisor" className="text-sm font-medium">
          Lien d&apos;avis TripAdvisor
        </label>
        <input
          id="review-tripadvisor"
          value={tripadvisorUrl}
          onChange={(e) => setTripadvisorUrl(e.target.value)}
          placeholder="https://www.tripadvisor.be/…"
          className={field}
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
