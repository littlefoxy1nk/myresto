"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast-bus";
import { ZoneTabs } from "@/modules/floorplan/components/zone-tabs";
import { FloorPlanCanvas } from "@/modules/floorplan/components/floor-plan-canvas";
import { getReservationPlanningData, type ReservationPlanningResult } from "@/modules/reservations/server/planning";
import { createReservation } from "@/modules/reservations/server/actions";
import {
  SpanNextService,
  servicesOnDate,
  type ServiceWithDays,
} from "@/modules/reservations/components/span-next-service";
import { effectiveDuration } from "@/modules/service/spans";
import type { TableSuggestion } from "@/modules/floorplan/server/suggestions";

/// Durée de table supposée (jamais choisie à la main : on ne peut pas prévoir le timing d'un repas).
const DURATION_MINUTES = 90;

type Step = 1 | 2 | 3;

export function NewReservationFlow({
  preselectedTableId,
  preselectedZoneId,
  initialDate,
  initialTime,
  services,
}: {
  preselectedTableId?: string;
  preselectedZoneId?: string;
  initialDate?: string;
  initialTime?: string;
  services: ServiceWithDays[];
}) {
  const [step, setStep] = useState<Step>(1);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(() => initialDate ?? format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(initialTime ?? "20:00");
  const [notes, setNotes] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [spansNextService, setSpansNextService] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [loadingPlanning, setLoadingPlanning] = useState(false);
  const [planning, setPlanning] = useState<ReservationPlanningResult | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(preselectedZoneId ?? null);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [createdReservation, setCreatedReservation] = useState<{ customerName: string; time: string } | null>(null);

  const allTables = useMemo(() => planning?.zones.flatMap((z) => z.tables) ?? [], [planning]);
  const activeZone = planning?.zones.find((z) => z.id === activeZoneId) ?? planning?.zones[0] ?? null;

  const selectedTables = allTables.filter((t) => selectedTableIds.has(t.id));
  const selectedCapacity = useMemo(() => {
    if (selectedTables.length === 0) return 0;
    const groupId = selectedTables[0].group?.id;
    const allSameGroup =
      groupId &&
      selectedTables.length > 1 &&
      selectedTables.every((t) => t.group?.id === groupId) &&
      selectedTables.length === selectedTables[0].group?.tableIds.length;
    if (allSameGroup) return selectedTables[0].group!.combinedCapacity;
    return selectedTables.reduce((s, t) => s + t.capacity, 0);
  }, [selectedTables]);

  const overCapacity = selectedTables.length > 0 && selectedCapacity < partySize;

  const duration = effectiveDuration(DURATION_MINUTES, time, spansNextService, servicesOnDate(services, date));

  async function goToTableStep() {
    setFormError(null);
    if (!customerName.trim()) return setFormError("Le nom du client est requis.");
    if (!date || !time) return setFormError("Choisissez une date et une heure.");
    if (partySize < 1) return setFormError("Indiquez au moins une personne.");

    setLoadingPlanning(true);
    try {
      const result = await getReservationPlanningData({ date, time, durationMinutes: duration, partySize });
      setPlanning(result);
      const preselected = preselectedTableId
        ? result.zones.flatMap((z) => z.tables).find((t) => t.id === preselectedTableId && t.liveState === "available")
        : null;
      if (preselected) {
        setSelectedTableIds(new Set([preselected.id]));
        setActiveZoneId(preselected.zoneId);
      } else {
        const firstSuggestion = result.suggestions[0];
        const firstZone = firstSuggestion
          ? result.zones.find((z) => z.tables.some((t) => t.id === firstSuggestion.tableIds[0]))
          : result.zones[0];
        setActiveZoneId(firstZone?.id ?? result.zones[0]?.id ?? null);
      }
      setStep(2);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible de charger le plan de salle.", "error");
    } finally {
      setLoadingPlanning(false);
    }
  }

  function handleToggleTable(tableId: string) {
    const table = allTables.find((t) => t.id === tableId);
    if (!table) return;
    if (!selectedTableIds.has(tableId) && table.liveState !== "available") {
      toast(`${table.label} n'est pas disponible à cet horaire.`, "error");
      return;
    }
    setSelectedTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }

  function chooseSuggestion(suggestion: TableSuggestion) {
    setSelectedTableIds(new Set(suggestion.tableIds));
    const zone = planning?.zones.find((z) => z.tables.some((t) => t.id === suggestion.tableIds[0]));
    if (zone) setActiveZoneId(zone.id);
  }

  async function handleCreate() {
    setSubmitting(true);
    try {
      await createReservation({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        partySize,
        date,
        time,
        durationMinutes: DURATION_MINUTES,
        spansNextService,
        tableIds: [...selectedTableIds],
        notes: notes.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
        allowOverCapacity: overCapacity,
      });
      toast("Réservation créée");
      setCreatedReservation({ customerName: customerName.trim(), time });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible de créer la réservation.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (createdReservation) {
    return (
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-good">
          <CheckCircle2 size={20} aria-hidden="true" />
          <p className="text-sm font-medium">
            Réservation créée pour {createdReservation.customerName} à {createdReservation.time}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/reservations">Voir les réservations</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/plan-de-salle">Voir le plan de salle</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Étape {step} sur 3</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle réservation</h1>
      </div>

      {step === 1 && (
        <Card className="space-y-4 p-5">
          {formError && (
            <p className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent" role="alert">
              {formError}
            </p>
          )}
          <Field label="Nom du client" value={customerName} onChange={setCustomerName} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone (optionnel)" value={customerPhone} onChange={setCustomerPhone} type="tel" />
            <Field label="Email (optionnel)" value={customerEmail} onChange={setCustomerEmail} type="email" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Personnes" value={String(partySize)} onChange={(v) => setPartySize(Number(v) || 1)} type="number" />
            <Field label="Date" value={date} onChange={setDate} type="date" />
            <Field label="Heure" value={time} onChange={setTime} type="time" />
          </div>
          <SpanNextService
            services={services}
            date={date}
            time={time}
            checked={spansNextService}
            onChange={setSpansNextService}
          />
          <Field label="Demandes particulières (optionnel)" value={specialRequests} onChange={setSpecialRequests} />
          <Field label="Notes internes (optionnel)" value={notes} onChange={setNotes} />
          <Button size="lg" className="w-full" disabled={loadingPlanning} onClick={goToTableStep}>
            {loadingPlanning ? "Recherche des tables…" : "Voir les tables disponibles"}
          </Button>
        </Card>
      )}

      {step === 2 && planning && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {partySize} pers. · {format(new Date(`${date}T00:00:00`), "d MMM")} à {time}
          </p>

          {planning.suggestions.length > 0 && (
            <div className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles size={14} aria-hidden="true" className="text-accent" />
                Suggestions
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {planning.suggestions.slice(0, 4).map((s, i) => {
                  const isSelected =
                    selectedTableIds.size === s.tableIds.length && s.tableIds.every((id) => selectedTableIds.has(id));
                  return (
                    <button
                      key={s.tableIds.join("-")}
                      onClick={() => chooseSuggestion(s)}
                      className={`rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                        isSelected ? "border-accent bg-accent-soft" : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{s.label}</p>
                        {i === 0 && <Badge variant="accent">Recommandé</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.capacity} places</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {planning.zones.length > 0 && activeZone && (
            <div className="space-y-3">
              <ZoneTabs
                zones={planning.zones}
                activeZoneId={activeZone.id}
                canEdit={false}
                onSelect={setActiveZoneId}
                onCreateZone={() => {}}
                onDeleteZone={() => {}}
              />
              <FloorPlanCanvas
                tables={activeZone.tables}
                canEdit={false}
                selectedTableId={null}
                mergeSelection={selectedTableIds}
                onSelectTable={handleToggleTable}
                onMoveTable={() => {}}
                onResizeTable={() => {}}
              />
            </div>
          )}

          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">
                {selectedTables.length === 0
                  ? "Aucune table sélectionnée"
                  : `${selectedTables.map((t) => t.label).join(" + ")} · ${selectedCapacity} places`}
              </p>
              {overCapacity && (
                <p className="text-xs text-important">
                  Conflit de capacité : {selectedCapacity} place{selectedCapacity > 1 ? "s" : ""} pour {partySize} personnes.
                  Tu peux continuer quand même.
                </p>
              )}
            </div>
          </Card>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <ChevronLeft size={15} aria-hidden="true" />
              Retour
            </Button>
            <Button
              className="flex-1"
              disabled={selectedTables.length === 0}
              onClick={() => setStep(3)}
            >
              {overCapacity ? "Continuer quand même" : "Continuer"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Récapitulatif</h2>
          <div className="space-y-2 text-sm">
            <Row label="Client" value={customerName} />
            {customerPhone && <Row label="Téléphone" value={customerPhone} />}
            {customerEmail && <Row label="Email" value={customerEmail} />}
            <Row label="Date" value={format(new Date(`${date}T00:00:00`), "d MMMM yyyy")} />
            <Row label="Heure" value={time} />
            <Row label="Personnes" value={String(partySize)} />
            {spansNextService && <Row label="Services" value="Bloque aussi le service suivant" />}
            <Row label="Table(s)" value={selectedTables.map((t) => t.label).join(" + ")} />
            {overCapacity && (
              <p className="rounded-lg bg-important-soft px-3 py-2 text-sm text-important">
                Capacité dépassée : {selectedCapacity} place{selectedCapacity > 1 ? "s" : ""} pour {partySize} personnes.
              </p>
            )}
            {specialRequests && <Row label="Demandes" value={specialRequests} />}
            {notes && <Row label="Notes" value={notes} />}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={submitting}>
              <ChevronLeft size={15} aria-hidden="true" />
              Retour
            </Button>
            <Button className="flex-1" disabled={submitting} onClick={handleCreate}>
              {submitting ? "Création…" : "Confirmer la réservation"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  const id = `res-field-${label}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
