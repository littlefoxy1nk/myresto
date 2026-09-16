"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangeCodeDialog } from "@/modules/myspace/components/change-code-dialog";

export function ChangeCodeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <KeyRound size={14} aria-hidden="true" />
        Changer mon code
      </Button>
      <ChangeCodeDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
