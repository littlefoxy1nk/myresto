"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Download, MoreVertical, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstall } from "@/components/pwa/use-install";

const DISMISS_KEY = "myresto-install-dismissed";

/// Dans Paramètres : tout ce qu'il faut pour installer l'appli, selon le téléphone.
export function InstallAppCard() {
  const { ready, installed, ios, canPrompt, prompt } = useInstall();
  const [done, setDone] = useState(false);

  if (!ready) return null;

  if (installed || done) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-good-soft text-good" aria-hidden="true">
          <Check size={20} />
        </span>
        <div>
          <p className="text-[15px] font-semibold tracking-tight">MYRESTO est installée sur cet appareil</p>
          <p className="text-sm text-muted-foreground">Tu la retrouves sur ton écran d&apos;accueil, comme une vraie application.</p>
        </div>
      </div>
    );
  }

  return (
    <div id="installer" className="scroll-mt-24 rounded-3xl border border-border/70 bg-card p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent" aria-hidden="true">
          <Smartphone size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight">Installer MYRESTO sur ton téléphone</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Une icône sur ton écran d&apos;accueil, l&apos;appli en plein écran, sans barre d&apos;adresse : le plus pratique en plein service.
          </p>
        </div>
      </div>

      {canPrompt ? (
        <Button
          className="mt-4"
          onClick={async () => {
            if ((await prompt()) === "accepted") setDone(true);
          }}
        >
          <Download size={16} aria-hidden="true" />
          Installer l&apos;appli
        </Button>
      ) : ios ? (
        <ol className="mt-4 space-y-3 text-sm">
          <Step n={1}>
            Ouvre cette page dans <span className="font-semibold">Safari</span>, puis appuie sur{" "}
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-1.5 py-0.5 font-semibold">
              <Share size={14} aria-hidden="true" /> Partager
            </span>{" "}
            (le carré avec une flèche, en bas de l&apos;écran).
          </Step>
          <Step n={2}>
            Fais défiler et choisis{" "}
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-1.5 py-0.5 font-semibold">
              <PlusSquare size={14} aria-hidden="true" /> Sur l&apos;écran d&apos;accueil
            </span>
            .
          </Step>
          <Step n={3}>
            Appuie sur <span className="font-semibold">Ajouter</span> : l&apos;icône MYRESTO apparaît avec tes autres applis.
          </Step>
        </ol>
      ) : (
        <ol className="mt-4 space-y-3 text-sm">
          <Step n={1}>
            Ouvre le menu du navigateur{" "}
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-1.5 py-0.5 font-semibold">
              <MoreVertical size={14} aria-hidden="true" /> ⋮
            </span>
            .
          </Step>
          <Step n={2}>
            Choisis <span className="font-semibold">Installer l&apos;application</span> (ou <span className="font-semibold">Ajouter à l&apos;écran d&apos;accueil</span>).
          </Step>
        </ol>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-ink-foreground" aria-hidden="true">
        {n}
      </span>
      <span className="leading-6">{children}</span>
    </li>
  );
}

/// Sur téléphone, une invitation discrète (qu'on peut fermer pour de bon) tant que l'appli n'est pas installée.
export function InstallBanner() {
  const { ready, installed, ios, canPrompt, prompt } = useInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      // Lire le choix gardé dans le navigateur ne se fait qu'après l'affichage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sans stockage, l'invitation reviendra : pas grave.
    }
  }

  // Sur téléphone seulement, et seulement quand on peut vraiment proposer quelque chose.
  if (!ready || installed || dismissed || !(canPrompt || ios)) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-3xl border border-border/70 bg-card p-3 pr-2 shadow-card md:hidden">
      <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Installe MYRESTO</p>
        <p className="text-xs text-muted-foreground">Une icône sur ton écran d&apos;accueil, en plein écran.</p>
      </div>
      {canPrompt ? (
        <Button size="sm" onClick={() => void prompt()}>
          Installer
        </Button>
      ) : (
        <Button size="sm" variant="secondary" asChild>
          <Link href="/parametres?tab=profil#installer">Comment ?</Link>
        </Button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ne plus afficher"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
