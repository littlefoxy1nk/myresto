-- CreateTable
CREATE TABLE "PlanningNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "time" TEXT,
    "message" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanningNote_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanningNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Membership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
