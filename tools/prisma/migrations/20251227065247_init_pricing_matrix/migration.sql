-- CreateTable
CREATE TABLE "PricingMatrix" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "minCost" REAL NOT NULL,
    "maxCost" REAL NOT NULL,
    "multiplier" REAL NOT NULL
);
