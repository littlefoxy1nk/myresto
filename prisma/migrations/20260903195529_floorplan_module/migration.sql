/*
  Warnings:

  - You are about to drop the `TableMerge` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TableMerge";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "TableGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "label" TEXT,
    "combinedCapacity" INTEGER NOT NULL,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "activeFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TableGroup_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TableGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    CONSTRAINT "TableGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TableGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TableGroupMember_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'salle',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Zone_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Zone" ("establishmentId", "id", "name", "sortOrder") SELECT "establishmentId", "id", "name", "sortOrder" FROM "Zone";
DROP TABLE "Zone";
ALTER TABLE "new_Zone" RENAME TO "Zone";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TableGroupMember_groupId_tableId_key" ON "TableGroupMember"("groupId", "tableId");
