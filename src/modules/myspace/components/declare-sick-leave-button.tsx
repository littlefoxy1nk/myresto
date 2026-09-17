"use client";

import { useState } from "react";
import { Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeclareSickLeaveDialog } from "@/modules/myspace/components/declare-sick-leave-dialog";

export function DeclareSickLeaveButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Thermometer size={14} aria-hidden="true" />
        Signaler une maladie
      </Button>
      <DeclareSickLeaveDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
