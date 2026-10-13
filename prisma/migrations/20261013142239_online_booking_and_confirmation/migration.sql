-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Establishment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "onboardedAt" DATETIME,
    "bookingSlug" TEXT,
    "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Establishment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Establishment" ("address", "city", "companyId", "country", "createdAt", "currency", "id", "isDemo", "name", "onboardedAt", "postalCode", "timezone", "type", "updatedAt") SELECT "address", "city", "companyId", "country", "createdAt", "currency", "id", "isDemo", "name", "onboardedAt", "postalCode", "timezone", "type", "updatedAt" FROM "Establishment";
DROP TABLE "Establishment";
ALTER TABLE "new_Establishment" RENAME TO "Establishment";
CREATE UNIQUE INDEX "Establishment_bookingSlug_key" ON "Establishment"("bookingSlug");
CREATE TABLE "new_Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "serviceId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "partySize" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "time" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 90,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "specialRequests" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "spansNextService" BOOLEAN NOT NULL DEFAULT false,
    "confirmationState" TEXT NOT NULL DEFAULT 'none',
    "confirmationAskedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Reservation" ("createdAt", "customerEmail", "customerId", "customerName", "customerPhone", "date", "durationMinutes", "establishmentId", "id", "notes", "partySize", "serviceId", "source", "specialRequests", "status", "time", "updatedAt") SELECT "createdAt", "customerEmail", "customerId", "customerName", "customerPhone", "date", "durationMinutes", "establishmentId", "id", "notes", "partySize", "serviceId", "source", "specialRequests", "status", "time", "updatedAt" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
