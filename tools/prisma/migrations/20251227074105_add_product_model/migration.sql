-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "vendorId" INTEGER NOT NULL DEFAULT 1,
    "vendorName" TEXT NOT NULL DEFAULT 'chesapeake'
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
