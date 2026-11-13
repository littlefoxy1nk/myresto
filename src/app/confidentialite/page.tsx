import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/nav/brand-mark";
import { DEFAULT_SUPPORT_EMAIL } from "@/modules/settings/contact";

export const metadata: Metadata = { title: "Confidentialité" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

const items = "list-disc space-y-1 pl-5";

/// Ce qui est fait des données, dit simplement et sans rien promettre qu'on ne fait pas. Page publique (sans connexion) : elle est
/// liée depuis le formulaire de réservation et les écrans de connexion.
export default function ConfidentialitePage() {
  const contact = process.env.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="page-in mx-auto max-w-2xl space-y-8">
        <header className="flex items-center gap-3">
          <BrandMark name="M" className="h-11 w-11 text-lg" />
          <div>
            <p className="text-lg font-bold tracking-tight">MYRESTO</p>
            <p className="text-xs text-muted-foreground">Confidentialité et protection des données</p>
          </div>
        </header>

        <div className="space-y-7 rounded-3xl border border-border/70 bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight">Vos données, en clair</h1>

          <Section title="Qui décide de quoi">
            <p>
              Quand vous réservez une table, c&apos;est <strong>le restaurant</strong> qui décide de l&apos;usage de vos informations : il est responsable
              de leur traitement. MYRESTO est l&apos;outil de gestion qu&apos;il utilise. MYRESTO conserve ces informations pour lui, ne les revend
              jamais et ne s&apos;en sert pas pour ses propres envois.
            </p>
          </Section>

          <Section title="Ce que nous recevons quand vous réservez">
            <ul className={items}>
              <li>Votre prénom, votre nom et votre GSM (obligatoires).</li>
              <li>Votre email (facultatif).</li>
              <li>La date, l&apos;heure, le nombre de personnes et votre remarque éventuelle (allergie, occasion spéciale…).</li>
            </ul>
            <p>
              Pour éviter les envois abusifs, le nombre de demandes envoyées depuis une même adresse est limité. Cette vérification se fait en mémoire et
              n&apos;est pas enregistrée avec votre réservation.
            </p>
          </Section>

          <Section title="À quoi cela sert">
            <ul className={items}>
              <li>Gérer votre réservation et vous joindre en cas de souci.</li>
              <li>
                Vous envoyer une confirmation quand le restaurant confirme votre demande : par email si vous avez laissé votre adresse, sinon par un SMS que le
                restaurant vous écrit depuis son propre téléphone.
              </li>
              <li>
                Vous envoyer les actualités du restaurant <strong>uniquement si vous avez coché la case prévue</strong>. Chaque email contient un lien pour
                vous désinscrire à tout moment.
              </li>
            </ul>
            <p>Il n&apos;y a ni publicité, ni outil de suivi, ni cookie sur la page de réservation.</p>
          </Section>

          <Section title="Qui peut voir vos informations">
            <ul className={items}>
              <li>L&apos;équipe du restaurant, selon les droits que son responsable lui a donnés.</li>
              <li>
                L&apos;équipe MYRESTO, uniquement pour aider le restaurant à la demande de celui-ci. Chaque entrée dans un établissement est notée dans
                son journal.
              </li>
              <li>Les prestataires techniques qui font fonctionner le service : hébergement, base de données, envoi d&apos;emails.</li>
            </ul>
          </Section>

          <Section title="Combien de temps">
            <p>
              Le restaurant garde vos informations le temps nécessaire à la gestion de ses réservations. Lorsqu&apos;il ferme son établissement dans MYRESTO,
              toutes les données (réservations, clients, équipe) sont supprimées définitivement.
            </p>
          </Section>

          <Section title="Vos droits">
            <p>
              Vous pouvez demander à voir, corriger ou effacer vos informations, ou vous opposer à leur usage. Adressez-vous d&apos;abord au restaurant
              concerné. Vous pouvez aussi nous écrire à <a className="font-semibold text-accent underline-offset-4 hover:underline" href={`mailto:${contact}`}>{contact}</a> : nous
              transmettons votre demande au restaurant et l&apos;aidons à y répondre.
            </p>
            <p>
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une plainte auprès de l&apos;Autorité de protection des données
              (autoriteprotectiondonnees.be).
            </p>
          </Section>

          <Section title="Pour les équipes des restaurants">
            <p>
              Les comptes de connexion utilisent un cookie nécessaire au fonctionnement (rester connecté). Rien d&apos;autre n&apos;est déposé sur votre
              appareil. Les données de votre établissement ne sont visibles que par vous et votre équipe : chaque établissement est strictement séparé des autres.
            </p>
          </Section>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">
            Retour à MYRESTO
          </Link>
        </p>
      </div>
    </div>
  );
}
