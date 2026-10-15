-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarJson" TEXT;

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "emailedAt" DATETIME,
    "emailError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactMessage_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "googleReviewUrl" TEXT,
    "tripadvisorReviewUrl" TEXT,
    "disabledModules" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Establishment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Establishment" ("address", "bookingSlug", "city", "companyId", "country", "createdAt", "currency", "googleReviewUrl", "id", "isDemo", "name", "onboardedAt", "onlineBookingEnabled", "postalCode", "timezone", "tripadvisorReviewUrl", "type", "updatedAt") SELECT "address", "bookingSlug", "city", "companyId", "country", "createdAt", "currency", "googleReviewUrl", "id", "isDemo", "name", "onboardedAt", "onlineBookingEnabled", "postalCode", "timezone", "tripadvisorReviewUrl", "type", "updatedAt" FROM "Establishment";
DROP TABLE "Establishment";
ALTER TABLE "new_Establishment" RENAME TO "Establishment";
CREATE UNIQUE INDEX "Establishment_bookingSlug_key" ON "Establishment"("bookingSlug");
CREATE TABLE "new_Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mutedNotificationCategories" TEXT NOT NULL DEFAULT '',
    "employmentType" TEXT NOT NULL DEFAULT 'fixe',
    "jobTitle" TEXT,
    "hiredAt" DATETIME,
    "weeklyHoursTarget" REAL,
    "maxShiftsPerWeek" INTEGER,
    "skills" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Membership" ("createdAt", "employmentType", "establishmentId", "hiredAt", "id", "jobTitle", "maxShiftsPerWeek", "notes", "roleId", "skills", "status", "updatedAt", "userId", "weeklyHoursTarget") SELECT "createdAt", "employmentType", "establishmentId", "hiredAt", "id", "jobTitle", "maxShiftsPerWeek", "notes", "roleId", "skills", "status", "updatedAt", "userId", "weeklyHoursTarget" FROM "Membership";
DROP TABLE "Membership";
ALTER TABLE "new_Membership" RENAME TO "Membership";
CREATE UNIQUE INDEX "Membership_userId_establishmentId_key" ON "Membership"("userId", "establishmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
