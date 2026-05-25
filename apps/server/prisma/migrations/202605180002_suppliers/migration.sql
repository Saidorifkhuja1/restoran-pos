-- Create suppliers table for restaurant-level vendor management.
CREATE TABLE "suppliers" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "contactPerson" TEXT,
  "category" TEXT,
  "note" TEXT,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suppliers_restaurantId_name_key" ON "suppliers"("restaurantId", "name");
CREATE INDEX "suppliers_restaurantId_idx" ON "suppliers"("restaurantId");
CREATE INDEX "suppliers_isActive_idx" ON "suppliers"("isActive");

ALTER TABLE "suppliers"
ADD CONSTRAINT "suppliers_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
