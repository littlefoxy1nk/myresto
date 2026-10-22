import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MYRESTO",
  description: "Le copilote du restaurateur.",
  applicationName: "MYRESTO",
  // iPhone : l'appli ajoutée à l'écran d'accueil s'ouvre en plein écran, avec sa propre icône.
  appleWebApp: { capable: true, title: "MYRESTO", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#14100d" },
  ],
  // Utilise tout l'écran (jusqu'aux bords de l'iPhone) ; les barres du bas et du haut gèrent les zones à éviter.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Toutes les pages sont générées à chaque requête : c'est ce qui permet à chacune de recevoir son « nonce » de sécurité (voir proxy.ts).
  await connection();
  return (
    <html lang="fr" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
