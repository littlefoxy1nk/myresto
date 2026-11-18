-- Les réservations notées à la main (téléphone, comptoir) sont déjà confirmées : seules les demandes en ligne attendent une confirmation.
-- On met à jour celles qui étaient restées « Nouvelle » ; aucun message n'est envoyé au client.
UPDATE "Reservation"
SET "status" = 'confirmed', "confirmationState" = 'confirmed'
WHERE "source" <> 'online' AND "status" = 'new';
