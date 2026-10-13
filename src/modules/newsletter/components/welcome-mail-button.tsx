"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WelcomeMailDialog } from "@/modules/newsletter/components/welcome-mail-dialog";
import type { NewsletterRecipient } from "@/modules/newsletter/server/queries";

export function WelcomeMailButton(props: {
  recipients: NewsletterRecipient[];
  restaurantName: string;
  googleUrl: string | null;
  tripadvisorUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const toWrite = props.recipients.filter((r) => !r.welcomeMailSent).length;

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Mail size={14} aria-hidden="true" />
        Premier mail{toWrite > 0 ? ` (${toWrite})` : ""}
      </Button>
      {open && <WelcomeMailDialog {...props} onOpenChange={setOpen} />}
    </>
  );
}
