"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { searchPalette, type PaletteEntry } from "@/lib/palette-search";

/// Palette de commandes : ⌘K (ou Ctrl+K) pour aller n'importe où ou lancer une action courante,
/// sans passer par le menu. Rien de « malin » : une recherche de texte sur les pages que la
/// personne a le droit de voir.
export function CommandPalette({ entries }: { entries: PaletteEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchPalette(entries, query), [entries, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor, results]);

  function go(entry: PaletteEntry | undefined) {
    if (!entry) return;
    setOpen(false);
    router.push(entry.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    }
  }

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setCursor(0);
        }
      }}
    >
      <RadixDialog.Trigger asChild>
        <button
          type="button"
          aria-label="Rechercher une page ou une action"
          className={cn(
            "group flex h-10 w-10 items-center justify-center gap-2.5 rounded-full border border-border/70 bg-card/70 text-sm text-muted-foreground shadow-sm backdrop-blur outline-none transition-all",
            "hover:bg-card hover:shadow-card focus-visible:ring-2 focus-visible:ring-accent md:w-72 md:justify-start md:px-3.5"
          )}
        >
          <Icons.Search size={16} aria-hidden="true" />
          <span className="hidden flex-1 text-left md:inline">Aller à…</span>
          <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground md:inline">
            ⌘K
          </kbd>
        </button>
      </RadixDialog.Trigger>

      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#14100d]/40 backdrop-blur-sm" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="dialog-drop fixed left-1/2 top-[14%] z-50 w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-card shadow-pop outline-none"
        >
          <RadixDialog.Title className="sr-only">Aller à une page ou une action</RadixDialog.Title>
          <div className="flex items-center gap-3 border-b border-border px-5">
            <Icons.Search size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={onInputKey}
              placeholder="Aller à une page, créer…"
              className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              aria-label="Rechercher"
              aria-controls="palette-results"
              role="combobox"
              aria-expanded="true"
            />
            <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground">Échap</kbd>
          </div>
          <ul id="palette-results" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Rien ne correspond à « {query} ».</li>}
            {results.map((entry, i) => {
              const Icon = Icons[entry.icon as keyof typeof Icons] as Icons.LucideIcon;
              const active = i === cursor;
              return (
                <li key={entry.href + entry.label} role="option" aria-selected={active} data-active={active}>
                  <button
                    type="button"
                    onClick={() => go(entry)}
                    onMouseMove={() => setCursor(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors",
                      active ? "bg-accent-soft text-accent" : "text-foreground"
                    )}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl", active ? "bg-card" : "bg-muted")}>
                      {Icon && <Icon size={16} aria-hidden="true" />}
                    </span>
                    <span className="flex-1">{entry.label}</span>
                    {entry.hint && <span className="text-xs font-normal text-muted-foreground">{entry.hint}</span>}
                    {active && <Icons.CornerDownLeft size={14} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
