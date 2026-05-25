const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv/config");

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

  await prisma.restaurantCounter.upsert({
    where: { restaurantId: restaurant.id },
    update: {},
    create: { restaurantId: restaurant.id },
  });

  const demoUsers = [
    ["ADMIN", "Demo Admin", "+998901111111", "Admin123!"],
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

  const seatingZones = [
    { name: "Kabinetlar", color: "#13EC37", capacity: 6, shape: "RECTANGLE", baseX: 40, baseY: 60 },
    { name: "Zal", color: "#0f766e", capacity: 4, shape: "SQUARE", baseX: 40, baseY: 260 },
    { name: "Ko'cha", color: "#22c55e", capacity: 4, shape: "RECTANGLE", baseX: 40, baseY: 460 },
  ];

  for (const seatingZone of seatingZones) {
    const createdZone = await prisma.zone.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: seatingZone.name } },
      update: { color: seatingZone.color },
      create: { restaurantId: restaurant.id, name: seatingZone.name, color: seatingZone.color },
    });

    for (let index = 1; index <= 10; index += 1) {
      await prisma.table.upsert({
        where: {
          restaurantId_zoneId_number: {
            restaurantId: restaurant.id,
            zoneId: createdZone.id,
            number: index,
          },
        },
        update: {
          capacity: seatingZone.capacity,
          shape: seatingZone.shape,
          posX: seatingZone.baseX + ((index - 1) % 5) * 140,
          posY: seatingZone.baseY + Math.floor((index - 1) / 5) * 110,
        },
        create: {
          restaurantId: restaurant.id,
          zoneId: createdZone.id,
          number: index,
          capacity: seatingZone.capacity,
          shape: seatingZone.shape,
          posX: seatingZone.baseX + ((index - 1) % 5) * 140,
          posY: seatingZone.baseY + Math.floor((index - 1) / 5) * 110,
        },
      });
    }
  }

  const menuGroups = [
    {
      name: "Milliy taomlar",
      emoji: "🍲",
      sortOrder: 1,
      items: [
        { name: "Osh", price: 35000, emoji: "🍛", preparationTime: 20 },
        { name: "Manti", price: 28000, emoji: "🥟", preparationTime: 18 },
        { name: "Shashlik", price: 22000, emoji: "🍢", preparationTime: 15 },
        { name: "Lag'mon", price: 32000, emoji: "🍜", preparationTime: 18 },
        { name: "Norin", price: 38000, emoji: "🥘", preparationTime: 16 },
      ],
    },
    {
      name: "Salatlar",
      emoji: "🥗",
      sortOrder: 2,
      items: [
        { name: "Achchiq-chuchuk", price: 12000, emoji: "🍅", preparationTime: 5 },
        { name: "Olivye", price: 18000, emoji: "🥗", preparationTime: 8 },
        { name: "Sezar", price: 28000, emoji: "🥬", preparationTime: 10 },
        { name: "Grecheskiy", price: 24000, emoji: "🫒", preparationTime: 8 },
      ],
    },
    {
      name: "Baliqlar",
      emoji: "🐟",
      sortOrder: 3,
      items: [
        { name: "Sazan qovurma", price: 65000, emoji: "🐟", preparationTime: 25 },
        { name: "Forel grill", price: 78000, emoji: "🍽", preparationTime: 28 },
        { name: "Sudak file", price: 72000, emoji: "🐠", preparationTime: 24 },
      ],
    },
    {
      name: "Ichimliklar",
      emoji: "🥤",
      sortOrder: 4,
      items: [
        { name: "Choy", price: 5000, emoji: "🫖", preparationTime: 3 },
        { name: "Coca-Cola", price: 12000, emoji: "🥤", preparationTime: 1 },
        { name: "Sharbat", price: 15000, emoji: "🧃", preparationTime: 2 },
        { name: "Suv", price: 4000, emoji: "💧", preparationTime: 1 },
      ],
    },
  ];

  for (const group of menuGroups) {
    const category = await prisma.menuCategory.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: group.name } },
      update: { emoji: group.emoji, sortOrder: group.sortOrder, isActive: true },
      create: { restaurantId: restaurant.id, name: group.name, emoji: group.emoji, sortOrder: group.sortOrder },
    });

    for (const item of group.items) {
      await prisma.menuItem.upsert({
        where: { restaurantId_name: { restaurantId: restaurant.id, name: item.name } },
        update: { categoryId: category.id, price: item.price, emoji: item.emoji, preparationTime: item.preparationTime, isActive: true, isAvailable: true },
        create: { restaurantId: restaurant.id, categoryId: category.id, ...item },
      });
    }
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
