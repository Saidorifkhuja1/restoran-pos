CREATE INDEX "tables_restaurantId_status_idx" ON "tables"("restaurantId", "status");

CREATE INDEX "orders_restaurantId_status_createdAt_idx" ON "orders"("restaurantId", "status", "createdAt");
CREATE INDEX "orders_restaurantId_tableId_status_idx" ON "orders"("restaurantId", "tableId", "status");
CREATE INDEX "orders_restaurantId_waiterId_status_idx" ON "orders"("restaurantId", "waiterId", "status");

CREATE INDEX "payments_restaurantId_paidAt_idx" ON "payments"("restaurantId", "paidAt");
CREATE INDEX "payments_restaurantId_cashierId_paidAt_idx" ON "payments"("restaurantId", "cashierId", "paidAt");

CREATE INDEX "shifts_restaurantId_isActive_idx" ON "shifts"("restaurantId", "isActive");
CREATE INDEX "shifts_restaurantId_userId_isActive_idx" ON "shifts"("restaurantId", "userId", "isActive");

CREATE INDEX "expenses_restaurantId_isActive_createdAt_idx" ON "expenses"("restaurantId", "isActive", "createdAt");
