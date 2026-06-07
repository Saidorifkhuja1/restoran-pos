CREATE INDEX "reservations_restaurantId_status_scheduledAt_idx"
ON "reservations"("restaurantId", "status", "scheduledAt");

CREATE INDEX "reservations_tableId_status_idx"
ON "reservations"("tableId", "status");

CREATE INDEX "orders_tableId_status_idx"
ON "orders"("tableId", "status");

CREATE INDEX "orders_waiterId_status_idx"
ON "orders"("waiterId", "status");

CREATE INDEX "audit_logs_restaurantId_createdAt_idx"
ON "audit_logs"("restaurantId", "createdAt");
