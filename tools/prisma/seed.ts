import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Default User...');
  const user = await prisma.user.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      email: 'user@example.com',
      name: 'Default Studio',
    },
  });

  const data = [
    { minCost: 0.25, maxCost: 1.00, multiplier: 8.5 },
    { minCost: 1.01, maxCost: 1.50, multiplier: 8.25 },
    { minCost: 1.51, maxCost: 1.75, multiplier: 8 },
    { minCost: 1.76, maxCost: 2.25, multiplier: 7.75 },
    { minCost: 2.26, maxCost: 2.50, multiplier: 7.5 },
    { minCost: 2.51, maxCost: 3.00, multiplier: 7.25 },
    { minCost: 3.01, maxCost: 3.50, multiplier: 7 },
    { minCost: 3.51, maxCost: 3.75, multiplier: 6.75 },
    { minCost: 3.76, maxCost: 4.25, multiplier: 6.5 },
    { minCost: 4.26, maxCost: 5.00, multiplier: 6.25 },
    { minCost: 5.01, maxCost: 5.50, multiplier: 6 },
    { minCost: 5.51, maxCost: 6.25, multiplier: 5.75 },
    { minCost: 6.26, maxCost: 6.75, multiplier: 5.5 },
    { minCost: 6.76, maxCost: 7.75, multiplier: 5.25 },
    { minCost: 7.76, maxCost: 8.50, multiplier: 5 },
    { minCost: 8.51, maxCost: 9.50, multiplier: 4.75 },
    { minCost: 9.51, maxCost: 10.50, multiplier: 4.5 },
    { minCost: 10.51, maxCost: 11.75, multiplier: 4.25 },
    { minCost: 11.76, maxCost: 13.25, multiplier: 4 },
    { minCost: 13.26, maxCost: 15.00, multiplier: 3.75 },
    { minCost: 15.01, maxCost: 20.00, multiplier: 3.5 },
  ];

  console.log('Seeding Pricing Matrix...');
  
  // Clear existing data to avoid duplicates if re-run (optional, but good for dev)
  await prisma.pricingMatrix.deleteMany();

  for (const item of data) {
    await prisma.pricingMatrix.create({
      data: item,
    });
  }

  console.log('Seeding Rules...');
  await prisma.rule.deleteMany();
  
  await prisma.rule.create({
    data: {
      name: 'addedMultiplier',
      value: 10.0,
      type: 'PERCENTAGE_ADD',
      isActive: true
    }
  });

  await prisma.rule.create({
    data: {
      name: 'roundToDollar',
      value: 1.0, // Represents rounding to nearest 1.00
      type: 'ROUND_NEAREST',
      isActive: true,
      userId: 1
    }
  });

  await prisma.rule.create({
    data: {
      name: 'minimumStorePrice',
      value: 16.0,
      type: 'MIN_FIXED',
      isActive: true,
      userId: 1
    }
  });

  await prisma.rule.create({
    data: {
      name: 'tinyTotPrice',
      value: 22.0,
      type: 'FIXED', 
      isActive: true,
      userId: 1
    }
  });

  await prisma.rule.create({
    data: {
      name: 'smallFigurineDiscount',
      value: 10.0,
      type: 'FIXED_DEDUCTION', 
      isActive: true,
      userId: 1
    }
  });

  await prisma.rule.create({
    data: {
      name: 'smallFigurineMinPrice',
      value: 22.0,
      type: 'MIN_FIXED', 
      isActive: true,
      userId: 1
    }
  });

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
