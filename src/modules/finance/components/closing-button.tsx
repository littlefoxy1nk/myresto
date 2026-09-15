"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClosingDialog } from "@/modules/finance/components/closing-dialog";

export function ClosingButton({
  date,
  dateLabel,
  initialRevenueCents,
  initialCovers,
  alreadyClosed,
}: {
  date: string;
  dateLabel: string;
  initialRevenueCents: number | null;
  initialCovers: number | null;
  alreadyClosed: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant={alreadyClosed ? "outline" : "primary"} className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        <Wallet size={14} aria-hidden="true" />
        {alreadyClosed ? "Modifier la clôture" : "Clôturer le service"}
      </Button>
      <ClosingDialog
        open={open}
        onOpenChange={setOpen}
        date={date}
        dateLabel={dateLabel}
        initialRevenueCents={initialRevenueCents}
        initialCovers={initialCovers}
      />
    </>
  );
}
