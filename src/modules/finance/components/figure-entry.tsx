"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCents } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { getMonthFigures, saveDayFigures, saveMonthFigure, type MonthFiguresData } from "@/modules/finance/server/actions";
import { MONTH_LABELS, WEEKDAY_LABELS } from "@/modules/finance/chart-data";

const field =
  "w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-sm tabular-nums outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

/// "1234,5" → 123450 ; vide → null ; invalide → undefined.
function parseEuros(text: string): number | null | undefined {
  const t = text.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

function parseCount(text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

type Tab = "days" | "month";

/// Saisie des chiffres : jour par jour pour un mois (grille), ou le total d'un mois entier.
export function FigureEntry({ initialYear, initialMonth }: { initialYear: number; initialMonth: number }) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [tab, setTab] = useState<Tab>("days");
  const [loaded, setLoaded] = useState<{ key: string; data: MonthFiguresData } | null>(null);
  const key = `${year}-${month}`;

  useEffect(() => {
    let cancelled = false;
    getMonthFigures(year, month)
      .then((data) => !cancelled && setLoaded({ key, data }))
      .catch(() => !cancelled && toast("Impossible de charger ce mois.", "error"));
    return () => {
      cancelled = true;
    };
  }, [year, month, key]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
      active ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
    );
  const arrow =
    "rounded-lg p-2 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

  const ready = loaded?.key === key;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Saisie des chiffres">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Saisie des chiffres</h2>
        <p className="text-xs text-muted-foreground">
          Renseigne les jours d&apos;un mois, ou directement le total du mois. Un champ vide = rien de saisi.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} className={arrow}>
            <ChevronLeft size={16} aria-hidden="true" />
            <span className="sr-only">Mois précédent</span>
          </button>
          <select
            aria-label="Mois"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-2xl border border-border bg-card/80 px-3 py-1.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
          >
            {MONTH_LABELS.map((l, i) => (
              <option key={l} value={i + 1}>
                {l}
              </option>
            ))}
          </select>
          <input
            aria-label="Année"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => Number(e.target.value) >= 2000 && setYear(Number(e.target.value))}
            className="w-24 rounded-2xl border border-border bg-card/80 px-3 py-1.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
          />
          <button type="button" onClick={() => shiftMonth(1)} className={arrow}>
            <ChevronRight size={16} aria-hidden="true" />
            <span className="sr-only">Mois suivant</span>
          </button>
        </div>
        <div className="flex gap-1.5" role="tablist">
          <button role="tab" aria-selected={tab === "days"} onClick={() => setTab("days")} className={pill(tab === "days")}>
            Jour par jour
          </button>
          <button role="tab" aria-selected={tab === "month"} onClick={() => setTab("month")} className={pill(tab === "month")}>
            Total du mois
          </button>
        </div>
      </div>

      {!ready ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
      ) : tab === "days" ? (
        <DaysGrid key={key} year={year} month={month} data={loaded.data} reload={() => getMonthFigures(year, month).then((data) => setLoaded({ key, data }))} />
      ) : (
        <MonthTotalForm key={key} year={year} month={month} data={loaded.data} reload={() => getMonthFigures(year, month).then((data) => setLoaded({ key, data }))} />
      )}
    </section>
  );
}

function DaysGrid({
  year,
  month,
  data,
  reload,
}: {
  year: number;
  month: number;
  data: MonthFiguresData;
  reload: () => Promise<void>;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = useMemo(() => new Map(data.days.map((d) => [d.date, d])), [data]);
  const dateKey = (day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const [rev, setRev] = useState<string[]>(() =>
    Array.from({ length: daysInMonth }, (_, i) => {
      const e = byDate.get(dateKey(i + 1));
      return e?.revenueCents != null ? String(e.revenueCents / 100).replace(".", ",") : "";
    })
  );
  const [cov, setCov] = useState<string[]>(() =>
    Array.from({ length: daysInMonth }, (_, i) => {
      const e = byDate.get(dateKey(i + 1));
      return e?.covers ? String(e.covers) : "";
    })
  );
  const [pending, setPending] = useState(false);

  const sumRevenue = rev.reduce((s, t) => s + (parseEuros(t) ?? 0), 0);
  const sumCovers = cov.reduce((s, t) => s + (parseCount(t) ?? 0), 0);
  const filled = rev.filter((t, i) => t.trim() !== "" || cov[i].trim() !== "").length;

  async function save() {
    const entries = [];
    for (let i = 0; i < daysInMonth; i++) {
      const revenueCents = parseEuros(rev[i]);
      const covers = parseCount(cov[i]);
      if (revenueCents === undefined || covers === undefined) {
        toast(`Jour ${i + 1} : valeur invalide.`, "error");
        return;
      }
      entries.push({ date: dateKey(i + 1), revenueCents, covers });
    }
    setPending(true);
    try {
      await saveDayFigures({ entries });
      await reload();
      toast("Chiffres enregistrés");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[5.5rem_1fr_7rem] items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Jour</span>
        <span className="text-xs font-medium text-muted-foreground">CA (€)</span>
        <span className="text-xs font-medium text-muted-foreground">Couverts</span>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(year, month - 1, i + 1);
          const wd = (d.getDay() + 6) % 7;
          return (
            <div key={i} className="contents">
              <label htmlFor={`rev-${i}`} className={cn("tabular-nums", wd >= 4 ? "font-medium" : "text-muted-foreground")}>
                {WEEKDAY_LABELS[wd]} {i + 1}
              </label>
              <input
                id={`rev-${i}`}
                inputMode="decimal"
                value={rev[i]}
                onChange={(e) => setRev((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                className={field}
                placeholder="—"
              />
              <input
                aria-label={`Couverts du ${i + 1}`}
                inputMode="numeric"
                value={cov[i]}
                onChange={(e) => setCov((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                className={field}
                placeholder="—"
              />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">
          {filled} jour{filled > 1 ? "s" : ""} saisi{filled > 1 ? "s" : ""} · <span className="font-medium text-foreground">{formatCents(sumRevenue)}</span> ·{" "}
          {sumCovers} couverts
          {data.month && <span> · total du mois saisi : {formatCents(data.month.revenueCents)} (il prime sur la somme des jours)</span>}
        </p>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le mois"}
        </Button>
      </div>
    </div>
  );
}

function MonthTotalForm({
  year,
  month,
  data,
  reload,
}: {
  year: number;
  month: number;
  data: MonthFiguresData;
  reload: () => Promise<void>;
}) {
  const [rev, setRev] = useState(data.month ? String(data.month.revenueCents / 100).replace(".", ",") : "");
  const [cov, setCov] = useState(data.month?.covers ? String(data.month.covers) : "");
  const [pending, setPending] = useState(false);
  const daysSum = data.days.reduce((s, d) => s + (d.revenueCents ?? 0), 0);

  async function save() {
    const revenueCents = parseEuros(rev);
    const covers = parseCount(cov);
    if (revenueCents === undefined || covers === undefined) {
      toast("Valeur invalide.", "error");
      return;
    }
    setPending(true);
    try {
      await saveMonthFigure({ year, month, revenueCents, covers });
      await reload();
      toast(revenueCents === null && covers === null ? "Total du mois retiré" : "Total du mois enregistré");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="month-revenue" className="text-sm font-semibold">
            CA du mois (€)
          </label>
          <input id="month-revenue" inputMode="decimal" value={rev} onChange={(e) => setRev(e.target.value)} className={field} placeholder="ex : 42 500" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="month-covers" className="text-sm font-semibold">
            Couverts du mois (facultatif)
          </label>
          <input id="month-covers" inputMode="numeric" value={cov} onChange={(e) => setCov(e.target.value)} className={field} placeholder="ex : 1 850" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Le total du mois prime sur la somme des jours saisis (les jours restent utiles pour le graphique « jours de la semaine »).
        {data.days.length > 0 && ` Somme des jours déjà saisis : ${formatCents(daysSum)}.`} Laisse vide et enregistre pour retirer le total.
      </p>
      <Button size="sm" onClick={save} disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le total"}
      </Button>
    </div>
  );
}
