
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const products = await prisma.product.findMany({
    take: 10,
    orderBy: { id: 'desc' }
  });
  console.log('Sample products:', products);
  const countWithName = await prisma.product.count({
    where: {
      name: { not: '' }
    }
  });
  console.log(`Total products with name: ${countWithName}`);
  const countWithoutName = await prisma.product.count({
    where: {
        name: ''
    }
  });
  console.log(`Total products WITHOUT name: ${countWithoutName}`);
  
  const gareMissing = await prisma.product.count({ where: { vendorName: 'gare', name: '' } });
  const chesapeakeMissing = await prisma.product.count({ where: { vendorName: 'chesapeake', name: '' } });
  
  console.log(`Gare products missing name: ${gareMissing}`);
  console.log(`Chesapeake products missing name: ${chesapeakeMissing}`);

  const total = await prisma.product.count();
  console.log(`Total products: ${total}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
