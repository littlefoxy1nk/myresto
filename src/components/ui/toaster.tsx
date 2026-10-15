"use client";

import * as Toast from "@radix-ui/react-toast";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { subscribeToToasts, type ToastEvent } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const;
const STYLES = {
  success: "border-good/30 bg-good-soft text-good",
  error: "border-urgent/30 bg-urgent-soft text-urgent",
  info: "border-border bg-card text-foreground",
} as const;

export function Toaster() {
  const [items, setItems] = useState<ToastEvent[]>([]);

  useEffect(() => {
    return subscribeToToasts((event) => {
      setItems((prev) => [...prev, event]);
    });
  }, []);

  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      {items.map((item) => {
        const Icon = ICONS[item.variant];
        return (
          <Toast.Root
            key={item.id}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-pop backdrop-blur transition-all duration-200",
              "data-[state=open]:translate-y-0 data-[state=open]:opacity-100",
              "data-[state=closed]:translate-y-1 data-[state=closed]:opacity-0",
              STYLES[item.variant]
            )}
            onOpenChange={(open) => {
              if (!open) {
                setItems((prev) => prev.filter((i) => i.id !== item.id));
              }
            }}
          >
            <Icon size={16} aria-hidden="true" className="shrink-0" />
            <Toast.Description>{item.message}</Toast.Description>
          </Toast.Root>
        );
      })}
      <Toast.Viewport className="fixed bottom-20 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none md:bottom-6" />
    </Toast.Provider>
  );
}
