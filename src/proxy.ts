import { NextResponse, type NextRequest } from "next/server";

/// Chaque réponse part avec ses en-têtes de sécurité, et un « nonce » (un code à usage unique) autorise uniquement les
/// scripts de l'appli : une page piégée ne pourrait pas en faire exécuter d'autres. Voir
/// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  // HTTPS imposé en production, sauf pour un essai local (APP_URL en http://localhost…) où il n'y a pas de HTTPS.
  const forceHttps = !isDev && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(process.env.APP_URL ?? "");

  const csp = [
    "default-src 'self'",
    // Les scripts : seulement ceux de l'appli (nonce). 'unsafe-eval' seulement en développement (React en a besoin pour ses messages d'erreur).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Les styles en ligne sont nécessaires (positions du plan de salle, largeurs…) ; ils ne peuvent pas exécuter de code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    // Le service worker (page « Pas de connexion ») et le manifeste d'installation viennent uniquement de l'appli.
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(forceHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (forceHttps) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques de Next et les préchargements de liens.
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
