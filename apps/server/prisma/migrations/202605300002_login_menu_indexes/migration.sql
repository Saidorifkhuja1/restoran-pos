CREATE INDEX "users_phone_idx" ON "users"("phone");
CREATE INDEX "users_restaurantId_isActive_updatedAt_idx" ON "users"("restaurantId", "isActive", "updatedAt");
CREATE INDEX "users_restaurantId_role_isActive_idx" ON "users"("restaurantId", "role", "isActive");

CREATE INDEX "menu_categories_restaurantId_isActive_sortOrder_idx" ON "menu_categories"("restaurantId", "isActive", "sortOrder");

CREATE INDEX "menu_items_restaurantId_isActive_isAvailable_idx" ON "menu_items"("restaurantId", "isActive", "isAvailable");
CREATE INDEX "menu_items_restaurantId_categoryId_isActive_isAvailable_idx" ON "menu_items"("restaurantId", "categoryId", "isActive", "isAvailable");
