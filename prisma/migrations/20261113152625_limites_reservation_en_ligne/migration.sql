-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "onlineMaxDaysAhead" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "onlineMaxPartySize" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "onlineMinLeadMinutes" INTEGER NOT NULL DEFAULT 90;

-- AlterTable
ALTER TABLE "ServiceDefinition" ADD COLUMN     "onlineClosedTimes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "onlineEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onlineMaxCovers" INTEGER;

