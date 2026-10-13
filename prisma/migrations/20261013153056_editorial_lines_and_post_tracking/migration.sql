-- CreateTable
CREATE TABLE "EditorialLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" TEXT,
    "tone" TEXT,
    "themes" TEXT,
    "avoid" TEXT,
    "hashtags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EditorialLine_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "subject" TEXT,
    "editorialLineId" TEXT,
    "publishedAt" DATETIME,
    "likes" INTEGER,
    "comments" INTEGER,
    "reach" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingPost_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketingPost_editorialLineId_fkey" FOREIGN KEY ("editorialLineId") REFERENCES "EditorialLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MarketingPost" ("aiGenerated", "campaignId", "channel", "content", "createdAt", "establishmentId", "id", "mediaNote", "scheduledFor", "status", "title", "updatedAt") SELECT "aiGenerated", "campaignId", "channel", "content", "createdAt", "establishmentId", "id", "mediaNote", "scheduledFor", "status", "title", "updatedAt" FROM "MarketingPost";
DROP TABLE "MarketingPost";
ALTER TABLE "new_MarketingPost" RENAME TO "MarketingPost";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
