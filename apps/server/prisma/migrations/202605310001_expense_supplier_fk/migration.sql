ALTER TABLE "expenses"
ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_supplierId_idx" ON "expenses"("supplierId");

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
