"use client";

import { usePathname } from "next/navigation";

/// Chaque changement de page se fait en fondu doux : le contenu glisse légèrement vers le haut.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-in">
      {children}
    </div>
  );
}
