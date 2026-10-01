-- CreateTable
CREATE TABLE "CoverageRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "establishmentId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "serviceId" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoverageRequest_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoverageRequest_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoverageRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Membership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoverageRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
