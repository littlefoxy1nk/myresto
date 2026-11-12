-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "emailConfirmations" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "confirmationEmailSentAt" TIMESTAMP(3);

