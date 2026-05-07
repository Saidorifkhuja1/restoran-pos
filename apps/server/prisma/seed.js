const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: "superadmin@restopos.uz" },
    update: {},
    create: {
      email: "superadmin@restopos.uz",
      password: await bcrypt.hash("Super12345", 10),
      name: "Platform Admin",
    },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { id: "demo-restaurant" },
    update: {},
    create: {
      id: "demo-restaurant",
      name: "Demo Resto",
      type: "Milliy taomlar",
      address: "Toshkent",
      phone: "+998901234567",
      createdBy: superAdmin.id,
      settings: { create: {} },
    },
  });

  const demoUsers = [
    ["ADMIN", "Demo Admin", "+998901111111", "1111"],
    ["MANAGER", "Demo Manager", "+998902222222", "2222"],
    ["WAITER", "Demo Waiter", "+998903333333", "3333"],
    ["KITCHEN", "Demo Kitchen", "+998904444444", "4444"],
    ["CASHIER", "Demo Cashier", "+998905555555", "5555"],
  ];
  for (const [role, name, phone, pin] of demoUsers) {
    const existing = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, role } });
    if (!existing) {
      await prisma.user.create({
        data: {
          restaurantId: restaurant.id,
          name,
          phone,
          pin: await bcrypt.hash(pin, 10),
          role,
          createdBy: superAdmin.id,
        },
      });
    }
  }

  const zone = await prisma.zone.upsert({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: "Asosiy zal" } },
    update: {},
    create: { restaurantId: restaurant.id, name: "Asosiy zal", color: "#0f766e" },
  });

  for (const table of [
    { number: 1, capacity: 4, shape: "SQUARE", posX: 32, posY: 48 },
    { number: 2, capacity: 2, shape: "ROUND", posX: 180, posY: 48 },
    { number: 3, capacity: 6, shape: "RECTANGLE", posX: 320, posY: 48 },
  ]) {
    await prisma.table.upsert({
      where: { restaurantId_zoneId_number: { restaurantId: restaurant.id, zoneId: zone.id, number: table.number } },
      update: {},
      create: { restaurantId: restaurant.id, zoneId: zone.id, ...table },
    });
  }

  const category = await prisma.menuCategory.upsert({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: "Issiq taomlar" } },
    update: {},
    create: { restaurantId: restaurant.id, name: "Issiq taomlar", emoji: "🍲" },
  });

  for (const item of [
    { name: "Osh", price: 35000, emoji: "🍛", preparationTime: 20 },
    { name: "Manti", price: 28000, emoji: "🥟", preparationTime: 18 },
    { name: "Shashlik", price: 22000, emoji: "🍢", preparationTime: 15 },
  ]) {
    await prisma.menuItem.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: item.name } },
      update: {},
      create: { restaurantId: restaurant.id, categoryId: category.id, ...item },
    });
  }

  await prisma.discount.upsert({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: "VIP mijoz" } },
    update: {},
    create: { restaurantId: restaurant.id, name: "VIP mijoz", type: "PERCENT", value: 10 },
  });

  console.log("Seed completed");
  console.log("SuperAdmin: superadmin@restopos.uz / Super12345");
  console.log("Restaurant ID: demo-restaurant");
  console.log("PINlar: ADMIN 1111, MANAGER 2222, WAITER 3333, KITCHEN 4444, CASHIER 5555");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
