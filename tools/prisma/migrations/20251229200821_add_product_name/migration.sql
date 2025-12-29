-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "vendorId" INTEGER NOT NULL DEFAULT 1,
    "vendorName" TEXT NOT NULL DEFAULT 'chesapeake',
    "name" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Product" ("id", "price", "sku", "vendorId", "vendorName") SELECT "id", "price", "sku", "vendorId", "vendorName" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
