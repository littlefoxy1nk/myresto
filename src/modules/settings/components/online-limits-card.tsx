"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NumberStepper } from "@/components/ui/number-stepper";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import { updateOnlineRules, updateServiceOnlineRules } from "@/modules/booking/server/actions";
import { DAYS_AHEAD_OPTIONS, LEAD_OPTIONS, RULE_BOUNDS, formatDaysAhead, formatLeadTime, type OnlineRules } from "@/modules/booking/rules";

export type OnlineServiceSettings = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  /// Les heures proposées par ce service (de l'ouverture à la fermeture, par demi-heure).
  times: string[];
  onlineEnabled: boolean;
  onlineMaxCovers: number | null;
  onlineClosedTimes: string[];
};

const selectClass =
  "w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

function withCurrent(options: number[], current: number) {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

/// Ce que le restaurateur accepte en ligne : taille des groupes, jusqu'où à l'avance, délai minimum, et pour chaque service
/// s'il est proposé, son plafond de couverts et les heures laissées ouvertes. Le téléphone et le comptoir ne sont jamais limités.
export function OnlineLimitsCard({ rules, services }: { rules: OnlineRules; services: OnlineServiceSettings[] }) {
  const [draft, setDraft] = useState(rules);
  const [saved, setSaved] = useState(rules);
  const [pending, setPending] = useState(false);
  const dirty = draft.maxPartySize !== saved.maxPartySize || draft.maxDaysAhead !== saved.maxDaysAhead || draft.minLeadMinutes !== saved.minLeadMinutes;

  async function save() {
    setPending(true);
    try {
      await updateOnlineRules(draft);
      setSaved(draft);
      toast("Limites enregistrées");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <p className="text-sm font-semibold">Limites de la réservation en ligne</p>
        <p className="text-xs text-muted-foreground">
          Elles ne concernent que les demandes faites depuis le lien : tu peux toujours réserver toi-même plus de monde, ou plus tard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Plus grand groupe accepté en ligne</p>
          <div className="flex items-center gap-3">
            <NumberStepper
              value={draft.maxPartySize}
              onChange={(n) => setDraft((d) => ({ ...d, maxPartySize: n }))}
              min={RULE_BOUNDS.maxPartySize.min}
              max={RULE_BOUNDS.maxPartySize.max}
              label="Plus grand groupe accepté en ligne"
            />
            <span className="text-sm text-muted-foreground">personnes (au-delà, le client doit appeler)</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ol-days" className="text-xs font-medium text-muted-foreground">
            On peut réserver jusqu&apos;à…
          </label>
          <select id="ol-days" value={draft.maxDaysAhead} onChange={(e) => setDraft((d) => ({ ...d, maxDaysAhead: Number(e.target.value) }))} className={selectClass}>
            {withCurrent(DAYS_AHEAD_OPTIONS, draft.maxDaysAhead).map((d) => (
              <option key={d} value={d}>
                {formatDaysAhead(d)} à l&apos;avance
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ol-lead" className="text-xs font-medium text-muted-foreground">
            Délai minimum avant l&apos;heure choisie
          </label>
          <select id="ol-lead" value={draft.minLeadMinutes} onChange={(e) => setDraft((d) => ({ ...d, minLeadMinutes: Number(e.target.value) }))} className={selectClass}>
            {withCurrent(LEAD_OPTIONS, draft.minLeadMinutes).map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "Aucun délai" : `Au moins ${formatLeadTime(m)} avant`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button size="sm" onClick={save} disabled={!dirty || pending}>
        {pending ? "Enregistrement…" : "Enregistrer ces limites"}
      </Button>

      {services.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-sm font-semibold">Par service</p>
          {services.map((s) => (
            <ServiceLimits key={s.id} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceLimits({ service }: { service: OnlineServiceSettings }) {
  const [enabled, setEnabled] = useState(service.onlineEnabled);
  const [maxCovers, setMaxCovers] = useState(service.onlineMaxCovers === null ? "" : String(service.onlineMaxCovers));
  const [closed, setClosed] = useState(new Set(service.onlineClosedTimes));
  const [saved, setSaved] = useState({ enabled: service.onlineEnabled, maxCovers: service.onlineMaxCovers === null ? "" : String(service.onlineMaxCovers), closed: [...service.onlineClosedTimes].sort().join(",") });
  const [pending, setPending] = useState(false);

  const closedCsv = [...closed].sort().join(",");
  const dirty = enabled !== saved.enabled || maxCovers !== saved.maxCovers || closedCsv !== saved.closed;
  const coversNumber = maxCovers.trim() === "" ? null : Number(maxCovers);
  const coversInvalid = coversNumber !== null && (!Number.isInteger(coversNumber) || coversNumber < RULE_BOUNDS.maxCovers.min || coversNumber > RULE_BOUNDS.maxCovers.max);
  const openCount = service.times.filter((t) => !closed.has(t)).length;

  async function save() {
    if (coversInvalid) return;
    setPending(true);
    try {
      await updateServiceOnlineRules(service.id, { onlineEnabled: enabled, onlineMaxCovers: coversNumber, onlineClosedTimes: [...closed] });
      setSaved({ enabled, maxCovers, closed: closedCsv });
      toast(`${service.name} enregistré`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
    } finally {
      setPending(false);
    }
  }

  function toggleTime(t: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{service.name}</p>
          <p className="text-xs text-muted-foreground">
            {service.startTime} – {service.endTime}
            {enabled ? ` · ${openCount}/${service.times.length} heures ouvertes en ligne` : " · fermé en ligne"}
          </p>
        </div>
        <Switch checked={enabled} label={`${service.name} : proposé en ligne`} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <>
          <div className="space-y-1.5">
            <label htmlFor={`ol-covers-${service.id}`} className="text-xs font-medium text-muted-foreground">
              Couverts maximum en ligne sur ce service (par jour)
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`ol-covers-${service.id}`}
                type="number"
                inputMode="numeric"
                min={RULE_BOUNDS.maxCovers.min}
                max={RULE_BOUNDS.maxCovers.max}
                placeholder="Pas de limite"
                value={maxCovers}
                onChange={(e) => setMaxCovers(e.target.value)}
                className={cn(selectClass, "w-36")}
                aria-invalid={coversInvalid}
              />
              <span className="text-xs text-muted-foreground">couverts · vide = pas de limite</span>
            </div>
            {coversInvalid && <p className="text-xs text-urgent">Entre un nombre entier entre {RULE_BOUNDS.maxCovers.min} et {RULE_BOUNDS.maxCovers.max}, ou laisse vide.</p>}
            <p className="text-xs text-muted-foreground">Seules les demandes reçues en ligne comptent : tes réservations au téléphone gardent leurs places.</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Heures proposées en ligne (touche une heure pour la fermer)</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Heures proposées en ligne, ${service.name}`}>
              {service.times.map((t) => {
                const isClosed = closed.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={!isClosed}
                    onClick={() => toggleTime(t)}
                    className={cn(
                      "rounded-xl border px-2.5 py-1.5 text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                      isClosed ? "border-border bg-muted text-muted-foreground line-through" : "border-good/40 bg-good-soft text-foreground"
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Button size="sm" onClick={save} disabled={!dirty || pending || coversInvalid}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
