"use client";

import { useRef, useTransition } from "react";
import { Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { uploadCertificate } from "@/modules/myspace/server/actions";

/// Toujours proposé, jamais obligatoire : ce bouton n'apparaît que sur une absence
/// maladie déjà déclarée (voir mon-espace/page.tsx), jamais comme un champ requis à
/// la déclaration. Une fois un certificat attaché, seul un lien de téléchargement
/// reste affiché — pas de remplacement, ce n'est pas demandé.
export function CertificateButton({
  timeOffRequestId,
  document,
}: {
  timeOffRequestId: string;
  document: { id: string; originalName: string } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  if (document) {
    return (
      <a
        href={`/api/employee-documents/${document.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        <FileText size={13} aria-hidden="true" />
        Certificat
      </a>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const formData = new FormData();
          formData.set("timeOffRequestId", timeOffRequestId);
          formData.set("file", file);
          startTransition(async () => {
            try {
              await uploadCertificate(formData);
              toast("Certificat ajouté");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
            } finally {
              if (inputRef.current) inputRef.current.value = "";
            }
          });
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-auto px-2 py-1 text-xs"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip size={13} aria-hidden="true" />
        {pending ? "Envoi…" : "Ajouter un certificat"}
      </Button>
    </>
  );
}
