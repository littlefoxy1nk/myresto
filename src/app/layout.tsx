import type { Metadata } from "next";
import { connection } from "next/server";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MYRESTO",
  description: "Le copilote du restaurateur.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Toutes les pages sont générées à chaque requête : c'est ce qui permet à chacune de recevoir son « nonce » de sécurité (voir proxy.ts).
  await connection();
  return (
    <html lang="fr" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
