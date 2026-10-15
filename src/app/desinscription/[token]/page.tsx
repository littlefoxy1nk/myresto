import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BrandMark } from "@/components/nav/brand-mark";
import { UnsubscribeForm } from "@/modules/newsletter/components/unsubscribe-form";

export const metadata: Metadata = { title: "Se désinscrire", robots: { index: false } };

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();
  const customer = await prisma.customer.findUnique({
    where: { unsubscribeToken: token },
    include: { establishment: { select: { name: true } } },
  });
  if (!customer) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <BrandMark name={customer.establishment.name} className="mx-auto mb-6 h-14 w-14 text-2xl" />
      <UnsubscribeForm token={token} restaurantName={customer.establishment.name} alreadyUnsubscribed={!customer.newsletterConsent} />
    </main>
  );
}
