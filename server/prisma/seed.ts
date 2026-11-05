import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding QuickOrder database...');

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('Password123!', saltRounds);

  // 1. Seed Customer account
  const customer = await prisma.user.upsert({
    where: { email: 'customer1@example.com' },
    update: {},
    create: {
      email: 'customer1@example.com',
      passwordHash,
      fullName: 'Alice Customer',
      role: Role.CUSTOMER,
    },
  });
  console.log(`Seeded Customer: ${customer.email} (ID: ${customer.id})`);

  // 2. Seed Operator account
  const operator = await prisma.user.upsert({
    where: { email: 'operator1@example.com' },
    update: {},
    create: {
      email: 'operator1@example.com',
      passwordHash,
      fullName: 'Bob Operator',
      role: Role.OPERATOR,
    },
  });
  console.log(`Seeded Operator: ${operator.email} (ID: ${operator.id})`);

  // 3. Seed Catalog items
  const catalogItems = [
    {
      name: 'Iced Matcha Latte',
      description: 'Ceremonial grade Japanese green tea latte',
      unitPrice: 4.50,
      stockQuantity: 50,
      isActive: true,
    },
    {
      name: 'Artisan Croissant',
      description: 'Freshly baked flaky French butter croissant',
      unitPrice: 3.25,
      stockQuantity: 30,
      isActive: true,
    },
    {
      name: 'KMUTT Hoodie',
      description: 'Premium heavyweight cotton university hoodie',
      unitPrice: 28.00,
      stockQuantity: 15,
      isActive: true,
    },
    {
      name: 'Canvas Tote Bag',
      description: 'Eco-friendly durable campus shoulder bag',
      unitPrice: 12.00,
      stockQuantity: 25,
      isActive: true,
    },
  ];

  for (const item of catalogItems) {
    const existing = await prisma.catalogItem.findFirst({
      where: { name: item.name },
    });
    if (!existing) {
      await prisma.catalogItem.create({ data: item });
    }
  }
  console.log('Seeded catalog items successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
