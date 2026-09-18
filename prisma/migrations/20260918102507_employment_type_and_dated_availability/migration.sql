-- AlterTable
ALTER TABLE "Availability" ADD COLUMN "date" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
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
INSERT INTO "new_Membership" ("createdAt", "establishmentId", "hiredAt", "id", "jobTitle", "maxShiftsPerWeek", "notes", "roleId", "skills", "status", "updatedAt", "userId", "weeklyHoursTarget") SELECT "createdAt", "establishmentId", "hiredAt", "id", "jobTitle", "maxShiftsPerWeek", "notes", "roleId", "skills", "status", "updatedAt", "userId", "weeklyHoursTarget" FROM "Membership";
DROP TABLE "Membership";
ALTER TABLE "new_Membership" RENAME TO "Membership";
CREATE UNIQUE INDEX "Membership_userId_establishmentId_key" ON "Membership"("userId", "establishmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
