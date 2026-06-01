CREATE TABLE IF NOT EXISTS "salaries" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "salaries_restaurantId_idx" ON "salaries"("restaurantId");
CREATE INDEX IF NOT EXISTS "salaries_userId_idx" ON "salaries"("userId");
CREATE INDEX IF NOT EXISTS "salaries_createdAt_idx" ON "salaries"("createdAt");

ALTER TABLE "salaries"
ADD CONSTRAINT "salaries_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "salaries"
ADD CONSTRAINT "salaries_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
