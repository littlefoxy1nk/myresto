/*
  Warnings:

  - You are about to drop the `EditorialLine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `comments` on the `MarketingPost` table. All the data in the column will be lost.
  - You are about to drop the column `editorialLineId` on the `MarketingPost` table. All the data in the column will be lost.
  - You are about to drop the column `likes` on the `MarketingPost` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAt` on the `MarketingPost` table. All the data in the column will be lost.
  - You are about to drop the column `reach` on the `MarketingPost` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `MarketingPost` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EditorialLine";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MarketingPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaNote" TEXT,
    "channel" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingPost_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MarketingPost" ("aiGenerated", "campaignId", "channel", "content", "createdAt", "establishmentId", "id", "mediaNote", "scheduledFor", "status", "title", "updatedAt") SELECT "aiGenerated", "campaignId", "channel", "content", "createdAt", "establishmentId", "id", "mediaNote", "scheduledFor", "status", "title", "updatedAt" FROM "MarketingPost";
DROP TABLE "MarketingPost";
ALTER TABLE "new_MarketingPost" RENAME TO "MarketingPost";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
