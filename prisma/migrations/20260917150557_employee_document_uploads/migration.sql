/*
  Warnings:

  - You are about to drop the column `url` on the `EmployeeDocument` table. All the data in the column will be lost.
  - Added the required column `fileName` to the `EmployeeDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `EmployeeDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `EmployeeDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `EmployeeDocument` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmployeeDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT NOT NULL,
    "timeOffRequestId" TEXT,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeDocument_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeDocument_timeOffRequestId_fkey" FOREIGN KEY ("timeOffRequestId") REFERENCES "TimeOffRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmployeeDocument" ("createdAt", "id", "label", "membershipId") SELECT "createdAt", "id", "label", "membershipId" FROM "EmployeeDocument";
DROP TABLE "EmployeeDocument";
ALTER TABLE "new_EmployeeDocument" RENAME TO "EmployeeDocument";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
