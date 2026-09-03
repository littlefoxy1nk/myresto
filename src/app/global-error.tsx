"use client";

// Filet de sécurité pour une erreur dans le layout racine lui-même (rare). Doit fournir
// son propre <html>/<body> puisqu'il remplace tout ce que le layout racine aurait rendu.
export default function GlobalRootErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ background: "#faf8f5", color: "#1c1917", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "1rem",
          }}
        >
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Une erreur est survenue</h1>
          <p style={{ marginTop: "0.5rem", color: "#78716c", maxWidth: "24rem" }}>
            L&apos;application n&apos;a pas pu se charger correctement.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              background: "#b5651d",
              color: "#fffaf3",
              border: "none",
              borderRadius: "0.75rem",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
