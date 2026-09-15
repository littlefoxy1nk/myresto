-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "birthday" DATETIME,
    "preferences" TEXT,
    "allergies" TEXT,
    "notes" TEXT,
    "favoriteTableId" TEXT,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpentCents" INTEGER NOT NULL DEFAULT 0,
    "lastVisitAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Customer_favoriteTableId_fkey" FOREIGN KEY ("favoriteTableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("allergies", "birthday", "createdAt", "email", "establishmentId", "favoriteTableId", "firstName", "id", "lastName", "lastVisitAt", "notes", "phone", "preferences", "totalSpentCents", "updatedAt", "visitCount") SELECT "allergies", "birthday", "createdAt", "email", "establishmentId", "favoriteTableId", "firstName", "id", "lastName", "lastVisitAt", "notes", "phone", "preferences", "totalSpentCents", "updatedAt", "visitCount" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
