"use client";

import { useState } from "react";
import { Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequestTimeOffDialog } from "@/modules/myspace/components/request-timeoff-dialog";

export function RequestTimeOffButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Palmtree size={14} aria-hidden="true" />
        Demander un congé
      </Button>
      <RequestTimeOffDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
