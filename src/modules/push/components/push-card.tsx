"use client";

import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { getPushPublicKey, removePushSubscription, savePushSubscription, sendTestPush } from "@/modules/push/server/actions";

type State = "loading" | "unsupported" | "needs-install" | "not-configured" | "denied" | "off" | "on";

/// La clé publique arrive en texte base64 ; le navigateur la veut en octets.
function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  let s = "";
  for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/// Recevoir les notifications sur ce téléphone, même appli fermée. Sur iPhone, ça ne marche qu'une fois MYRESTO ajouté à
/// l'écran d'accueil (règle d'Apple) : on l'explique au lieu de laisser un bouton qui ne fait rien.
export function PushCard() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const set = (s: State) => !cancelled && setState(s);
      if (isIos() && !isInstalled()) return set("needs-install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return set("unsupported");
      const key = await getPushPublicKey().catch(() => null);
      if (!key) return set("not-configured");
      if (Notification.permission === "denied") return set("denied");
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const existing = await registration?.pushManager.getSubscription();
        set(existing && Notification.permission === "granted" ? "on" : "off");
      } catch {
        set("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const key = await getPushPublicKey();
      if (!key) return setState("not-configured");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) }));
      await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: toBase64Url(subscription.getKey("p256dh")),
        auth: toBase64Url(subscription.getKey("auth")),
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setState("on");
      toast("Notifications activées sur cet appareil");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'activer les notifications.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
      toast("Notifications coupées sur cet appareil");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible de les couper.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const result = await sendTestPush();
      if (result.ok) toast("Notification d'essai envoyée");
      else toast(result.error, "error");
    } catch {
      toast("Impossible d'envoyer l'essai.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "not-configured") return null;

  const hints: Partial<Record<State, string>> = {
    "needs-install": "Sur iPhone, ajoute d'abord MYRESTO à ton écran d'accueil (Partager → Sur l'écran d'accueil), ouvre-le depuis l'icône, puis reviens ici.",
    unsupported: "Ce navigateur ne permet pas les notifications hors de l'appli.",
    denied: "Les notifications sont bloquées pour MYRESTO dans les réglages de ton téléphone ou de ton navigateur. Autorise-les, puis reviens ici.",
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Smartphone size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Sur ce téléphone, appli fermée</p>
          <p className="text-xs text-muted-foreground">
            {state === "on"
              ? "Activé : tu reçois tes notifications sur cet appareil."
              : (hints[state] ?? "Reçois tes notifications (messages, horaires modifiés…) même quand MYRESTO est fermé.")}
          </p>
        </div>
      </div>
      {state === "off" && (
        <Button size="sm" onClick={enable} disabled={busy}>
          <BellRing size={14} aria-hidden="true" />
          Activer
        </Button>
      )}
      {state === "on" && (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={test} disabled={busy}>
            Envoyer un essai
          </Button>
          <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
            Couper
          </Button>
        </div>
      )}
    </div>
  );
}
