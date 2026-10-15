"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/utils";
import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  monthSeries,
  monthTotals,
  weekdaySeries,
  yearTotals,
  yearsPresent,
  type DayValue,
  type MonthValue,
} from "@/modules/finance/chart-data";

export type Measure = {
  id: string;
  label: string;
  /// cents = montants en centimes (affichés en €) ; count = nombres entiers.
  kind: "cents" | "count";
  days: DayValue[];
  months: MonthValue[];
};

type View = "month" | "weekday" | "year";
const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Par mois" },
  { id: "weekday", label: "Jours de la semaine" },
  { id: "year", label: "Par année" },
];

const W = 640;
const H = 280;
const PAD = { top: 16, right: 56, bottom: 30, left: 52 };
const MAX_YEARS = 8;

function formatValue(v: number, kind: Measure["kind"]) {
  return kind === "cents" ? formatCents(v) : new Intl.NumberFormat("fr-BE").format(v);
}

function formatAxis(v: number, kind: Measure["kind"]) {
  const n = kind === "cents" ? v / 100 : v;
  if (n >= 1000) return `${Math.round((n / 1000) * 10) / 10} k${kind === "cents" ? "€" : ""}`.replace(".", ",");
  return `${Math.round(n)}${kind === "cents" ? " €" : ""}`;
}

/// Graduations rondes (pas de 1, 2 ou 5 × 10^n), 4 à 6 traits : jamais « 12,5 k€ ».
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((st) => st >= rough) ?? 10 * pow;
  const count = Math.ceil(max / step);
  return { top: step * count, ticks: Array.from({ length: count + 1 }, (_, i) => step * i) };
}

type DrawSeries = { key: string; label: string; color: string; points: (number | null)[] };

/// Graphique interactif : un jeu de chiffres (CA, couverts, réservations…) vu par mois, par jour de
/// la semaine ou par année, avec les années superposées — on coche ce qu'on veut afficher.
export function FinanceExplorer({ title, description, measures }: { title: string; description: string; measures: Measure[] }) {
  const [measureId, setMeasureId] = useState(measures[0].id);
  const measure = measures.find((m) => m.id === measureId) ?? measures[0];

  const [view, setView] = useState<View>("month");
  const [hiddenYears, setHiddenYears] = useState<Set<number>>(new Set());
  const [monthsFilter, setMonthsFilter] = useState<Set<number>>(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
  const [weekdayMode, setWeekdayMode] = useState<"avg" | "total">("avg");
  const [showTable, setShowTable] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Couleur = année (jamais son rang à l'écran) : décocher une année ne repeint pas les autres.
  const allYears = useMemo(() => yearsPresent(measure.days, measure.months).slice(-MAX_YEARS), [measure]);
  const colorOf = (year: number) => `var(--series-${allYears.indexOf(year) + 1})`;
  const years = allYears.filter((y) => !hiddenYears.has(y));
  const yearsKey = years.join(",");
  const allYearsKey = allYears.join(",");

  const totals = useMemo(() => monthTotals(measure.days, measure.months), [measure]);

  const { xLabels, series, notes } = useMemo(() => {
    if (view === "month") {
      const s = monthSeries(totals, years);
      return {
        xLabels: [...MONTH_LABELS] as string[],
        series: s.map<DrawSeries>((x) => ({ ...x, color: colorOf(Number(x.key)) })),
        notes: (si: number, xi: number) =>
          totals.get(`${years[si]}-${xi + 1}`)?.source === "month" ? "total du mois" : null,
      };
    }
    if (view === "weekday") {
      const s = weekdaySeries(measure.days, years, monthsFilter, weekdayMode);
      return {
        xLabels: [...WEEKDAY_LABELS] as string[],
        series: s.map<DrawSeries>((x) => ({ ...x, color: colorOf(Number(x.key)) })),
        notes: () => null,
      };
    }
    const t = yearTotals(totals, years);
    return {
      xLabels: t.map((x) => String(x.year)),
      series: [
        {
          key: "year",
          label: "Total",
          color: "var(--series-1)", // les barres prennent la couleur de leur année
          points: t.map((x) => (x.monthsCovered === 0 ? null : x.value)),
        },
      ] as DrawSeries[],
      notes: (_si: number, xi: number) => {
        const covered = t[xi]?.monthsCovered ?? 0;
        return covered < 12 ? `${covered} mois renseigné${covered > 1 ? "s" : ""}` : null;
      },
    };
    // colorOf dépend uniquement de allYears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, totals, yearsKey, monthsFilter, weekdayMode, measure, allYearsKey]);

  const values = series.flatMap((s) => s.points).filter((v): v is number => v !== null);
  const hasData = values.length > 0;
  const { top: yMax, ticks } = niceScale(Math.max(0, ...values));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = xLabels.length;
  const isBars = view === "year";
  const xAt = (i: number) => (isBars ? PAD.left + (innerW / n) * (i + 0.5) : PAD.left + (n === 1 ? innerW / 2 : (innerW / (n - 1)) * i));
  const yAt = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(xAt(i) - x) < Math.abs(xAt(best) - x)) best = i;
    setHoverIndex(best);
  }

  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
      active ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
    );

  const tooltipLeftPct = hoverIndex === null ? 0 : (xAt(hoverIndex) / W) * 100;

  return (
    <section className="viz-root space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label={title}>
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Filtres : une rangée, au-dessus du graphique */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Affichage">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} className={pill(view === v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        {measures.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Mesure">
            {measures.map((m) => (
              <button key={m.id} role="radio" aria-checked={measureId === m.id} onClick={() => setMeasureId(m.id)} className={pill(measureId === m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        )}
        {view === "weekday" && (
          <div className="flex gap-1.5" role="radiogroup" aria-label="Calcul">
            {(["avg", "total"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={weekdayMode === m} onClick={() => setWeekdayMode(m)} className={pill(weekdayMode === m)}>
                {m === "avg" ? "Moyenne par jour" : "Total"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Légende = cases à cocher : on choisit ce qu'on veut voir */}
      {allYears.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={isBars ? "Années affichées" : "Années superposées"}>
          {allYears.map((y) => {
            const on = !hiddenYears.has(y);
            return (
              <button
                key={y}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setHiddenYears((prev) => {
                    const next = new Set(prev);
                    if (next.has(y)) next.delete(y);
                    else next.add(y);
                    return next;
                  })
                }
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  on ? "border-border bg-card" : "border-border bg-muted text-muted-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-4 rounded-full"
                  style={{ background: on ? colorOf(y) : "currentColor", opacity: on ? 1 : 0.4 }}
                />
                {y}
              </button>
            );
          })}
        </div>
      )}

      {view === "weekday" && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Mois pris en compte">
          {MONTH_LABELS.map((label, i) => {
            const month = i + 1;
            const on = monthsFilter.has(month);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setMonthsFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(month)) next.delete(month);
                    else next.add(month);
                    return next;
                  })
                }
                className={cn(
                  "rounded-lg border px-2 py-0.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  on ? "border-accent/50 bg-accent-soft text-accent" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {!hasData ? (
        <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
          {allYears.length === 0
            ? "Pas encore de chiffres : ils apparaissent ici dès qu'il y en a."
            : "Rien à afficher avec cette sélection : coche au moins une année (et un mois)."}
        </p>
      ) : showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-2 py-1.5 text-left font-medium text-muted-foreground" />
                {series.map((s) => (
                  <th key={s.key} className="border-b border-border px-2 py-1.5 text-right font-medium text-muted-foreground">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xLabels.map((x, xi) => (
                <tr key={x} className="odd:bg-muted/40">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal text-muted-foreground">
                    {x}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="px-2 py-1.5 text-right tabular-nums">
                      {s.points[xi] === null ? "—" : formatValue(s.points[xi] as number, measure.kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
            role="img"
            aria-label={`${title}, ${VIEWS.find((v) => v.id === view)?.label.toLowerCase()}`}
            tabIndex={0}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHoverIndex(null)}
            onBlur={() => setHoverIndex(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setHoverIndex((i) => Math.min(n - 1, (i ?? -1) + 1));
              else if (e.key === "ArrowLeft") setHoverIndex((i) => Math.max(0, (i ?? n) - 1));
              else if (e.key === "Escape") setHoverIndex(null);
            }}
          >
            {/* Grille et axes : discrets */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--border)" strokeWidth={1} />
                <text x={PAD.left - 8} y={yAt(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
                  {formatAxis(t, measure.kind)}
                </text>
              </g>
            ))}
            {xLabels.map((x, i) => (
              <text key={x} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
                {x}
              </text>
            ))}

            {hoverIndex !== null && !isBars && (
              <line x1={xAt(hoverIndex)} x2={xAt(hoverIndex)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" />
            )}

            {isBars
              ? series[0].points.map((v, i) => {
                  if (v === null) return null;
                  const bw = Math.min(56, (innerW / n) * 0.6);
                  const h = Math.max(2, PAD.top + innerH - yAt(v));
                  const active = hoverIndex === i;
                  return (
                    <rect
                      key={i}
                      x={xAt(i) - bw / 2}
                      y={yAt(v)}
                      width={bw}
                      height={h}
                      rx={4}
                      fill={colorOf(years[i] ?? years[0])}
                      opacity={hoverIndex === null || active ? 1 : 0.55}
                    />
                  );
                })
              : series.map((s) => {
                  // La courbe s'interrompt sur les valeurs manquantes (jamais de pont inventé).
                  const segments: string[] = [];
                  let current = "";
                  s.points.forEach((v, i) => {
                    if (v === null) {
                      if (current) segments.push(current);
                      current = "";
                    } else {
                      current += `${current ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `;
                    }
                  });
                  if (current) segments.push(current);
                  const lastIdx = s.points.map((v) => v !== null).lastIndexOf(true);
                  return (
                    <g key={s.key}>
                      {segments.map((d, i) => (
                        <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      ))}
                      {s.points.map((v, i) =>
                        v === null ? null : (
                          <circle
                            key={i}
                            cx={xAt(i)}
                            cy={yAt(v)}
                            r={hoverIndex === i ? 5 : 4}
                            fill={s.color}
                            stroke="var(--card)"
                            strokeWidth={2}
                          />
                        )
                      )}
                      {/* Étiquette directe au bout de la courbe (≤ 4 courbes) */}
                      {series.length <= 4 && lastIdx >= 0 && (
                        <text x={xAt(lastIdx) + 9} y={yAt(s.points[lastIdx] as number) + 4} fontSize={11} fontWeight={600} fill="var(--foreground)">
                          {s.label}
                        </text>
                      )}
                    </g>
                  );
                })}

            {/* Zones de survol : plus larges que les marques */}
            {hoverIndex !== null && isBars && (
              <rect x={xAt(hoverIndex) - innerW / n / 2} y={PAD.top} width={innerW / n} height={innerH} fill="transparent" />
            )}
          </svg>

          {hoverIndex !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"
              style={{ left: `${tooltipLeftPct}%`, transform: tooltipLeftPct > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
            >
              <p className="mb-1 font-medium text-muted-foreground">{xLabels[hoverIndex]}</p>
              {series.map((s, si) => {
                const v = s.points[hoverIndex];
                if (v === null) return null;
                const note = notes(si, hoverIndex);
                return (
                  <p key={s.key} className="flex items-center gap-2">
                    <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                    <span className="text-sm font-semibold tabular-nums">{formatValue(v, measure.kind)}</span>
                    <span className="text-muted-foreground">
                      {s.label}
                      {note ? ` · ${note}` : ""}
                    </span>
                  </p>
                );
              })}
            </div>
          )}
        </div>
      )}

      {hasData && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {view === "weekday"
              ? "Calculé sur les jours saisis uniquement : un total de mois n'a pas de jour de semaine."
              : view === "year"
                ? "Une année partielle (peu de mois renseignés) ne se compare pas à une année complète."
                : "Un mois sans chiffre laisse la courbe interrompue."}
          </span>
          <button type="button" onClick={() => setShowTable((v) => !v)} className="font-medium text-accent underline-offset-2 hover:underline">
            {showTable ? "Voir le graphique" : "Voir en tableau"}
          </button>
        </div>
      )}
    </section>
  );
}
