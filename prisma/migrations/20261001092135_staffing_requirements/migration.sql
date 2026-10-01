-- CreateTable
CREATE TABLE "StaffingRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffingRequirement_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffingRequirement_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffingRequirement_establishmentId_dayOfWeek_serviceId_position_key" ON "StaffingRequirement"("establishmentId", "dayOfWeek", "serviceId", "position");
