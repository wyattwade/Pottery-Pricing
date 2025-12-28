-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PricingMatrix" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "minCost" REAL NOT NULL,
    "maxCost" REAL NOT NULL,
    "multiplier" REAL NOT NULL,
    "userId" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "PricingMatrix_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PricingMatrix" ("id", "maxCost", "minCost", "multiplier") SELECT "id", "maxCost", "minCost", "multiplier" FROM "PricingMatrix";
DROP TABLE "PricingMatrix";
ALTER TABLE "new_PricingMatrix" RENAME TO "PricingMatrix";
CREATE TABLE "new_Rule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PERCENTAGE_ADD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Rule" ("id", "isActive", "name", "type", "value") SELECT "id", "isActive", "name", "type", "value" FROM "Rule";
DROP TABLE "Rule";
ALTER TABLE "new_Rule" RENAME TO "Rule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
