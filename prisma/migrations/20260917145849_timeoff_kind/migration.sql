-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimeOffRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'conge',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeOffRequest_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeOffRequest_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TimeOffRequest" ("createdAt", "endDate", "establishmentId", "id", "membershipId", "reason", "reviewNote", "reviewedById", "startDate", "status", "updatedAt") SELECT "createdAt", "endDate", "establishmentId", "id", "membershipId", "reason", "reviewNote", "reviewedById", "startDate", "status", "updatedAt" FROM "TimeOffRequest";
DROP TABLE "TimeOffRequest";
ALTER TABLE "new_TimeOffRequest" RENAME TO "TimeOffRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
