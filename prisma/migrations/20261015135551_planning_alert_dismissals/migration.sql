-- CreateTable
CREATE TABLE "PlanningAlertDismissal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanningAlertDismissal_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanningAlertDismissal_membershipId_weekStart_alertKey_key" ON "PlanningAlertDismissal"("membershipId", "weekStart", "alertKey");
